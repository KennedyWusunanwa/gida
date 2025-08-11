// src/pages/Inbox.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useSearchParams } from "react-router-dom";

const CHAT_BG = "#EFE7DB";

export default function Inbox() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [params, setParams] = useSearchParams();
  const activeId = params.get("c") || null;

  // Threads + messages
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Composer
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  // ---------- helpers ----------
  const avatarFor = (name) =>
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "User")}`;

  // ---------- auth ----------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setLoadingUser(false);
    })();
  }, []);

  // ---------- thread loading (no view dependency) ----------
  const fetchThreads = useCallback(async () => {
    if (!user?.id) return;
    setLoadingThreads(true);

    // 1) my participant rows
    const meRes = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);

    if (meRes.error) {
      console.error("participants(me):", meRes.error);
      setThreads([]);
      setLoadingThreads(false);
      return;
    }

    const myParts = meRes.data || [];
    const convIds = myParts.map((p) => p.conversation_id);
    if (convIds.length === 0) {
      setThreads([]);
      setLoadingThreads(false);
      return;
    }

    // 2) other participant ids for those conversations
    const othersRes = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds)
      .neq("user_id", user.id);

    if (othersRes.error) {
      console.error("participants(other):", othersRes.error);
      setThreads([]);
      setLoadingThreads(false);
      return;
    }

    const otherRows = othersRes.data || [];
    const otherIds = [...new Set(otherRows.map((r) => r.user_id))];

    // 3) profiles for others (best-effort)
    let profMap = new Map();
    if (otherIds.length) {
      const profRes = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", otherIds);
      if (!profRes.error) {
        profMap = new Map((profRes.data || []).map((p) => [p.id, p]));
      } else {
        // not fatal if RLS blocks profiles; we’ll show initials
        console.warn("profiles select blocked by RLS, showing initials only");
      }
    }

    // 4) latest messages for all conversations (one bulk fetch)
    const msgRes = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });

    if (msgRes.error) {
      console.error("messages(last):", msgRes.error);
    }

    const lastByConv = new Map(); // conversation_id -> last message
    for (const m of msgRes.data || []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }

    // 5) build thread objects + compute hasUnread
    const mePartMap = new Map(myParts.map((p) => [p.conversation_id, p]));
    const firstOtherByConv = new Map();
    for (const r of otherRows) {
      if (!firstOtherByConv.has(r.conversation_id)) firstOtherByConv.set(r.conversation_id, r.user_id);
    }

    const built = convIds.map((cid) => {
      const otherId = firstOtherByConv.get(cid);
      const prof = otherId ? profMap.get(otherId) : null;
      const last = lastByConv.get(cid);
      const myRead = mePartMap.get(cid)?.last_read_at || null;

      const hasUnread =
        last && myRead
          ? new Date(last.created_at) > new Date(myRead) && last.sender_id !== user.id
          : !!(last && last.sender_id !== user.id);

      return {
        conversation_id: cid,
        other_user_id: otherId || null,
        other_full_name: prof?.full_name || "User",
        other_avatar_url: prof?.avatar_url || null,
        last_message_at: last?.created_at || null,
        last_message_preview: last?.body || "",
        has_unread: hasUnread,
      };
    });

    built.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    setThreads(built);
    setLoadingThreads(false);

    if (!activeId && built.length) {
      const next = new URLSearchParams(params);
      next.set("c", built[0].conversation_id);
      setParams(next, { replace: true });
    }
  }, [user?.id, activeId, params, setParams]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // realtime: new messages should reshuffle/highlight
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`threads-all`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        fetchThreads
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchThreads, user?.id]);

  // ---------- messages ----------
  const fetchMessages = useCallback(async () => {
    if (!activeId || !user?.id) { setMessages([]); return; }
    setLoadingMessages(true);

    // permission check (participant)
    const { data: member } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", activeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("messages(fetch):", error);
      setMessages([]);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);

    // mark read now
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", activeId)
      .eq("user_id", user.id);
  }, [activeId, user?.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`chat:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          fetchThreads();
          queueMicrotask(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeId, fetchThreads]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, activeId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.conversation_id === activeId) || null,
    [threads, activeId]
  );

  async function sendMessage(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !activeId || !user?.id) return;

    // optimistic
    const temp = {
      id: `tmp-${Date.now()}`,
      conversation_id: activeId,
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, temp]);
    setText("");
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      body,
    });
    if (error) console.error("send:", error);
    setSending(false);
  }

  function openChat(id) {
    const next = new URLSearchParams(params);
    next.set("c", id);
    setParams(next);
  }

  if (loadingUser) return <div className="p-6">Loading…</div>;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-white">
        <div className="h-[64vh] md:h-[70vh] grid grid-cols-1 md:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className={`border-r border-black/10 flex flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
            <div className="px-4 py-3 font-extrabold text-lg border-b sticky top-0 bg-white z-10">Messages</div>
            {loadingThreads ? (
              <div className="p-4 text-black/60">Loading chats…</div>
            ) : threads.length === 0 ? (
              <div className="p-4 text-black/60">No conversations yet</div>
            ) : (
              <ul className="flex-1 overflow-y-auto">
                {threads.map((t) => {
                  const isActive = activeId === t.conversation_id;
                  const name = t.other_full_name || "User";
                  return (
                    <li key={t.conversation_id}>
                      <button
                        onClick={() => openChat(t.conversation_id)}
                        className={`w-full text-left p-3 flex items-center gap-3 hover:bg-black/5 ${
                          isActive ? "bg-black/5" : ""
                        }`}
                      >
                        <img src={t.other_avatar_url || avatarFor(name)} alt="" className="h-8 w-8 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate ${t.has_unread ? "font-extrabold" : "font-medium"}`}>{name}</span>
                            {t.has_unread && (
                              <span className="shrink-0 bg-[#5B3A1E] text-white text-[10px] px-2 py-0.5 rounded-full">
                                New
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-black/60 truncate">{t.last_message_preview || ""}</div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Chat */}
          <section className="flex flex-col" style={{ backgroundColor: CHAT_BG }}>
            {activeId ? (
              <>
                <div className="px-3 sm:px-4 py-3 border-b border-black/10 flex items-center gap-3 sticky top-0 bg-white/90 backdrop-blur z-10">
                  <button
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete("c");
                      setParams(next, { replace: true });
                    }}
                    className="md:hidden rounded-lg px-2 py-1 border border-black/10"
                  >
                    Back
                  </button>
                  <img
                    src={activeThread?.other_avatar_url || avatarFor(activeThread?.other_full_name)}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="font-semibold truncate">{activeThread?.other_full_name || "Conversation"}</div>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
                  {loadingMessages ? (
                    <div className="text-black/60">Loading messages…</div>
                  ) : messages.length === 0 ? (
                    <div className="text-black/60">No messages yet</div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === user.id;
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[78%] rounded-2xl px-3 sm:px-4 py-2 leading-relaxed shadow ${
                            mine ? "ml-auto bg-[#5B3A1E] text-white" : "bg-white text-black"
                          }`}
                        >
                          <div>{m.body}</div>
                          <div className="mt-1 text-[10px] opacity-60 text-right">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendMessage} className="p-2 sm:p-3 border-t border-black/10 flex gap-2 bg-white">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 rounded-xl border border-black/10 px-3 sm:px-4 py-2"
                    disabled={!user || sending}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#5B3A1E] text-white px-4 py-2 font-semibold disabled:opacity-60"
                    disabled={!text.trim() || sending}
                  >
                    Send
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-black/60 p-6">Select a chat to start</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
