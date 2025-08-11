import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";

// Ghana regions → major cities (representative list)
const GH_LOCATIONS = {
  "Greater Accra": ["Accra", "Tema", "Madina", "Adenta", "Teshie", "Nungua", "Spintex", "Dansoman"],
  "Ashanti": ["Kumasi", "Ejisu", "Obuasi", "Tafo", "Asokwa"],
  "Western": ["Sekondi-Takoradi", "Tarkwa"],
  "Central": ["Cape Coast", "Kasoa", "Elmina", "Mankessim"],
  "Eastern": ["Koforidua", "Nsawam", "Akosombo"],
  "Northern": ["Tamale", "Savelugu"],
  "Volta": ["Ho", "Hohoe", "Sogakope"],
  "Upper East": ["Bolgatanga", "Navrongo"],
  "Upper West": ["Wa"],
  "Bono": ["Sunyani", "Berekum"],
  "Bono East": ["Techiman", "Kintampo"],
  "Ahafo": ["Goaso"],
  "Western North": ["Sefwi Wiawso", "Bibiani"],
  "Oti": ["Dambai", "Jasikan"],
  "Savannah": ["Damongo"],
  "North East": ["Nalerigu"],
};

const BEDROOMS = [
  { label: "Any", value: "" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "5+", value: "5plus" },
];

// Ghana-leaning amenity set
const AMENITIES = [
  "Wi-Fi",
  "AC",
  "Washer",
  "Parking",
  "Kitchen",
  "Wardrobe",
  "Security",
  "Good road",
  "Ghana Water",
  "Running water",
  "Borehole",
];

