import { supabase } from "../supabaseClient";

/**
 * Ensures there is a conversation (type=user_host) for this listing between viewer and host.
 * Returns conversation_id.
 */
export async function ensureUserHostConversation(listingId, viewerId, hostId) {
  // Try to find an existing conversation for this listing that both users are in
  const { data: existingConvos, error: findErr } = await supabase
    .from("conversations")
    .select(
      `
      id,
      listing_id,
      conversation_participants:conversation_participants!inner(user_id)
    `
    )
    .eq("listing_id", listingId);

  if (!findErr && existingConvos?.length) {
    const found = existingConvos.find((c) => {
      const ids = (c.conversation_participants || []).map((p) => p.user_id);
      return ids.includes(viewerId) && ids.includes(hostId);
    });
    if (found) return found.id;
  }

  // Create new conversation
  const { data: convo, error: convErr } = await supabase
    .from("conversations")
    .insert([{ type: "user_host", listing_id: listingId }])
    .select("id")
    .single();
  if (convErr) throw convErr;

  // Add both participants
  const rows = [
    { conversation_id: convo.id, user_id: viewerId },
    { conversation_id: convo.id, user_id: hostId },
  ];
  const { error: addErr } = await supabase
    .from("conversation_participants")
    .insert(rows);
  if (addErr) throw addErr;

  return convo.id;
}
