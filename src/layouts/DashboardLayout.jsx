import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./dashboard.css"; // styles below

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="page"><p>Loading…</p></div>;

  return (
    <div className="dash">
      {/* Sidebar */}
      <aside className="dash__sidebar">
        <div className="brand">
          <div className="brand__logo">🏠</div>
          <div className="brand__name">Gida</div>
        </div>

        <nav className="nav">
          <NavLink to="/app/my-listings" className="nav__link">My Listings</NavLink>
          <NavLink to="/app/add-listing" className="nav__link">Add Listing</NavLink>
          <NavLink to="/app/saved" className="nav__link">Saved Listings</NavLink>
          <NavLink to="/app/inbox" className="nav__link">Inbox</NavLink>
          <NavLink to="/app/edit-profile" className="nav__link">Edit Profile</NavLink>
        </nav>

        <div className="verified">
          <span className="dot" /> Verified
        </div>
      </aside>

      {/* Main area */}
      <div className="dash__main">
        <header className="dash__header">
          <div className="header__left">
            <strong>Find Room</strong>
            <NavLink to="/app/saved" className="header__link">Saved</NavLink>
            <NavLink to="/app/inbox" className="header__link">Inbox</NavLink>
          </div>
          <div className="header__right">
            <span className="user">{user?.email}</span>
            <button className="btn btn--ghost" onClick={logout}>Logout</button>
          </div>
        </header>

        <main className="dash__content">
          {/* Pass user down to pages */}
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}

// hook to use the user in child routes
export const useDashboardUser = () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user } = require("react-router-dom").useOutletContext() || {};
  return user;
};
