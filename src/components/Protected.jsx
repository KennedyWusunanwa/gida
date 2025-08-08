import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Protected() {
  const [loading, setLoading] = useState(true);
  const [allow, setAllow] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user) {
        setAllow(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      // Only NON-admins can access /app
      setAllow(profile?.is_admin === false);
      setLoading(false);
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, [location.pathname]);

  if (loading) return null; // or a loader
  if (!allow) return <Navigate to="/admin" replace />; // Admins bounce to /admin; unauthed will be caught by your /auth route elsewhere if desired

  return <Outlet />;
}
