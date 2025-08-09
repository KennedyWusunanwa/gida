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
      <header className="bg-white shadow p-4 flex items-center justify-between">
        {/* Left side: Title + Nav */}
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-[#5B3A1E]">Admin</h1>
          <nav className="flex gap-4">
            <Link to="/admin" className="font-bold">Overview</Link>
            <Link to="/admin/users">Users</Link>
            <Link to="/admin/listings">Listings</Link>
          </nav>
        </div>

        {/* Right side: Go to User Dashboard */}
        <button
          onClick={() => navigate("/app/my-listings")}
          className="rounded-lg bg-[#5B3A1E] text-white px-4 py-2 hover:opacity-90"
        >
          Go to User Dashboard
        </button>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
