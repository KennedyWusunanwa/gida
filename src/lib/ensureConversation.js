import { supabase } from "../supabaseClient";

/** Ensures there is a 1:1 conversation between the current user and `otherUserId`. */
export async function ensureConversationWith(otherUserId) {
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const me = u?.user?.id;
  if (!me) throw new Error("Not signed in");
  if (!otherUserId) throw new Error("Missing other user id");

  const { data, error } = await supabase.rpc("ensure_conversation", { a: me, b: otherUserId });
  if (error) throw error;
  return data; // conversation UUID
}
