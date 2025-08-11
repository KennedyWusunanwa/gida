// src/components/AdminProtected.jsx
import React, { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useSessionContext, useSupabaseClient } from "@supabase/auth-helpers-react";

export default function AdminProtected() {
  const { isLoading, session } = useSessionContext();
  const supabase = useSupabaseClient();
  const location = useLocation();
  const [roleOk, setRoleOk] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!session) { setChecking(false); return; }
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!ignore) {
        setRoleOk(Boolean(data?.is_admin) && !error);
        setChecking(false);
      }
    })();
    return () => { ignore = true; };
  }, [session, supabase]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-pulse text-black/60">Loading…</div>
      </div>
    );
  }

  if (!session || !roleOk) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/signin?next=${next}`} replace />;
  }

  return <Outlet />;
}
