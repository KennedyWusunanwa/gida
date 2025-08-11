// src/pages/Inbox.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useSearchParams } from "react-router-dom";

export default function Inbox() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c") || null;

  // Threads list
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  // Messages in active chat
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Message input
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  // 1️⃣ Load logged-in user directly (independent of DashboardLayout)
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      setUser(data?.user || null);
      setLoadingUser(false);
    };
    getUser();
  }, []);

  // 2️⃣ Fetch threads
  const fetchThreads = useCallback(async () => {
    if (!user?.id) return;
    setLoadingThreads(true);

    const { data, error } = await supabase
      .from("inbox_threads")
      .select("*")
      .eq("me_id", user.id)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error(error);
      setThreads([]);
    } else {
      setThreads(data || []);
      // Auto-open newest chat
      if (!activeId && data?.length) {
        const next = new URLSearchParams(params);
        next.set("c", data[0].conversation_id);
        setParams(next, { replace: true });
      }
    }
    setLoadingThreads(false);
  }, [user?.id, activeId, params, setParams]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Realtime updates for threads
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`threads:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        fetchThreads
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, fetchThreads]);

  // 3️⃣ Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!activeId || !user?.id) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at, profiles(full_name, avatar_url)")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setMessages([]);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);

    // Mark as read
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", activeId)
      .eq("user_id", user.id);
  }, [activeId, user?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime for messages
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        fetchMessages
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [activeId, fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Send message (optimistic update)
  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !activeId || !user?.id) return;

    const optimistic = {
      id: Date.now(),
      sender_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
      profiles: { full_name: "You", avatar_url: null },
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      body: optimistic.body,
    });
    if (error) console.error(error);
    setSending(false);
  }

  // Thread click
  const openChat = (id) => {
    const next = new URLSearchParams(params);
    next.set("c", id);
    setParams(next);
  };

  if (loadingUser) return <div className="p-6">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#F7F0E6] grid grid-cols-1 md:grid-cols-[320px_1fr]">
      {/* Sidebar */}
      <aside className="bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 font-bold text-lg border-b">Messages</div>
        {loadingThreads ? (
          <div className="p-4 text-gray-500">Loading chats…</div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-gray-500">No conversations yet</div>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {threads.map((t) => (
              <li
                key={t.conversation_id}
                onClick={() => openChat(t.conversation_id)}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 ${
                  activeId === t.conversation_id ? "bg-gray-100" : ""
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
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate">
                      {t.other_full_name || "User"}
                    </span>
                    {t.has_unread && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        New
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {t.last_message_preview || ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Chat area */}
      <section className="flex flex-col">
        {activeId ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center gap-3 bg-white">
              {(() => {
                const activeThread = threads.find(
                  (t) => t.conversation_id === activeId
                );
                return (
                  <>
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
                    <div className="font-medium">
                      {activeThread?.other_full_name || "Conversation"}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F0E6]"
            >
              {loadingMessages ? (
                <div className="text-gray-500">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-gray-500">No messages yet</div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        mine
                          ? "ml-auto bg-[#5B3A1E] text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      <div>{m.body}</div>
                      <div className="mt-1 text-[10px] opacity-60">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={sendMessage}
              className="p-3 border-t flex gap-2 bg-white"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2"
                disabled={!user || sending}
              />
              <button
                type="submit"
                className="bg-[#5B3A1E] text-white px-4 py-2 rounded-xl disabled:opacity-60"
                disabled={!text.trim() || sending}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </section>
    </div>
  );
}
