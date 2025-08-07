// createOrGetConversation.ts
import { supabase } from "../supabaseClient";

/**
 * Ensures a user↔host conversation exists for this listing, returns conversation_id.
 */
export async function ensureUserHostConversation(listingId: string, viewerId: string, hostId: string) {
  // 1) Try to find existing convo with both participants and this listing
  const { data: existing, error: findErr } = await supabase
    .from("conversations")
    .select("id, listing_id, conversation_participants!inner(user_id)")
    .eq("listing_id", listingId);

  if (!findErr && existing?.length) {
    // pick the one where both viewer & host are participants
    const found = existing.find(c => {
      const ids = (c as any).conversation_participants?.map((p: any) => p.user_id) || [];
      return ids.includes(viewerId) && ids.includes(hostId);
    });
    if (found) return (found as any).id;
  }

  // 2) Create a new conversation
  const { data: convo, error: convErr } = await supabase
    .from("conversations")
    .insert([{ type: "user_host", listing_id: listingId }])
    .select("id")
    .single();
  if (convErr) throw convErr;

  // 3) Add both participants
  const rows = [
    { conversation_id: convo.id, user_id: viewerId },
    { conversation_id: convo.id, user_id: hostId },
  ];
  const { error: addErr } = await supabase.from("conversation_participants").insert(rows);
  if (addErr) throw addErr;

  return convo.id;
}
