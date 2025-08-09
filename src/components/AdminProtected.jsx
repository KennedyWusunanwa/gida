// src/components/AdminProtected.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "../supabaseClient";

export default function AdminProtected() {
  const session = useSession(); // undefined during first render
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (session === undefined) return; // provider not ready yet
      if (!session?.user) {
        setOk(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) console.error("AdminProtected profile error:", error);

      setOk(data?.is_admin === true);
      setLoading(false);
    };

    run();
    return () => {
      mounted = false;
    };
  }, [session]);

  if (session === undefined || loading) return <p>Loading admin…</p>;
  if (!ok) return <Navigate to="/admin/signin" replace />;
  return <Outlet />;
}
