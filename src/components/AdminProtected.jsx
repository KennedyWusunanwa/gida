import { Navigate, Outlet } from "react-router-dom";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

export default function AdminProtected() {
  const ctxSession = useSession();
  const supabase = useSupabaseClient();
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      // hydrate session (same pattern as user)
      let session = ctxSession;
      if (session === undefined) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      }
      if (!session?.user) {
        if (mounted) { setOk(false); setReady(true); }
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();

      if (mounted) {
        if (error) console.error("AdminProtected profile error:", error);
        setOk(profile?.is_admin === true);
        setReady(true);
      }
    };

    run();
    return () => { mounted = false; };
  }, [ctxSession, supabase]);

  if (!ready) return <p>Loading admin…</p>;
  if (!ok) return <Navigate to="/admin/signin" replace />;
  return <Outlet />;
}
