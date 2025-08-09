import { Link, Outlet, useNavigate } from "react-router-dom";

export default function AdminLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F0E6] flex flex-col">
      <header className="bg-white shadow p-4 flex items-center justify-between">
        {/* Left: Title + Nav */}
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-[#5B3A1E]">Admin</h1>
          <nav className="flex gap-4">
            <Link to="/admin" className="font-bold">Overview</Link>
            <Link to="/admin/users">Users</Link>
            <Link to="/admin/listings">Listings</Link>
          </nav>
        </div>

        {/* Right: Jump to User Dashboard */}
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
