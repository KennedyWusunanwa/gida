// src/components/UserProtected.jsx
import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useSessionContext } from "@supabase/auth-helpers-react";

export default function UserProtected() {
  const { isLoading, session } = useSessionContext();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="animate-pulse text-black/60">Loading…</div>
      </div>
    );
  }

  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <Outlet />;
}
