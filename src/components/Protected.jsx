// src/components/Protected.jsx
import { Outlet, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "../supabaseClient";

export default function Protected() {
  const contextSession = useSession();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      // If the context already has a session, use it
      if (contextSession) {
        setSession(contextSession);
        setLoading(false);
        return;
      }

      // If undefined, fetch it manually from Supabase
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    };

    restoreSession();
    return () => { mounted = false; };
  }, [contextSession]);

  if (loading) return <p>Loading…</p>;
  if (!session) return <Navigate to="/auth" replace />;
  return <Outlet />;
}
