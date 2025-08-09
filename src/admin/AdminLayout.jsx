import { NavLink, Outlet, useNavigate } from "react-router-dom";

export default function AdminLayout() {
  const navigate = useNavigate();

  const linkBase =
    "px-2 py-1 rounded-md transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/10";
  const linkActive = "font-bold text-[#5B3A1E] bg-black/5";
  const linkInactive = "text-black/80";

  return (
    <div className="min-h-screen bg-[#F7F0E6] flex flex-col">
      {/* Sticky, elevated header */}
      <header className="sticky top-0 z-40 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Left: Title + Nav */}
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-extrabold tracking-tight text-[#5B3A1E]">
              Admin
            </h1>

            <nav className="flex items-center gap-1">
              <NavLink
                to="/admin"
                end
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Overview
              </NavLink>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Users
              </NavLink>
              <NavLink
                to="/admin/listings"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? linkActive : linkInactive}`
                }
              >
                Listings
              </NavLink>
            </nav>
          </div>

          {/* Right: Jump to User Dashboard */}
          <button
            onClick={() => navigate("/app/my-listings")}
            className="rounded-lg bg-[#5B3A1E] text-white px-4 py-2 font-semibold hover:opacity-90"
          >
            Go to User Dashboard
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
