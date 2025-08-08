// src/pages/Inbox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  // Load signed-in user
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data?.user ?? null);
    });
    return () => { mounted = false; };
  }, []);

  // Load conversations & subscribe for realtime new ones
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function fetchConvos() {
      setLoadingConvos(true);
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select(`
          id,
          type,
          listing_id,
          created_at,
          conversation_participants!inner(user_id)
        `)
        .eq("conversation_participants.user_id", user.id)
        .order("created_at", { ascending: false });

      if (convErr) {
        console.error(convErr);
        if (!cancelled) setConvos([]);
        setLoadingConvos(false);
        return;
      }

      const ids = convs.map((c) => c.id);
      if (!ids.length) {
        if (!cancelled) setConvos([]);
        setLoadingConvos(false);
        return;
      }

      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", ids);

      const userIds = Array.from(new Set(parts.map((p) => p.user_id)));
      let profileMap = new Map();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        profileMap = new Map(profs.map((p) => [p.id, p]));
      }

      const byConv = new Map();
      for (const c of convs) byConv.set(c.id, { ...c, participants: [] });
      for (const p of parts) {
        const row = byConv.get(p.conversation_id);
        if (!row) continue;
        row.participants.push({
          ...p,
          profiles: profileMap.get(p.user_id) || null,
        });
      }

      if (!cancelled) {
        setConvos(Array.from(byConv.values()));
        setLoadingConvos(false);
      }
    }

    fetchConvos();

    // Realtime: new conversation for this user
    const convoChannel = supabase
      .channel(`convos:user:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const newConvoId = payload.new.conversation_id;
          const { data: newConvo } = await supabase
            .from("conversations")
            .select(`
              id,
              type,
              listing_id,
              created_at,
              conversation_participants (
                user_id,
                profiles ( id, full_name, avatar_url )
              )
            `)
            .eq("id", newConvoId)
            .maybeSingle();

          if (newConvo) {
            setConvos((prev) => [newConvo, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(convoChannel);
    };
  }, [user?.id]);

  // Load messages & subscribe for realtime
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let channel;

    async function fetchMessages() {
      setLoadingMsgs(true);

      if (user?.id) {
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
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });

      const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
      let senderMap = new Map();
      if (senderIds.length) {
        const { data: senders } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", senderIds);
        senderMap = new Map(senders.map((p) => [p.id, p]));
      }

      const hydrated = msgs.map((m) => ({
        ...m,
        profiles: senderMap.get(m.sender_id) || null,
      }));

      if (!cancelled) {
        setMessages(hydrated);
        setLoadingMsgs(false);
      }
    }

    fetchMessages();

    // Realtime: new message in this convo
    channel = supabase
      .channel(`chat:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        async (payload) => {
          const m = payload.new;
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("id", m.sender_id)
            .maybeSingle();

          setMessages((prev) => [...prev, { ...m, profiles: prof || null }]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const activeOther = useMemo(() => {
    if (!activeId) return null;
    const c = convos.find((x) => x.id === activeId);
    if (!c || !c.participants) return null;
    if (!user?.id) return c.participants[0]?.profiles || null;
    const other = c.participants.find((p) => p.user_id !== user.id);
    return other?.profiles || null;
  }, [convos, activeId, user?.id]);

  const headerName =
    activeOther?.full_name || (activeId ? "Conversation" : "Select a conversation");
  const headerAvatar =
    activeOther?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(headerName)}`;

  const sidebarItems = useMemo(() => {
    return convos.map((c) => {
      let other = null;
      if (!user?.id) {
        other = c.participants?.[0]?.profiles || null;
      } else {
        const o = (c.participants || []).find((p) => p.user_id !== user.id);
        other = o?.profiles || null;
      }
      const name = other?.full_name || (c.type === "support" ? "Gida Support" : "Chat");
      const avatar =
        other?.avatar_url ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
      return { id: c.id, name, avatar, created_at: c.created_at };
    });
  }, [convos, user?.id]);

  const openConvo = (id) => {
    const next = new URLSearchParams(params);
    next.set("c", id);
    setParams(next);
  };

  async function send(e) {
    e.preventDefault();
    if (!user?.id || !activeId) {
      alert("Sign in and select a conversation to send a message.");
      return;
    }
    const body = text.trim();
    if (!body) return;

    try {
      setSending(true);
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeId,
        sender_id: user.id,
        body,
      });
      if (error) {
        console.error(error);
        alert(error.message || "Failed to send.");
        return;
      }
      setText("");
    } finally {
      setSending(false);
    }
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
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-[11px] opacity-60">
                        Started {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Chat window */}
        <section className="bg-white rounded-2xl shadow flex flex-col">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-3">
            {activeId && (
              <img
                src={headerAvatar}
                alt={headerName}
                className="h-8 w-8 rounded-full object-cover"
              />
            )}
            <div className="text-lg font-bold">{headerName}</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs && activeId ? (
              <p className="opacity-70">Loading messages…</p>
            ) : activeId ? (
              messages.length === 0 ? (
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
                      <div className={`mb-1 text-xs font-semibold ${mine ? "opacity-90" : "opacity-70"}`}>
                        {name}
                      </div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div
                        className={`mt-1 text-[10px] ${
                          mine ? "text-white/80" : "text-black/50"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              <div className="opacity-70">Select a conversation</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <form onSubmit={send} className="p-3 border-t border-black/5 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                user && activeId ? "Type a message…" : "Sign in & select a conversation"
              }
              className="flex-1 rounded-xl border border-black/10 px-4 py-3 outline-none"
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
