// src/pages/Inbox.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useSearchParams } from "react-router-dom";

const CHAT_BG = "#EFE7DB"; // warmer than page bg

export default function Inbox() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [params, setParams] = useSearchParams();
  const activeId = params.get("c") || null;

  // Threads
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  // Messages
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Composer
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Refs
  const listRef = useRef(null);

  // ---------- Auth ----------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setLoadingUser(false);
    })();
  }, []);

  // ---------- Helpers ----------
  const avatarFor = (name) =>
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "User")}`;

  // ---------- Threads ----------
  const fetchThreadsFromView = async (uid) => {
    return await supabase
      .from("inbox_threads")
      .select("conversation_id, other_full_name, other_avatar_url, last_message_at, has_unread, last_message_preview")
      .eq("me_id", uid)
      .order("last_message_at", { ascending: false });
  };

  // Fallback builder if the view is empty/blocked by RLS
  const fetchThreadsFallback = async (uid) => {
    const convIdsRes = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", uid);

    if (convIdsRes.error) return { data: [], error: convIdsRes.error };

    const convIds = (convIdsRes.data || []).map((r) => r.conversation_id);
    if (convIds.length === 0) return { data: [], error: null };

    // Get both participants to find "other user"
    const partsRes = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds);

    if (partsRes.error) return { data: [], error: partsRes.error };

    const map = new Map(); // conversation_id -> other_user_id
    for (const p of partsRes.data || []) {
      if (p.user_id !== uid) {
        map.set(p.conversation_id, p.user_id);
      }
    }

    const otherIds = [...new Set([...map.values()])];
    let profMap = new Map();
    if (otherIds.length) {
      const profs = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", otherIds);
      if (!profs.error) {
        profMap = new Map((profs.data || []).map((x) => [x.id, x]));
      }
    }

    // Last message per conversation (N queries can be heavy, but safe for small N)
    const results = [];
    for (const convId of convIds) {
      const last = await supabase
        .from("messages")
        .select("body, created_at, sender_id")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const otherId = map.get(convId);
      const prof = profMap.get(otherId) || {};
      results.push({
        conversation_id: convId,
        other_full_name: prof.full_name || "User",
        other_avatar_url: prof.avatar_url || null,
        last_message_at: last.data?.created_at || null,
        has_unread: false, // unknown here (requires last_read_at logic); view handles this better
        last_message_preview: last.data?.body || "",
      });
    }

    // Sort newest first
    results.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    return { data: results, error: null };
  };

  const fetchThreads = useCallback(async () => {
    if (!user?.id) return;
    setLoadingThreads(true);

    let { data, error } = await fetchThreadsFromView(user.id);
    if (error) console.warn("inbox_threads view error; using fallback:", error);
    if (error || !data?.length) {
      const fb = await fetchThreadsFallback(user.id);
      data = fb.data;
    }

    setThreads(data || []);
    setLoadingThreads(false);

    // Auto-open newest
    if (!activeId && data?.length) {
      const next = new URLSearchParams(params);
      next.set("c", data[0].conversation_id);
      setParams(next, { replace: true });
    }
  }, [user?.id, activeId, params, setParams]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Realtime: any new message adjusts threads
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`threads:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => fetchThreads()
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id, fetchThreads]);

  // ---------- Messages ----------
  const fetchMessages = useCallback(async () => {
    if (!activeId || !user?.id) { setMessages([]); return; }
    setLoadingMessages(true);

    // Ensure participant
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
      console.error(error);
      setMessages([]);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);

    // mark read
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", activeId)
      .eq("user_id", user.id);
  }, [activeId, user?.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime for messages
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
          // keep threads updated and order correct
          fetchThreads();
          // scroll down
          queueMicrotask(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeId, fetchThreads]);

  // Auto-scroll when message count grows
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, activeId]);

  // Derived
  const activeThread = useMemo(
    () => threads.find((t) => t.conversation_id === activeId) || null,
    [threads, activeId]
  );

  // Actions
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
    setMessages((prev) => [...prev, temp]);
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
    <div className="w-full max-w-6xl mx-auto">
      {/* compact card so it doesn’t feel full-bleed */}
      <div className="rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.06)] bg-white">
        <div className="h-[70vh] grid grid-cols-1 md:grid-cols-[300px_1fr]">
          {/* Sidebar */}
          <aside className={`border-r border-black/10 flex flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
            <div className="px-4 py-3 font-extrabold text-lg border-b sticky top-0 bg-white z-10">
              Messages
            </div>

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
                        <img
                          src={t.other_avatar_url || avatarFor(name)}
                          alt=""
                          className="h-9 w-9 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate ${t.has_unread ? "font-extrabold" : "font-medium"}`}>
                              {name}
                            </span>
                            {t.has_unread && (
                              <span className="shrink-0 bg-[#5B3A1E] text-white text-[10px] px-2 py-0.5 rounded-full">
                                New
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-black/60 truncate">
                            {t.last_message_preview || ""}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Chat Area */}
          <section className="flex flex-col" style={{ backgroundColor: CHAT_BG }}>
            {activeId ? (
              <>
                {/* Header */}
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
                    src={
                      activeThread?.other_avatar_url ||
                      avatarFor(activeThread?.other_full_name)
                    }
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="font-semibold truncate">
                    {activeThread?.other_full_name || "Conversation"}
                  </div>
                </div>

                {/* Messages list */}
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

                {/* Composer */}
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
              <div className="flex-1 flex items-center justify-center text-black/60 p-6">
                Select a chat to start messaging
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
