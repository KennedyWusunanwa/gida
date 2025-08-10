// src/pages/Inbox.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c") || null;

  const [user, setUser] = useState(null);
  const [convos, setConvos] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);

  // ===== Load signed-in user =====
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
    });
  }, []);

  // ===== Fetch conversations with unread detection =====
  const fetchConvos = useCallback(async () => {
    if (!user?.id) return;
    setLoadingConvos(true);

    const { data: convs, error } = await supabase
      .from("conversations")
      .select(`
        id,
        type,
        listing_id,
        created_at,
        messages!messages_conversation_id_fkey(created_at),
        conversation_participants!inner(user_id, last_read_at)
      `)
      .eq("conversation_participants.user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setConvos([]);
      setLoadingConvos(false);
      return;
    }

    const withUnread = convs.map(c => {
      const latestMsgTime = c.messages?.length
        ? new Date(c.messages[c.messages.length - 1].created_at).getTime()
        : 0;
      const lastReadTime = c.conversation_participants?.[0]?.last_read_at
        ? new Date(c.conversation_participants[0].last_read_at).getTime()
        : 0;
      return { ...c, hasUnread: latestMsgTime > lastReadTime };
    });

    setConvos(withUnread);
    setLoadingConvos(false);
  }, [user?.id]);

  useEffect(() => { fetchConvos(); }, [fetchConvos]);

  // ===== Live updates for new messages =====
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`global-messages:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchConvos();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user?.id, fetchConvos]);

  // ===== Fetch messages =====
  const fetchMessages = useCallback(async () => {
    if (!activeId || !user?.id) return;
    setLoadingMsgs(true);

    const { data: membership } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", activeId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      setMessages([]);
      setLoadingMsgs(false);
      return;
    }

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true });

    const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
    const { data: senders } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", senderIds);

    const senderMap = new Map((senders || []).map((p) => [p.id, p]));
    const hydrated = msgs.map((m) => ({ ...m, profiles: senderMap.get(m.sender_id) || null }));

    setMessages(hydrated);

    // mark as read
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", activeId)
      .eq("user_id", user.id);

    setLoadingMsgs(false);
  }, [activeId, user?.id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // ===== Live updates for active chat =====
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, async () => {
        await fetchMessages();
        await fetchConvos();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [activeId, fetchMessages, fetchConvos]);

  // ===== Auto-scroll =====
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const sidebarItems = useMemo(() => {
    return convos.map((c) => {
      const other = (c.conversation_participants || []).find((p) => p.user_id !== user?.id)?.profiles;
      const name = other?.full_name || (c.type === "support" ? "Gida Support" : "Chat");
      const avatar =
        other?.avatar_url ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
      return { id: c.id, name, avatar, created_at: c.created_at, hasUnread: c.hasUnread };
    });
  }, [convos, user?.id]);

  const openConvo = (id) => {
    const next = new URLSearchParams(params);
    next.set("c", id);
    setParams(next);
  };

  async function send(e) {
    e.preventDefault();
    if (!user?.id || !activeId) return;
    const body = text.trim();
    if (!body) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      body,
    });
    if (error) console.error(error);
    setText("");
    setSending(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 p-4">
        {/* Sidebar */}
        <aside className="bg-white rounded-2xl shadow p-3">
          <h2 className="text-xl font-extrabold mb-3">Messages</h2>
          {loadingConvos ? (
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
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-[11px] opacity-60">
                          {new Date(c.created_at).toLocaleDateString()}
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
                <div className="text-lg font-bold">
                  {sidebarItems.find((s) => s.id === activeId)?.name || "Conversation"}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs && activeId ? (
              <p className="opacity-70">Loading messages…</p>
            ) : messages.length === 0 ? (
              <div className="opacity-70">No messages yet.</div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const name = m.profiles?.full_name || (mine ? "You" : "User");
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
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
