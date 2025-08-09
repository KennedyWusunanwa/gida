import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminProtected() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;

        if (!user) {
          setIsAdmin(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (error) console.error("AdminProtected profiles error:", error);
        setIsAdmin(profile?.is_admin === true);
      } catch (e) {
        console.error("AdminProtected fatal:", e);
        setIsAdmin(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) return <p>Loading admin…</p>;
  if (!isAdmin) return <Navigate to="/admin/signin" replace />;
  return <Outlet />;
}
