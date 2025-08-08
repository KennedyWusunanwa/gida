import { Link, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function AdminLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) console.error(uErr);
      if (!mounted) return;

      if (!user) {
        navigate("/admin/signin", { replace: true });
        return;
      }

      const { data: profile, error: pErr, status } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (pErr && status !== 406) {
        console.error(pErr);
        navigate("/admin/signin", { replace: true });
        return;
      }

      if (!profile?.is_admin) {
        navigate("/", { replace: true });
      }
    };

    checkAdmin();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [navigate]);

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
