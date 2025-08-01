import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";

import Logo from "../../assets/logo.png";


const PRICE_BUCKETS = [
  { label: "Any", value: "" },
  { label: "≤ 600", value: "0-600" },
  { label: "600 – 1,000", value: "600-1000" },
  { label: "1,000 – 1,500", value: "1000-1500" },
  { label: "≥ 1,500", value: "1500-" },
];

const AMENITIES = ["Wi-Fi", "AC", "Washer", "Parking", "Kitchen"];

export default function Listings() {
  const [params, setParams] = useSearchParams();

  // form state seeded from URL
  const [q, setQ] = useState(params.get("q") || params.get("city") || "");
  const [price, setPrice] = useState(params.get("price") || params.get("max") || "");
  const [amenity, setAmenity] = useState(params.get("amenity") || "");
  const [gender, setGender] = useState(params.get("gender") || "");

  const [data, setData] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  // build URL and push
  const onSearch = (e) => {
    e?.preventDefault?.();
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (price) next.set("price", price);
    if (amenity) next.set("amenity", amenity);
    if (gender) next.set("gender", gender);
    setParams(next);
  };

  // fetch listings each time params change
  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setErr(null);

      let query = supabase
        .from("listings")
        .select(
          "id, title, city, location, price, price_ghs, image_url, property_type, room_type, gender_pref, amenities, is_published, created_at"
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(24);

      // City / search text
      const cityParam = params.get("q") || params.get("city");
      if (cityParam) query = query.ilike("city", `%${cityParam}%`);

      // Price bucket
      const priceParam = params.get("price") || params.get("max");
      if (priceParam) {
        const [minStr, maxStr] = priceParam.split("-");
        const min = minStr ? Number(minStr) : null;
        const max = maxStr ? Number(maxStr) : null;
        // filter both price columns
        if (min !== null) {
          query = query.gte("price", min).gte("price_ghs", min);
        }
        if (max !== null) {
          query = query.lte("price", max).lte("price_ghs", max);
        }
      }

      // Amenities (text[] column)
      const amenityParam = params.get("amenity");
      if (amenityParam) {
        query = query.contains?.("amenities", [amenityParam]) || query;
      }

      // Gender preference
      const genderParam = params.get("gender");
      if (genderParam) {
        query = query.eq("gender_pref", genderParam);
      }

      const { data, error } = await query;
      if (error) setErr(error.message);
      else setData(data || []);
      setLoading(false);
    };

    fetchListings();
  }, [params]);

  // prepare cards
  const cards = useMemo(
    () =>
      data.map((item) => {
        const priceVal = item.price ?? item.price_ghs;
        const title =
          item.title || `Room • ${item.city || item.location || "—"}`;
        const badge =
          priceVal != null
            ? `GH₵ ${Number(priceVal).toLocaleString()}`
            : null;

        return (
          <Link
            to={`/listing/${item.id}`}
            key={item.id}
            className="bg-white rounded-2xl overflow-hidden shadow hover:shadow-lg transition"
          >
            <div className="relative h-52">
              <img
                src={
                  item.image_url?.startsWith("http")
                    ? item.image_url
                    : item.image_url || "/images/placeholder.jpg"
                }
                alt={title}
                className="w-full h-full object-cover"
              />
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
                  <span>🏠</span>
                  <span>{item.room_type || "Private room"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🏢</span>
                  <span>{item.property_type || "Apartment"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>👤</span>
                  <span>{item.gender_pref || "No pref."}</span>
                </div>
              </div>
            </div>
          </Link>
        );
      }),
    [data]
  );

  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      {/* header */}
      <header className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="Gida" className="h-7 w-7" />
            <span className="font-extrabold text-xl">Gida</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/app/my-listings" className="hover:opacity-70">
              Dashboard
            </Link>
            <Link to="/app/add-listing" className="hover:opacity-70">
              List Your Space
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* search */}
        <form
          onSubmit={onSearch}
          className="bg-white rounded-2xl p-3 shadow flex flex-col md:flex-row gap-3"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by location"
            className="flex-1 rounded-xl border border-black/10 px-4 py-3"
          />
          <button className="rounded-xl bg-[#5B3A1E] text-white px-6 py-3 font-semibold hover:opacity-95">
            Search
          </button>
        </form>

        {/* filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 bg-white"
          >
            <option value="">Location</option>
            <option>Accra</option>
            <option>Kumasi</option>
            <option>Takoradi</option>
          </select>
          <select
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 bg-white"
          >
            {PRICE_BUCKETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
          <select
            value={amenity}
            onChange={(e) => setAmenity(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 bg-white"
          >
            <option value="">Amenities</option>
            {AMENITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="rounded-xl border border-black/10 px-4 py-3 bg-white"
          >
            <option value="">Gender pref.</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="No">No</option>
          </select>
        </div>

        {/* results */}
        <section className="mt-6">
          {err && <p className="text-red-600">{err}</p>}
          {loading ? (
            <p className="opacity-70">Loading…</p>
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
