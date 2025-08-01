// src/components/AdminProtected.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "@supabase/auth-helpers-react";

export default function AdminProtected() {
  const session = useSession();

  // If user is not logged in
  if (!session) return <Navigate to="/" replace />;

  // SIMPLE CHECK: Allow only if email matches admin
  const isAdmin = session.user?.email === "admin@gida.com"; // 👈 Replace with your actual admin email

  // If not admin, redirect to normal auth page
  if (!isAdmin) return <Navigate to="/auth" replace />;

  return <Outlet />;
}
