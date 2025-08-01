import { Link, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function AdminLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/admin/signin");

      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      if (!profile?.is_admin) return navigate("/");
    };

    checkAdmin();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F0E6] flex flex-col">
      <header className="bg-white shadow p-4">
        <nav className="flex gap-4">
          <Link to="/admin" className="font-bold">Overview</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/listings">Listings</Link>
        </nav>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
