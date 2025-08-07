import { supabase } from "../supabaseClient";

/**
 * Ensures a conversation exists between the current logged-in user and a host for a given listing.
 * Uses the Supabase RPC `create_conversation_with_participants` to bypass RLS on insert.
 *
 * @param {string} listingId - The ID of the listing.
 * @param {string} viewerId - The ID of the current user (not used by RPC but kept for compatibility).
 * @param {string} hostId - The ID of the host.
 * @returns {Promise<string>} - The conversation ID.
 */
export async function ensureUserHostConversation(listingId, viewerId, hostId) {
  console.log("[ensureUserHostConversation] Starting RPC call...", {
    listingId,
    viewerId,
    hostId,
  });

  // Call the RPC (Supabase will pass auth.uid() automatically)
  const { data, error } = await supabase.rpc(
    "create_conversation_with_participants",
    {
      p_listing_id: listingId,
      p_host_id: hostId,
    }
  );

  if (error) {
    console.error("[ensureUserHostConversation] RPC error:", error);
    throw error;
  }

  console.log("[ensureUserHostConversation] Conversation ID returned:", data);

  return data; // This is the conversation UUID
}
