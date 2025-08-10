// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

import Logo from "../assets/logo.png";
import HIWSignup from "../assets/hiw-signup.png";
import HIWSearch from "../assets/hiw-search.png";
import HIWConnect from "../assets/hiw-connect.png";
import Cloth from "../assets/cloth.png"; // <-- add this file

export default function Home() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [city, setCity] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [q, setQ] = useState("");

  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const inboxPath = "/app/inbox";
  const inboxHref = user ? inboxPath : `/auth?next=${encodeURIComponent(inboxPath)}`;

  const display = (v, fallback = "—") =>
    v === null || v === undefined || v === "" ? fallback : v;

  const extractPrice = (row) => {
    const candidates = [row?.price_ghs, row?.price, row?.monthly_price, row?.rent, row?.amount];
    for (const v of candidates) {
      if (v == null) continue;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
    return null;
  };

  // auth
  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      sub = supabase.auth
        .onAuthStateChange((_ev, session) => setUser(session?.user ?? null))
        .data.subscription;
    })();
    return () => sub?.unsubscribe();
  }, []);

  // featured listings
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase.rpc("get_random_featured_listings", { count: 3 });
      if (error) setErr(error.message);
      setFeatured(data || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const submitPrimary = (e) => {
    e.preventDefault();
    if (min !== "" && max !== "" && Number(min) > Number(max)) {
      alert("Budget Min cannot be greater than Budget Max.");
      return;
    }
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (min !== "") params.set("min", String(Number(min)));
    if (max !== "") params.set("max", String(Number(max)));
    navigate(`/listings?${params.toString()}`);
  };

  const submitAI = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    navigate(`/listings?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#2A1E14]">
      {/* NAV */}
      <nav className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl tracking-tight">Gida</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/roommate-matching" className="hover:opacity-70">Roommate Matching</Link>
            <Link to="/listings" className="hover:opacity-70">Listings</Link>
            <Link to={inboxHref} className="hover:opacity-70">Messages</Link>

            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/app/my-listings" className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90">
                  View Dashboard
                </Link>
                <button
                  onClick={async () => { await supabase.auth.signOut(); setUser(null); }}
                  className="text-sm underline underline-offset-4 hover:opacity-70"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/auth" className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90">
                Sign Up
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/20"
            aria-label="Open menu"
            aria-expanded={mobileOpen ? "true" : "false"}
            onClick={() => setMobileOpen((s) => !s)}
          >
            {!mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <div className="md:hidden border-t border-black/10" role="dialog" aria-modal="true">
            <div className="px-4 py-3 space-y-1 bg-[#F7F0E6]">
              <Link to="/roommate-matching" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-black/5">Roommate Matching</Link>
              <Link to="/listings" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-black/5">Listings</Link>
              <Link to={inboxHref} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-black/5">Messages</Link>
              {user ? (
                <>
                  <Link to="/app/my-listings" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 bg-[#3B2719] text-white text-center mt-2">View Dashboard</Link>
                  <button
                    onClick={async () => { setMobileOpen(false); await supabase.auth.signOut(); setUser(null); }}
                    className="w-full text-left rounded-lg px-3 py-2 underline underline-offset-4 hover:bg-black/5"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/auth" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 bg-[#3B2719] text-white text-center mt-2">Sign Up</Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* MAIN */}
      <main className="mx-auto max-w-6xl px-4">
        {/* HERO with cloth wedges */}
        <section className="relative pt-12 pb-10 overflow-hidden">
          {/* Left wedge (desktop only) */}
          <div
            aria-hidden
            className="hidden md:block absolute inset-y-0 left-0 w-[38vw] max-w-[420px] z-0 pointer-events-none"
          >
            <div
              className="absolute -left-10 top-0 h-[130%] w-[130%]"
              style={{
                backgroundImage: `url(${Cloth})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                clipPath: "polygon(0 0, 100% 0, 0 100%)",
                filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.15))",
              }}
            />
          </div>

          {/* Right wedge (desktop only) */}
          <div
            aria-hidden
            className="hidden md:block absolute inset-y-0 right-0 w-[38vw] max-w-[420px] z-0 pointer-events-none"
          >
            <div
              className="absolute -right-10 top-0 h-[130%] w-[130%]"
              style={{
                backgroundImage: `url(${Cloth})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                transform: "scaleX(-1)", // mirror for symmetry
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.15))",
              }}
            />
          </div>

          {/* Hero content */}
          <div className="relative z-10">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-center">
              Find your Gida,<br className="hidden md:block" />
              <span> find your people.</span>
            </h1>

            {/* PRIMARY SEARCH */}
            <form onSubmit={submitPrimary} className="mt-8 mx-auto w-full md:w-[920px] bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-3">
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-center">
                <label className="sr-only" htmlFor="city">City</label>
                <input
                  id="city"
                  type="text"
                  placeholder="Location (e.g., Accra, Kumasi, East Legon)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="min-w-0 rounded-xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                />
                <label className="sr-only" htmlFor="min">Budget Min (GHS)</label>
                <input
                  id="min"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="Budget Min (GHS)"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                  className="min-w-0 rounded-xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                />
                <label className="sr-only" htmlFor="max">Budget Max (GHS)</label>
                <input
                  id="max"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="Budget Max (GHS)"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  className="min-w-0 rounded-xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                />
                <button type="submit" className="rounded-xl bg-[#3B2719] text-white px-6 py-3 font-semibold hover:opacity-90 whitespace-nowrap">
                  Search
                </button>
              </div>
            </form>

            {/* AI SEARCH */}
            <form onSubmit={submitAI} className="mt-3 mx-auto w-full md:w-[920px] bg-white rounded-2xl p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="aiq">Search by description</label>
                <input
                  id="aiq"
                  type="text"
                  placeholder='Try: "Self-contained in East Legon under 1500 cedis, no smoking"'
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-black/10 px-4 py-3 outline-none focus:ring-2 focus:ring-black/10"
                />
                <button type="submit" className="rounded-xl bg-[#3B2719] text-white px-6 py-3 font-semibold hover:opacity-90 whitespace-nowrap">
                  Search by Description
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-10">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center">How it Works</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <img src={HIWSignup} alt="Sign Up" className="h-36 object-contain" />
              <p className="mt-4 text-lg font-semibold">Sign Up</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <img src={HIWSearch} alt="Search" className="h-36 object-contain" />
              <p className="mt-4 text-lg font-semibold">Search Rooms or<br />List Your Space</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <img src={HIWConnect} alt="Connect" className="h-36 object-contain" />
              <p className="mt-4 text-lg font-semibold">Connect<br />with Roommates or Renters</p>
            </div>
          </div>
        </section>

        {/* POPULAR LISTINGS */}
        <section className="py-6 pb-16">
          <h3 className="text-2xl md:text-3xl font-extrabold">Popular Listings</h3>
          {err && <p className="mt-3 text-red-600">{err}</p>}
          {loading && <p className="mt-3 opacity-70">Loading listings…</p>}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((item) => {
              const img =
                item?.image_url?.startsWith?.("http")
                  ? item.image_url
                  : item?.image_url || "/images/placeholder.jpg";
              const priceNum = extractPrice(item);
              const cityLoc = [item?.location, item?.city].filter(Boolean).join(", ");

              return (
                <Link
                  to={`/listings/${item.id}`}
                  key={item.id}
                  className="bg-white rounded-2xl overflow-hidden shadow hover:shadow-lg transition"
                >
                  <div className="relative h-48">
                    <img src={img} alt={display(item?.title, "Listing")} className="w-full h-full object-cover" />
                    {priceNum !== null && (
                      <div className="absolute top-2 right-2 bg-[#3B2719] text-white text-sm px-3 py-1 rounded-full">
                        GH₵ {priceNum.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h4 className="text-base font-bold truncate">
                      {display(item?.title, "Untitled listing")}
                    </h4>
                    <div className="text-sm text-black/80">{display(cityLoc)}</div>

                    <div className="text-sm text-black/80 grid grid-cols-1 gap-1">
                      <div className="flex items-center gap-1">
                        <span>🛏</span>
                        <span>{display(item?.room_type)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>🏢</span>
                        <span>{display(item?.property_type)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>👤</span>
                        <span>{display(item?.gender_pref, "Any gender")}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-black/10 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={Logo} alt="Gida" className="h-6 w-6 object-contain" />
            <span className="font-bold">Gida</span>
          </div>
          <p className="text-sm opacity-70">© {new Date().getFullYear()} Gida. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
