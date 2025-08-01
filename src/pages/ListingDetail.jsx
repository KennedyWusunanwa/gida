import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";

export default function ListingDetails() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [extraImages, setExtraImages] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      // 1) Main listing (include all fields we want to display)
      const { data, error } = await supabase
        .from("listings")
        .select(
          [
            "id",
            "title",
            "city",
            "location",
            "price",
            "price_ghs",
            "description",
            "image_url",
            // property basics
            "property_type",
            "room_type",
            // roommate prefs (make sure you add these columns when you’re ready)
            "gender_pref",
            "lifestyle_pref",
            "pets_pref",
            // misc
            "amenities",
            "host_name",
            "host_avatar_url",
            "is_verified_host",
            "created_at",
          ].join(", ")
        )
        .eq("id", id)
        .single();

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      setItem(data || null);

      // 2) Extra images (gallery)
      const { data: imgs, error: imgErr } = await supabase
        .from("listing_images")
        .select("id, url")
        .eq("listing_id", id)
        .order("created_at", { ascending: true });

      if (!imgErr) setExtraImages(imgs || []);
      setLoading(false);
    };

    load();
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!item) return <div className="p-6">Not found.</div>;

  const price = item.price ?? item.price_ghs;
  const title = item.title || `Room in ${item.city || item.location || ""}`;

  // Helper to print “—” when empty
  const display = (v, fallback = "—") =>
    v === null || v === undefined || v === "" ? fallback : v;

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
            <Link to="/listings" className="hover:opacity-70">Find Room</Link>
            <Link to="/app/my-listings" className="hover:opacity-70">My Listings</Link>
            <Link to="/app/inbox" className="hover:opacity-70">Inbox</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Price + title */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            {price != null && (
              <div className="text-2xl md:text-3xl font-extrabold text-[#5B3A1E]">
                GH₵{Number(price).toLocaleString()}{" "}
                <span className="text-base font-semibold text-[#2A1E14]">/ month</span>
              </div>
            )}
            <h1 className="mt-1 text-4xl md:text-5xl font-extrabold">{title}</h1>
            <p className="mt-1 text-black/70">
              {display(item.location)}{item.city ? `, ${item.city}` : ""}
            </p>
          </div>
        </div>

        {/* Hero image */}
        <div className="mt-6 bg-white rounded-2xl overflow-hidden shadow">
          <img
            src={
              item.image_url?.startsWith("http")
                ? item.image_url
                : item.image_url || "/images/placeholder.jpg"
            }
            alt={title}
            className="w-full h-[380px] object-cover"
          />
        </div>

        {/* Extra images grid */}
        {extraImages.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {extraImages.map((img) => (
              <img
                key={img.id}
                src={img.url}
                alt="Listing extra"
                className="w-full h-32 object-cover rounded-lg"
              />
            ))}
          </div>
        )}

        {/* Details + host card */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
          {/* Left column: all attributes user entered */}
          <div className="bg-white rounded-2xl p-6 shadow">
            {/* Quick facts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Fact label="Room Type" value={display(item.room_type, "—")} />
              <Fact label="Property Type" value={display(item.property_type, "—")} />
              <Fact label="Location" value={display(item.location, "—")} />
              <Fact label="City" value={display(item.city, "—")} />
            </div>

            {/* Roommate preferences */}
            <h3 className="mt-8 text-xl font-extrabold">Roommate Preferences</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Fact label="Gender" value={display(item.gender_pref, "Any")} />
              <Fact label="Lifestyle" value={display(item.lifestyle_pref, "Any")} />
              <Fact label="Pets" value={display(item.pets_pref, "No preference")} />
            </div>

            {/* Amenities */}
            <h3 className="mt-8 text-xl font-extrabold">Amenities</h3>
            <p className="mt-3 leading-7">
              {Array.isArray(item.amenities) && item.amenities.length
                ? item.amenities.join(" · ")
                : "—"}
            </p>

            {/* Description */}
            <h3 className="mt-8 text-2xl font-extrabold">About this listing</h3>
            <p className="mt-3 leading-7 whitespace-pre-line">
              {display(
                item.description,
                "No description provided by the host."
              )}
            </p>

            <div className="mt-8 text-xs text-black/50">
              Posted {new Date(item.created_at).toLocaleDateString()}
            </div>

            <button className="mt-6 text-sm underline underline-offset-4 text-black/80">
              Report
            </button>
          </div>

          {/* Right column: host / actions */}
          <aside className="bg-white rounded-2xl p-6 shadow">
            <div className="flex items-center gap-3">
              <img
                src={
                  item.host_avatar_url ||
                  "https://api.dicebear.com/7.x/initials/svg?seed=Host"
                }
                alt={item.host_name || "Host"}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <div className="font-semibold">{item.host_name || "Host"}</div>
                {item.is_verified_host && (
                  <div className="text-xs text-emerald-700">Verified host</div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="rounded-xl bg-[#5B3A1E] text-white py-3 font-semibold hover:opacity-95">
                Message
              </button>
              <button className="rounded-xl border border-black/10 py-3 font-semibold hover:bg-black/5">
                Save
              </button>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

/** Small label/value block used throughout */
function Fact({ label, value }) {
  return (
    <div className="rounded-xl border border-black/5 p-3">
      <div className="text-xs uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
