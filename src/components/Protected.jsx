import { Outlet, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Protected() {
  const [loading, setLoading] = useState(true);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) console.error("Protected getUser error:", error);
        if (!mounted) return;
        setHasUser(!!user);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setHasUser(!!session?.user);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  if (loading) return <p>Loading…</p>;
  if (!hasUser) return <Navigate to="/auth" replace />;
  return <Outlet />;
}
