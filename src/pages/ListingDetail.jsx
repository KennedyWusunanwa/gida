import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";

export default function ListingDetails() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, title, city, location, price, price_ghs, description, image_url, property_type, room_type, gender_pref, amenities, host_name, host_avatar_url, is_verified_host"
        )
        .eq("id", id)
        .single();
      if (error) setErr(error.message);
      else setItem(data || null);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!item) return <div className="p-6">Not found.</div>;

  const price = item.price ?? item.price_ghs;
  const title = item.title || `Room in ${item.city || item.location || ""}`;

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
        {price != null && (
          <div className="text-2xl md:text-3xl font-extrabold text-[#5B3A1E]">
            GH₵{Number(price).toLocaleString()} <span className="text-base font-semibold text-[#2A1E14]">/ month</span>
          </div>
        )}
        <h1 className="mt-2 text-4xl md:text-5xl font-extrabold">{title}</h1>

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

        {/* Attributes + host */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
          <div className="bg-white rounded-2xl p-6 shadow">
            <ul className="space-y-3 text-[#2A1E14]">
              <li>• Location: <strong>{item.city || item.location || "—"}</strong></li>
              <li>• {item.room_type ? item.room_type : "Private room"}</li>
              <li>• {item.property_type ? item.property_type : "Apartment"}</li>
              <li>
                • Utilities / Amenities:&nbsp;
                <strong>
                  {Array.isArray(item.amenities) && item.amenities.length
                    ? item.amenities.join(" | ")
                    : "Wi-Fi | Washer"}
                </strong>
              </li>
            </ul>

            <h3 className="mt-8 text-2xl font-extrabold">About this listing</h3>
            <p className="mt-3 leading-7">
              {item.description ||
                "Spacious private room in a 3-bedroom apartment. In the heart of town. Fully furnished. Proximity to shops and public transport."}
            </p>

            <button className="mt-8 text-sm underline underline-offset-4 text-black/80">
              Report
            </button>
          </div>

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
