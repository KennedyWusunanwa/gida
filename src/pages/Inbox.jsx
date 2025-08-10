// src/pages/Inbox.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useDashboardUser } from "../layouts/DashboardLayout";


export default function Inbox() {
  const user = useDashboardUser(); // composable with your Dashboard shell
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c") || null;

  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [msgs, setMsgs] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);

  // ---------- Load threads from view ----------
  const fetchThreads = useCallback(async () => {
    if (!user?.id) return;
    setLoadingThreads(true);

    const { data, error } = await supabase
      .from("inbox_threads")
      .select("conversation_id, other_user_id, other_full_name, other_avatar_url, last_message_at, has_unread, me_id")
      .eq("me_id", user.id)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("threads error", error);
      setThreads([]);
    } else {
      setThreads(data || []);
    }
    setLoadingThreads(false);

    // If no active conversation, auto-open the most recent
    if (!activeId && (data?.length ?? 0) > 0) {
      const next = new URLSearchParams(params);
      next.set("c", data[0].conversation_id);
      setParams(next, { replace: true });
    }
  }, [user?.id, activeId, params, setParams]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Realtime: any new message should refresh threads
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`threads:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fetchThreads)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id, fetchThreads]);

  // ---------- Load messages for active conversation ----------
  const fetchMessages = useCallback(async () => {
    if (!activeId || !user?.id) { setMsgs([]); return; }
    setLoadingMsgs(true);

    // Verify membership (RLS will fail if not participant)
    const { data: membership, error: memErr } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("conversation_id", activeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr || !membership) {
      setMsgs([]);
      setLoadingMsgs(false);
      return;
    }

    const { data: raw, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("messages error", error);
      setMsgs([]);
      setLoadingMsgs(false);
      return;
    }

    const senderIds = [...new Set(raw.map(r => r.sender_id))];
    let senderMap = new Map();
    if (senderIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", senderIds);
      senderMap = new Map((profs || []).map(p => [p.id, p]));
    }

    const hydrated = raw.map(r => ({ ...r, profile: senderMap.get(r.sender_id) || null }));
    setMsgs(hydrated);

    // Mark read
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", activeId)
      .eq("user_id", user.id);

    setLoadingMsgs(false);
  }, [activeId, user?.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime for active chat
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`chat:${activeId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeId}`,
      }, async () => {
        await fetchMessages();
        await fetchThreads();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeId, fetchMessages, fetchThreads]);

  // Scroll down on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  // ---------- UI helpers ----------
  const sidebarItems = useMemo(() => {
    return (threads || []).map(t => {
      const name = t.other_full_name || "User";
      const avatar = t.other_avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
      return {
        id: t.conversation_id,
        name,
        avatar,
        date: t.last_message_at,
        hasUnread: t.has_unread,
      };
    });
  }, [threads]);

  const openConvo = (id) => {
    const next = new URLSearchParams(params);
    next.set("c", id);
    setParams(next);
  };

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!user?.id || !activeId || !body) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      body,
    });
    if (!error) setText("");
    setSending(false);
  }

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 p-4">
        {/* Sidebar */}
        <aside className="bg-white rounded-2xl shadow p-3">
          <h2 className="text-xl font-extrabold mb-3">Messages</h2>
          {loadingThreads ? (
            <p className="opacity-70">Loading…</p>
          ) : sidebarItems.length === 0 ? (
            <p className="opacity-70">No conversations yet.</p>
          ) : (
            <ul className="space-y-2">
              {sidebarItems.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openConvo(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 ${
                      activeId === c.id ? "bg-[#F7F0E6]" : "hover:bg-[#F7F0E6]"
                    }`}
                  >
                    <img src={c.avatar} alt={c.name} className="h-8 w-8 rounded-full" />
                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <div className="font-semibold truncate">{c.name}</div>
                        <div className="text-[11px] opacity-60">
                          {c.date ? new Date(c.date).toLocaleDateString() : ""}
                        </div>
                      </div>
                      {c.hasUnread && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Chat */}
        <section className="bg-white rounded-2xl shadow flex flex-col">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-3">
            {activeId && (
              <>
                <img
                  src={
                    sidebarItems.find((s) => s.id === activeId)?.avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=User`
                  }
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
                <div className="text-lg font-bold truncate">
                  {sidebarItems.find((s) => s.id === activeId)?.name || "Conversation"}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs && activeId ? (
              <p className="opacity-70">Loading messages…</p>
            ) : msgs.length === 0 ? (
              <div className="opacity-70">No messages yet.</div>
            ) : (
              msgs.map((m) => {
                const mine = m.sender_id === user?.id;
                const name = m.profile?.full_name || (mine ? "You" : "User");
                return (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      mine ? "ml-auto bg-[#5B3A1E] text-white" : "bg-[#F6EDE1] text-black"
                    }`}
                  >
                    <div className="mb-1 text-xs font-semibold opacity-70">{name}</div>
                    <div>{m.body}</div>
                    <div className="mt-1 text-[10px] opacity-50">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="p-3 border-t border-black/5 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-xl border border-black/10 px-4 py-3"
              disabled={!user || !activeId || sending}
            />
            <button
              className="rounded-xl bg-[#5B3A1E] text-white px-4 py-3 font-semibold disabled:opacity-60"
              disabled={!user || !activeId || sending || !text.trim()}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
