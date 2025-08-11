// src/pages/Inbox.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useSearchParams } from "react-router-dom";

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
  const mountedRef = useRef(true);

  // ---------- Auth (independent of layout) ----------
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mountedRef.current) return;
      setUser(data?.user || null);
      setLoadingUser(false);
    })();
    return () => { mountedRef.current = false; };
  }, []);

  // ---------- Threads ----------
  const fetchThreads = useCallback(async () => {
    if (!user?.id) return;
    setLoadingThreads(true);

    const { data, error } = await supabase
      .from("inbox_threads")
      .select("conversation_id, other_full_name, other_avatar_url, last_message_at, has_unread, last_message_preview")
      .eq("me_id", user.id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("threads:", error);
      setThreads([]);
    } else {
      setThreads(data || []);
      // Auto-open newest
      if (!activeId && data?.length) {
        const next = new URLSearchParams(params);
        next.set("c", data[0].conversation_id);
        setParams(next, { replace: true });
      }
    }
    setLoadingThreads(false);
  }, [user?.id, activeId, params, setParams]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Realtime: any message insert updates the thread list order/unread badge
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`threads:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        fetchThreads
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id, fetchThreads]);

  // ---------- Messages ----------
  const fetchMessages = useCallback(async () => {
    if (!activeId || !user?.id) { setMessages([]); return; }
    setLoadingMessages(true);

    // membership check (avoids RLS confusion)
    const { data: member } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", activeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) { setMessages([]); setLoadingMessages(false); return; }

    // fetch messages (no profile join to avoid RLS issues on profiles)
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("messages:", error);
      setMessages([]);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);

    // mark read (best-effort)
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", activeId)
      .eq("user_id", user.id);
  }, [activeId, user?.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime: append new messages instantly to active chat
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`chat:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new;
          setMessages((prev) => {
            // avoid duplicate when initial fetch races
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          // keep threads fresh (unread + sorting)
          fetchThreads();
          // scroll to bottom if user is active here
          queueMicrotask(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeId, fetchThreads]);

  // Auto-scroll when message count changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, activeId]);

  // ---------- Derived for UI ----------
  const activeThread = useMemo(
    () => threads.find((t) => t.conversation_id === activeId) || null,
    [threads, activeId]
  );

  // ---------- Actions ----------
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
    <div className="bg-[#F7F0E6] w-full md:h-[85vh] min-h-[75vh] rounded-xl overflow-hidden">
      <div className="h-full grid grid-cols-1 md:grid-cols-[340px_1fr]">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-black/10 flex flex-col ${
            activeId ? "hidden md:flex" : "flex"
          }`}
        >
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
                return (
                  <li key={t.conversation_id}>
                    <button
                      onClick={() => openChat(t.conversation_id)}
                      className={`w-full text-left p-3 flex items-center gap-3 hover:bg-black/5 ${
                        isActive ? "bg-black/5" : ""
                      }`}
                    >
                      <img
                        src={
                          t.other_avatar_url ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            t.other_full_name || "User"
                          )}`
                        }
                        alt=""
                        className="h-10 w-10 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate ${t.has_unread ? "font-extrabold" : "font-medium"}`}>
                            {t.other_full_name || "User"}
                          </span>
                          {t.has_unread && (
                            <span className="shrink-0 bg-[#5B3A1E] text-white text-[10px] px-2 py-0.5 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-black/60 truncate">
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
        <section className="flex flex-col bg-white">
          {activeId ? (
            <>
              {/* Header */}
              <div className="px-3 sm:px-4 py-3 border-b border-black/10 flex items-center gap-3 sticky top-0 bg-white z-10">
                {/* Back on mobile */}
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
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      activeThread?.other_full_name || "User"
                    )}`
                  }
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
                <div className="font-semibold truncate">
                  {activeThread?.other_full_name || "Conversation"}
                </div>
              </div>

              {/* Messages list */}
              <div ref={listRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-[#F7F0E6]">
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
                        className={`max-w-[78%] rounded-2xl px-3 sm:px-4 py-2 leading-relaxed ${
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
  );
}
