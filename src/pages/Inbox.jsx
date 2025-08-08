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

  // Load signed-in user and keep updated
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load conversations & subscribe to changes
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let channel;

    const loadConvos = async () => {
      setLoadingConvos(true);
      const { data: convs, error } = await supabase
        .from("conversations")
        .select(
          `
          id,
          type,
          listing_id,
          created_at,
          conversation_participants!inner(user_id)
        `
        )
        .eq("conversation_participants.user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        if (!cancelled) setConvos([]);
        setLoadingConvos(false);
        return;
      }
      setConvos(convs || []);
      setLoadingConvos(false);
    };

    loadConvos();

    // Listen for new conversations
    channel = supabase
      .channel("realtime:conversations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        loadConvos();
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Load messages for active convo & subscribe
  useEffect(() => {
    if (!activeId || !user?.id) return;
    let cancelled = false;
    let channel;

    const loadMessages = async () => {
      setLoadingMsgs(true);
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        if (!cancelled) setMessages([]);
        setLoadingMsgs(false);
        return;
      }
      setMessages(msgs || []);
      setLoadingMsgs(false);
    };

    loadMessages();

    channel = supabase
      .channel(`chat:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeId, user?.id]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      body: text.trim(),
    });
    if (error) console.error(error);
    setText("");
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      {/* Sidebar + Chat */}
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 p-4">
        <aside className="bg-white rounded-2xl shadow p-3">
          <h2 className="text-xl font-extrabold mb-3">Messages</h2>
          {loadingConvos ? (
            <p className="opacity-70">Loading…</p>
          ) : (
            <ul className="space-y-2">
              {convos.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set("c", c.id);
                      setParams(next);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 ${
                      activeId === c.id ? "bg-[#F7F0E6]" : "hover:bg-[#F7F0E6]"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold">
                        {c.type === "support" ? "Gida Support" : "Chat"}
                      </div>
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

        <section className="bg-white rounded-2xl shadow flex flex-col">
          <div className="px-4 py-3 border-b border-black/5 flex items-center gap-3">
            <div className="text-lg font-bold">Conversation</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingMsgs ? (
              <p className="opacity-70">Loading messages…</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    m.sender_id === user?.id ? "ml-auto bg-[#5B3A1E] text-white" : "bg-[#F6EDE1] text-black"
                  }`}
                >
                  {m.body}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="p-3 border-t border-black/5 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
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
