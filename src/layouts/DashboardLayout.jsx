import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useOutletContext, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Menu, X, CheckCircle } from "lucide-react";
import Logo from "../assets/logo.png";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!u) navigate("/");
      else setUser(u);
      setLoading(false);
    })();
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#2A1E14]">
      {/* ===== Top Header ===== */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#F7F0E6]/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile: open sidebar */}
            <button
              className="md:hidden -ml-1 p-2 rounded hover:bg-black/5"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <Link to="/" className="flex items-center gap-2">
              <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
              <span className="font-extrabold text-xl tracking-tight">Gida</span>
            </Link>
          </div>

          <nav className="hidden sm:flex items-center gap-6">
            <HeaderLink to="/listings">Find Room</HeaderLink>
            <HeaderLink to="/app/saved">Saved</HeaderLink>
            <HeaderLink to="/app/inbox">Inbox</HeaderLink>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm opacity-80">{user?.email}</span>
            <button onClick={logout} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-black/5">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ===== Shell: Sidebar + Content ===== */}
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[240px_1fr] gap-0">
        {/* Sidebar (drawer on mobile) */}
        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed z-50 md:static top-16 md:top-0 left-0 h-[calc(100vh-4rem)] md:h-auto w-72 md:w-auto
                       bg-[#FFF6EA] md:bg-transparent border-r md:border-0 border-black/10
                       transform transition-transform duration-200 ease-in-out
                       ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
          aria-label="Sidebar"
        >
          <div className="md:hidden flex items-center justify-between p-4">
            <div className="font-bold">Menu</div>
            <button className="p-2 rounded hover:bg-black/5" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="p-4 md:pt-6">
            <div className="hidden md:flex items-center gap-2 mb-4">
              <span className="text-lg font-semibold">Dashboard</span>
            </div>

            <nav className="flex flex-col gap-1">
              <SideLink to="/app/edit-profile">Edit Profile</SideLink>
              <SideLink to="/app/my-listings">My Listings</SideLink>
              <SideLink to="/app/add-listing">Add Listing</SideLink>
              <SideLink to="/app/saved">Saved Listings</SideLink>
              <SideLink to="/app/inbox">Inbox</SideLink>
            </nav>

            <div className="mt-6">
              <div className="text-sm font-semibold opacity-80">Verification</div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <CheckCircle size={16} className="text-emerald-600" />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-h-[calc(100vh-4rem)] md:min-h-0 px-4 md:px-6 lg:px-8 py-6">
          {/* Inner container for nice readable width */}
          <div className="max-w-5xl">
            {/* Children pages render here */}
            <Outlet context={{ user }} />
          </div>
        </main>
      </div>
    </div>
  );
}

function HeaderLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-sm font-medium hover:opacity-80 ${
          isActive ? "underline underline-offset-4" : ""
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function SideLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg transition hover:bg-black/5 ${
          isActive ? "bg-black/10 font-semibold" : "opacity-90"
        }`
      }
      onClick={() => {
        // close mobile drawer after navigation
        const btn = document.querySelector('button[aria-label="Open menu"]');
        if (btn) btn.click();
      }}
    >
      {children}
    </NavLink>
  );
}

// Hook to use the user in child routes
export const useDashboardUser = () => {
  const { user } = useOutletContext() || {};
  return user;
};
