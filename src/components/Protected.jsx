// src/components/Protected.jsx
import { Outlet, Navigate } from "react-router-dom";
import { useSession } from "@supabase/auth-helpers-react";

export default function Protected() {
  const session = useSession(); // undefined first render

  if (session === undefined) return <p>Loading…</p>;
  if (!session) return <Navigate to="/auth" replace />;
  return <Outlet />;
}
