import { Outlet, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Protected() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(user ?? null);
        if (!user) return;

        const { data: profile, error } = await supabase
          .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
        if (error) console.error("Protected profiles error:", error);
        setIsAdmin(profile?.is_admin === true);
      } catch (e) {
        console.error("Protected fatal:", e);
        setUser(null); setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  if (loading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}
