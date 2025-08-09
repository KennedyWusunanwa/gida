import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";
import HIWSignup from "../assets/hiw-signup.png";
import HIWSearch from "../assets/hiw-search.png";
import HIWConnect from "../assets/hiw-connect.png";
import ImgAccra from "../assets/accra.jpg";
import ImgKumasi from "../assets/kumasi.jpg";
import ImgTakoradi from "../assets/takoradi.jpg";

export default function Home() {
  const navigate = useNavigate();

  // Search form state
  const [searchText, setSearchText] = useState("");
  const [city, setCity] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");

  // Featured listings (optional UI)
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, image_url, price_ghs, created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (!cancelled) {
        if (error) setErr(error.message);
        else setFeatured(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (searchText.trim()) qs.set("q", searchText.trim());
    if (city.trim()) qs.set("city", city.trim());

    // NOTE: treat empty string as "not set", but allow "0"
    const hasMin = minBudget !== "" && minBudget !== null;
    const hasMax = maxBudget !== "" && maxBudget !== null;

    if (hasMin) qs.set("min", String(minBudget));
    if (hasMax) qs.set("max", String(maxBudget));

    navigate(`/listings?${qs.toString()}`);
  };

  const cardImg = (fallback) =>
    typeof fallback === "string" && fallback.startsWith("http")
      ? fallback
      : "/images/placeholder.jpg";

  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl">Gida</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/app/my-listings" className="hover:opacity-70">Dashboard</Link>
            <Link to="/app/add-listing" className="hover:opacity-70">List Your Space</Link>
          </nav>
        </div>
      </header>

      {/* Hero / Search */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="bg-white rounded-2xl p-4 md:p-6 shadow">
          <h1 className="text-2xl md:text-3xl font-extrabold mb-3">Find a room or roommate</h1>
          <form onSubmit={onSubmit} className="flex flex-col md:flex-row gap-3">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Keyword (e.g. '2 bedroom, Osu')"
              className="flex-1 rounded-xl border border-black/10 px-4 py-3 outline-none"
            />
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-xl border px-4 py-3 bg-white"
            >
              <option value="">Location</option>
              <option value="Accra">Accra</option>
              <option value="Kumasi">Kumasi</option>
              <option value="Takoradi">Takoradi</option>
            </select>
            <input
              type="number"
              min="0"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
              placeholder="Min (GHS)"
              className="rounded-xl border border-black/10 px-4 py-3 outline-none w-full md:w-44"
            />
            <input
              type="number"
              min="0"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              placeholder="Max (GHS)"
              className="rounded-xl border border-black/10 px-4 py-3 outline-none w-full md:w-44"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#5B3A1E] text-white px-6 py-3 font-semibold hover:opacity-95"
            >
              Search
            </button>
          </form>
        </section>

        {/* Popular / Featured */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">Popular Listings</h2>
            <Link to="/listings" className="text-[#5B3A1E] hover:underline">View all</Link>
          </div>

          {err && <p className="text-red-600">{err}</p>}
          {loading ? (
            <p className="opacity-70">Loading…</p>
          ) : !featured.length ? (
            <p className="opacity-70">No featured listings yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((it) => (
                <Link
                  to={`/listings/${it.id}`}
                  key={it.id}
                  className="bg-white rounded-2xl overflow-hidden shadow hover:shadow-lg transition"
                >
                  <div className="relative h-48">
                    <img
                      src={cardImg(it.image_url)}
                      alt={it.title || "Listing"}
                      className="w-full h-full object-cover"
                    />
                    {typeof it.price_ghs === "number" && (
                      <span className="absolute top-3 right-3 bg-[#5B3A1E] text-white text-sm px-3 py-1 rounded-xl">
                        GH₵ {Number(it.price_ghs).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="text-lg font-bold">
                      {it.title || `Room • ${it.city || "—"}`}
                    </h4>
                    <p className="text-sm opacity-70">{it.city || "—"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* How it works (kept simple) */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[{img: HIWSignup, title: "Sign up"}, {img: HIWSearch, title: "Search"}, {img: HIWConnect, title: "Connect"}].map((x) => (
            <div key={x.title} className="bg-white rounded-2xl p-5 shadow flex items-center gap-4">
              <img src={x.img} alt={x.title} className="w-12 h-12 object-contain" />
              <div>
                <p className="font-semibold">{x.title}</p>
                <p className="text-sm opacity-70">Easy steps to your next home.</p>
              </div>
            </div>
          ))}
        </section>

        {/* City tiles */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[{img: ImgAccra, c: "Accra"}, {img: ImgKumasi, c: "Kumasi"}, {img: ImgTakoradi, c: "Takoradi"}].map((x) => (
            <Link
              key={x.c}
              to={`/listings?city=${encodeURIComponent(x.c)}`}
              className="rounded-2xl overflow-hidden shadow hover:shadow-lg transition relative h-40"
            >
              <img src={x.img} alt={x.c} className="w-full h-full object-cover" />
              <span className="absolute bottom-2 left-2 bg-white/90 rounded px-2 py-1 text-sm font-semibold">
                {x.c}
              </span>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
