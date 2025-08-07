// src/pages/Chat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const convoId = searchParams.get("c") || "";

  const [viewer, setViewer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [convo, setConvo] = useState(null);
  const [participants, setParticipants] = useState([]); // [{user_id, profiles:{id,full_name,avatar_url}}]
  const [messages, setMessages] = useState([]); // [{id, body, created_at, sender_id, profiles:{...}}]

  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Load viewer
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setViewer(data?.user ?? null);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel;

    const load = async () => {
      setLoading(true);
      setErr(null);

      if (!convoId) {
        setErr("No conversation selected.");
        setLoading(false);
        return;
      }

      // 1) Conversation exists?
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("id, listing_id, type")
        .eq("id", convoId)
        .maybeSingle();

      if (convErr) {
        if (!cancelled) {
          setErr(convErr.message || "Failed to load conversation.");
          setLoading(false);
        }
        return;
      }
      if (!conv) {
        if (!cancelled) {
          setErr("Conversation not found.");
          setLoading(false);
        }
        return;
      }

      // 2) Participants (+profile)
      const { data: parts, error: partErr } = await supabase
        .from("conversation_participants")
        .select(
          `
          user_id,
          profiles (
            id,
            full_name,
            avatar_url
          )
        `
        )
        .eq("conversation_id", convoId);

      if (partErr) {
        if (!cancelled) {
          setErr(partErr.message || "Failed to load participants.");
          setLoading(false);
        }
        return;
      }

      // 3) Membership check (if logged in)
      if (viewer) {
        const isMember = (parts || []).some((p) => p.user_id === viewer.id);
        if (!isMember) {
          if (!cancelled) {
            setErr("You are not a participant of this conversation.");
            setLoading(false);
          }
          return;
        }
      }

      // 4) Messages
      const { data: msgs, error: msgErr } = await supabase
        .from("messages")
        .select(
          `
          id,
          conversation_id,
          sender_id,
          body,
          created_at,
          profiles:profiles!messages_sender_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `
        )
        .eq("conversation_id", convoId)
        .order("created_at", { ascending: true });

      if (msgErr) {
        if (!cancelled) {
          setErr(msgErr.message || "Failed to load messages.");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setConvo(conv);
        setParticipants(parts || []);
        setMessages(msgs || []);
        setLoading(false);
      }

      // 5) Realtime subscribe for new messages
      channel = supabase
        .channel(`room:${convoId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${convoId}`,
          },
          async (payload) => {
            const m = payload.new;

            // hydrate sender profile
            let senderProfile = null;
            const { data: prof } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .eq("id", m.sender_id)
              .maybeSingle();

            if (prof) senderProfile = prof;

            setMessages((prev) => [
              ...prev,
              { ...m, profiles: senderProfile },
            ]);
          }
        )
        .subscribe();
    };

    load();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [convoId, viewer?.id]); // re-check membership once viewer loads

  const otherParty = useMemo(() => {
    if (!viewer) return participants[0]?.profiles || null;
    const other = participants.find((p) => p.user_id !== viewer.id);
    return other?.profiles || null;
  }, [participants, viewer]);

  const canSend = Boolean(viewer && convoId);

  async function handleSend(e) {
    e.preventDefault();
    if (!canSend) {
      alert("Sign in to send messages.");
      return;
    }
    const body = text.trim();
    if (!body) return;

    try {
      setSending(true);
      const { error } = await supabase.from("messages").insert({
        conversation_id: convoId,
        sender_id: viewer.id,
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

  // ---------- UI ----------
  if (!convoId) {
    return (
      <div className="p-6">
        <p className="text-black/70 mb-4">No conversation selected.</p>
        <Link to="/app/inbox" className="inline-block rounded-lg border px-4 py-2">
          Go to Inbox
        </Link>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading chat…</div>;
  if (err)
    return (
      <div className="p-6">
        <p className="text-red-600 mb-3">{err}</p>
        <Link to="/app/inbox" className="inline-block rounded-lg border px-4 py-2">
          Back to Inbox
        </Link>
      </div>
    );

  const headerName =
    otherParty?.full_name || "Conversation";
  const headerAvatar =
    otherParty?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      headerName
    )}`;

  return (
    <div className="h-[calc(100vh-64px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link to="/app/inbox" className="text-sm underline">
          ← Inbox
        </Link>
        <img
          src={headerAvatar}
          alt={headerName}
          className="h-8 w-8 rounded-full object-cover"
        />
        <div className="font-semibold">{headerName}</div>
      </div>

      {/* Messages */}
      <div className="px-4 py-4 overflow-y-auto h-[calc(100%-140px)] bg-[#F7F0E6]">
        {messages.length === 0 ? (
          <div className="text-black/60 text-sm">No messages yet.</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === viewer?.id;
            const name = m.profiles?.full_name || (mine ? "You" : "User");
            const avatar =
              m.profiles?.avatar_url ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                name
              )}`;
            return (
              <div
                key={m.id}
                className={`mb-3 flex items-end gap-2 ${
                  mine ? "justify-end" : "justify-start"
                }`}
              >
                {!mine && (
                  <img
                    src={avatar}
                    alt={name}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-[#5B3A1E] text-white" : "bg-white"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className="mt-1 text-[10px] opacity-70">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
                {mine && (
                  <img
                    src={avatar}
                    alt={name}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t bg-white px-3 py-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canSend ? "Type a message…" : "Sign in to send a message"}
          className="flex-1 border rounded-xl px-3 py-2 outline-none"
          disabled={!canSend || sending}
        />
        <button
          type="submit"
          disabled={!canSend || sending || !text.trim()}
          className="rounded-xl bg-[#5B3A1E] text-white px-4 py-2 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
