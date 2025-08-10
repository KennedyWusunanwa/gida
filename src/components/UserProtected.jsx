import { Navigate, Outlet } from "react-router-dom";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

export default function UserProtected() {
  const ctxSession = useSession();               // can be undefined on first paint
  const supabase = useSupabaseClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      // if context already has a value (null or object), we can decide
      if (ctxSession !== undefined) {
        if (mounted) {
          setSession(ctxSession || null);
          setReady(true);
        }
        return;
      }
      // fallback: read persisted session directly
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session || null);
        setReady(true);
      }
    };
    hydrate();
    return () => { mounted = false; };
  }, [ctxSession, supabase]);

  if (!ready) return <p>Loading…</p>;
  if (!session) return <Navigate to="/auth" replace />;
  return <Outlet />;
}
