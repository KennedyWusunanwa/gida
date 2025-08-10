// src/components/UserProtected.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "@supabase/auth-helpers-react";

export default function UserProtected() {
  const session = useSession();

  // Show loading until Supabase finishes restoring session
  if (session === undefined) return <p>Loading…</p>;
  if (!session) return <Navigate to="/auth" replace />;

  return <Outlet />;
}
