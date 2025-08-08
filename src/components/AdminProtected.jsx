import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AdminProtected() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Read is_admin from profiles (requires RLS policy to allow self-select)
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setIsAdmin(profile?.is_admin === true);
      setLoading(false);
    };

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  if (loading) return null;             // show spinner if you want
  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
