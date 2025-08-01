// src/admin/AdminLayout.jsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDashboardUser } from "../layouts/DashboardLayout";

export default function AdminLayout() {
  const user = useDashboardUser();
  const navigate = useNavigate();

  // Gate: only admins should access the routes (your profiles.is_admin is exposed via DashboardLayout hook or fetch it here).
  if (!user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold mb-2">Unauthorized</div>
          <p className="text-black/60">You must be an admin to view this page.</p>
          <button className="mt-4 underline" onClick={() => navigate("/")}>Go home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F2E9]">
      <div className="mx-auto max-w-6xl p-4">
        <div className="rounded-2xl bg-[#FBF3E6] shadow-xl grid grid-cols-1 md:grid-cols-[220px_1fr]">
          <aside className="p-5 border-r border-black/5">
            <div className="text-2xl font-extrabold mb-6">Gida Admin</div>
            <nav className="flex flex-col gap-2">
              <NavLink to="/admin" end className={linkCls}>Overview</NavLink>
              <NavLink to="/admin/users" className={linkCls}>Users</NavLink>
              <NavLink to="/admin/listings" className={linkCls}>Listings</NavLink>
            </nav>
          </aside>
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function linkCls({ isActive }) {
  return `px-3 py-2 rounded-lg ${isActive ? "bg-[#E8DFD0] font-semibold" : "hover:bg-black/5"}`;
}