export default function Listings() {
  const [params, setParams] = useSearchParams();

  // Unread badge for header
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);

  // Filters/state (URL-synced)
  const [search, setSearch] = useState(params.get("q") || "");
  const [region, setRegion] = useState(params.get("region") || "");
  const [city, setCity] = useState(params.get("city") || "");
  const [beds, setBeds] = useState(params.get("beds") || "");
  const [amenity, setAmenity] = useState(params.get("amenity") || "");
  const [min, setMin] = useState(params.get("min") || "");
  const [max, setMax] = useState(params.get("max") || "");
  const [mobileOpen, setMobileOpen] = useState(false);

  const [data, setData] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth + unread badge
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUser(u);
      if (u?.id) refreshUnread(u.id);
    })();
  }, []);
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`listings-unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refreshUnread(user.id)
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id]);
  async function refreshUnread(uid) {
    const { data, error } = await supabase
      .from("inbox_threads")
      .select("has_unread")
      .eq("me_id", uid);
    if (!error) setUnread((data || []).filter((t) => t.has_unread).length);
  }

  // Keep state in sync on back/forward
  useEffect(() => {
    setSearch(params.get("q") || "");
    setRegion(params.get("region") || "");
    setCity(params.get("city") || "");
    setBeds(params.get("beds") || "");
    setAmenity(params.get("amenity") || "");
    setMin(params.get("min") || "");
    setMax(params.get("max") || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  // Write filters to URL
  const applyFiltersToURL = () => {
    const next = new URLSearchParams();
    if (search) next.set("q", search.trim());
    if (region) next.set("region", region);
    if (city) next.set("city", city.trim());
    if (beds) next.set("beds", beds);
    if (amenity) next.set("amenity", amenity);
    if (min !== "") next.set("min", String(min).trim());
    if (max !== "") next.set("max", String(max).trim());
    setParams(next, { replace: true });
  };
  const onSearch = (e) => { e?.preventDefault?.(); applyFiltersToURL(); };
  useEffect(() => {
    const t = setTimeout(() => applyFiltersToURL(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, region, city, beds, amenity, min, max]);

  // Fetch when URL changes
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setErr(null);

      let query = supabase
        .from("listings")
        .select(
          "id, title, description, city, location, price, price_ghs, image_url, property_type, room_type, amenities, bedrooms, is_published, created_at"
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      // Keyword
      const qParam = params.get("q");
      if (qParam) {
        const escaped = qParam.replace(/[%_]/g, (m) => `\\${m}`);
        query = query.or(
          `title.ilike.%${escaped}%,description.ilike.%${escaped}%,location.ilike.%${escaped}%`
        );
      }

      // City filter (region is UI-only unless you have a column)
      const cityParam = params.get("city");
      if (cityParam) query = query.ilike("city", `%${cityParam}%`);

      // Price min/max (0 allowed)
      const hasMin = params.has("min");
      const hasMax = params.has("max");
      const effMin = hasMin ? Number(params.get("min") || 0) : null;
      const effMax = hasMax ? Number(params.get("max")) : null;
      if (effMin !== null && !Number.isNaN(effMin)) query = query.gte("price_ghs", effMin);
      if (effMax !== null && !Number.isNaN(effMax)) query = query.lte("price_ghs", effMax);

      // Bedrooms
      const bedsParam = params.get("beds");
      if (bedsParam) {
        if (bedsParam === "5plus") query = query.gte("bedrooms", 5);
        else query = query.eq("bedrooms", Number(bedsParam));
      }

      // Amenity (single)
      const amenityParam = params.get("amenity");
      if (amenityParam) query = query.contains("amenities", [amenityParam]);

      const { data, error } = await query;
      if (error) setErr(error.message);
      else setData(data || []);
      setLoading(false);
    };

    fetchListings();
  }, [params]);

  // Visible cities for chosen region
  const citiesForRegion = useMemo(() => (region ? GH_LOCATIONS[region] || [] : []), [region]);

  // Cards
  const cards = useMemo(() => {
    return data.map((item) => {
      const priceValue = item.price_ghs ?? item.price;
      const title = item.title || `${item.bedrooms ? `${item.bedrooms} BR` : (item.room_type || "Room")} • ${item.city || item.location || "—"}`;
      const badge = priceValue != null ? `GH₵ ${Number(priceValue).toLocaleString()}` : null;

      const img =
        item?.image_url && item.image_url.startsWith("http")
          ? item.image_url
          : item?.image_url || "/images/placeholder.jpg";

      return (
        <Link
          to={`/listings/${item.id}`}
          key={item.id}
          className="bg-white rounded-2xl overflow-hidden shadow hover:shadow-lg transition"
        >
          <div className="relative h-52">
            <img src={img} alt={title} className="w-full h-full object-cover" />
            {badge && (
              <span className="absolute top-3 right-3 bg-[#5B3A1E] text-white text-sm px-3 py-1 rounded-xl">
                {badge}
              </span>
            )}
          </div>
          <div className="p-4">
            <h4 className="text-lg font-bold">{title}</h4>
            <div className="mt-2 text-sm text-[#3B2719] space-y-1">
              <div className="flex items-center gap-2">
                <span>🛏</span>
                <span>{item.bedrooms ? `${item.bedrooms} bedroom${item.bedrooms > 1 ? "s" : ""}` : (item.room_type || "Room")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🏢</span>
                <span>{item.property_type || "Apartment"}</span>
              </div>
              {Array.isArray(item.amenities) && item.amenities.length > 0 && (
                <div className="flex items-center gap-2">
                  <span>✔️</span>
                  <span className="truncate">{item.amenities.slice(0, 3).join(", ")}{item.amenities.length > 3 ? "…" : ""}</span>
                </div>
              )}
            </div>
          </div>
        </Link>
      );
    });
  }, [data]);

  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      {/* Header (matches Home; includes Messages with orange unread badge) */}
      <header className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl">Gida</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/roommate-matching" className="hover:opacity-70">Roommate Matching</Link>
            <Link to="/listings" className="hover:opacity-70">Listings</Link>
            <Link to="/app/inbox" className="relative hover:opacity-70">
              Messages
              {unread > 0 && (
                <span className="absolute -right-3 -top-2 rounded-full bg-orange-500 text-white text-[10px] px-2 py-0.5">
                  {unread}
                </span>
              )}
            </Link>
            <Link to="/app/my-listings" className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90">
              View Dashboard
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/20"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6.225 4.811 4.811 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.811z"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`${mobileOpen ? "block" : "hidden"} md:hidden border-t border-black/10`}>
          <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            <Link to="/roommate-matching" className="py-2 hover:opacity-70" onClick={() => setMobileOpen(false)}>Roommate Matching</Link>
            <Link to="/listings" className="py-2 hover:opacity-70" onClick={() => setMobileOpen(false)}>Listings</Link>
            <Link to="/app/inbox" className="py-2 hover:opacity-70" onClick={() => setMobileOpen(false)}>Messages {unread > 0 && <span className="ml-2 rounded-full bg-orange-500 text-white text-[10px] px-2 py-0.5">{unread}</span>}</Link>
            <Link to="/app/my-listings" className="rounded-xl px-4 py-2 bg-[#3B2719] text-white text-center" onClick={() => setMobileOpen(false)}>View Dashboard</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Search */}
        <form onSubmit={onSearch} className="bg-white rounded-2xl p-3 shadow flex flex-col md:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keyword (e.g. '2 bedroom in Accra')"
            className="flex-1 rounded-xl border border-black/10 px-4 py-3 outline-none"
          />
          <input
            type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)}
            placeholder="Min budget (GHS)"
            className="w-full md:w-48 rounded-xl border border-black/10 px-4 py-3 outline-none"
          />
          <input
            type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)}
            placeholder="Max budget (GHS)"
            className="w-full md:w-48 rounded-xl border border-black/10 px-4 py-3 outline-none"
          />
          <button type="submit" className="rounded-xl bg-[#5B3A1E] text-white px-6 py-3 font-semibold hover:opacity-95">
            Search
          </button>
        </form>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Region */}
          <select value={region} onChange={(e) => { setRegion(e.target.value); setCity(""); }} className="rounded-xl border px-4 py-3 bg-white">
            <option value="">Region</option>
            {Object.keys(GH_LOCATIONS).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* City (depends on region; still editable even without region) */}
          <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl border px-4 py-3 bg-white">
            <option value="">City</option>
            {(region ? citiesForRegion : Object.values(GH_LOCATIONS).flat()).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Bedrooms */}
          <select value={beds} onChange={(e) => setBeds(e.target.value)} className="rounded-xl border px-4 py-3 bg-white">
            {BEDROOMS.map((b) => <option key={b.value} value={b.value}>{b.label} bedroom{b.value && b.value !== "1" ? "s" : ""}</option>)}
          </select>

          {/* Amenity */}
          <select value={amenity} onChange={(e) => setAmenity(e.target.value)} className="rounded-xl border px-4 py-3 bg-white">
            <option value="">Amenity</option>
            {AMENITIES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Listings Grid */}
        <section className="mt-6">
          {err && <p className="text-red-600">{err}</p>}
          {loading ? (
            <p className="opacity-70">Loading…</p>
          ) : data.length === 0 ? (
            <p className="opacity-70">No listings found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
