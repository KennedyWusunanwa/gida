import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { Menu, X } from "lucide-react"; // for hamburger icons

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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar (mobile toggle) */}
      <aside
        className={`bg-[#3B2719] text-white w-full md:w-64 p-4 fixed md:static z-40 h-full md:h-auto transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex justify-between items-center md:block">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏠</span>
            <span className="font-bold text-lg">Gida</span>
          </div>
          <button
            className="md:hidden text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 flex flex-col gap-3">
          <NavLink to="/app/my-listings" className="hover:bg-[#5B3A1E] p-2 rounded">My Listings</NavLink>
          <NavLink to="/app/add-listing" className="hover:bg-[#5B3A1E] p-2 rounded">Add Listing</NavLink>
          <NavLink to="/app/saved" className="hover:bg-[#5B3A1E] p-2 rounded">Saved Listings</NavLink>
          <NavLink to="/app/inbox" className="hover:bg-[#5B3A1E] p-2 rounded">Inbox</NavLink>
          <NavLink to="/app/edit-profile" className="hover:bg-[#5B3A1E] p-2 rounded">Edit Profile</NavLink>
        </nav>

        <div className="mt-6 flex items-center gap-2 text-sm opacity-80">
          <span className="h-2 w-2 bg-green-500 rounded-full"></span>
          Verified
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-[#F7F0E6] border-b border-black/10 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <strong>Find Room</strong>
            <NavLink to="/app/saved" className="hidden sm:inline hover:underline">Saved</NavLink>
            <NavLink to="/app/inbox" className="hidden sm:inline hover:underline">Inbox</NavLink>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">{user?.email}</span>
            <button
              className="text-sm border px-3 py-1 rounded hover:bg-black/5"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 bg-[#F7F0E6] overflow-x-auto">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}

// hook to use the user in child routes
export const useDashboardUser = () => {
  const { user } = useOutletContext() || {};
  return user;
};
