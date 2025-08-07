// src/lib/createOrGetConversation.js
import { supabase } from "../supabaseClient";

export async function ensureUserHostConversation(listingId, viewerId, hostId) {
  if (!listingId || !viewerId || !hostId) {
    throw new Error("Missing required IDs to create/find conversation.");
  }

  // Find existing convo for this listing with both participants
  const { data: existing, error: findErr } = await supabase
    .from("conversations")
    .select("id, conversation_participants!inner(user_id)")
    .eq("listing_id", listingId);

  if (findErr) throw findErr;

  if (existing?.length) {
    const found = existing.find(c => {
      const ids = (c.conversation_participants || []).map(p => p.user_id);
      return ids.includes(viewerId) && ids.includes(hostId);
    });
    if (found) return found.id;
  }

  // Create convo
  const { data: convo, error: convErr } = await supabase
    .from("conversations")
    .insert([{ type: "user_host", listing_id: listingId }])
    .select("id")
    .single();
  if (convErr || !convo?.id) throw convErr || new Error("Failed to create conversation.");

  // Add viewer FIRST (policy requires this)
  const { error: addViewerErr } = await supabase
    .from("conversation_participants")
    .insert([{ conversation_id: convo.id, user_id: viewerId }]);
  if (addViewerErr) throw addViewerErr;

  // Then add host (allowed because viewer is now in the convo)
  const { error: addHostErr } = await supabase
    .from("conversation_participants")
    .insert([{ conversation_id: convo.id, user_id: hostId }]);
  if (addHostErr) {
    // If duplicate or blocked, we still return the convo so chat can open
    console.warn("Could not add host to conversation:", addHostErr);
  }

  return convo.id;
}
