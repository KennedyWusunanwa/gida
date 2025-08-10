// src/pages/ListingDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";
import { ensureConversationWith } from "../lib/ensureConversation";

export default function ListingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [extraImages, setExtraImages] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // gallery / lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setErr(null);

      const { data: listing, error: listErr } = await supabase
        .from("listings")
        .select(`
          id, user_id, title, city, location, price, price_ghs, description,
          image_url, property_type, room_type, gender_pref, lifestyle_pref,
          pets_pref, amenities, host_name, host_avatar_url, is_verified_host, created_at
        `)
        .eq("id", id)
        .single();

      if (listErr) {
        if (!cancelled) {
          setErr(listErr.message || "Failed to load listing.");
          setLoading(false);
        }
        return;
      }

      let hostProfile = null;
      if (listing?.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, is_verified")
          .eq("id", listing.user_id)
          .maybeSingle();
        hostProfile = prof || null;
      }

      const listingWithProfile = { ...listing, profiles: hostProfile };

      const { data: imgs } = await supabase
        .from("listing_images")
        .select("id, url")
        .eq("listing_id", id)
        .order("created_at", { ascending: true });

      const { data: auth } = await supabase.auth.getUser();

      if (!cancelled) {
        setItem(listingWithProfile);
        setExtraImages(imgs || []);
        setViewer(auth?.user ?? null);
        setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // derived host display
  const derivedHost = useMemo(() => {
    const fallbackName = item?.host_name || (item?.profiles?.full_name ? null : "Host");
    const name = item?.profiles?.full_name || item?.host_name || fallbackName || "Host";
    const initialsUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      name || "Host"
    )}`;
    const avatar = item?.profiles?.avatar_url || item?.host_avatar_url || initialsUrl;
    const verified =
      (item?.profiles?.is_verified ?? null) !== null
        ? !!item?.profiles?.is_verified
        : !!item?.is_verified_host;
    return { name, avatar, verified };
  }, [item]);

  const display = (v, fallback = "—") =>
    v === null || v === undefined || v === "" ? fallback : v;

  const price = item?.price ?? item?.price_ghs;
  const title = item?.title || `Room in ${item?.city || item?.location || ""}`;

  // build gallery array
  const images = useMemo(() => {
    const hero =
      item?.image_url?.startsWith?.("http")
        ? item.image_url
        : item?.image_url || "/images/placeholder.jpg";
    const extras = (extraImages || [])
      .map((x) => x?.url)
      .filter(Boolean);
    // de-dup hero from extras if same
    const dedup = [hero, ...extras.filter((u) => u !== hero)];
    return dedup;
  }, [item, extraImages]);

  const openLightbox = (idx) => {
    setActiveIdx(idx);
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);
  const prevImg = () => setActiveIdx((i) => (i - 1 + images.length) % images.length);
  const nextImg = () => setActiveIdx((i) => (i + 1) % images.length);

  // keyboard controls for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImg();
      if (e.key === "ArrowRight") nextImg();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, images.length]);

  // Save listing
  const handleSave = async () => {
    if (!viewer) {
      const goLogin = window.confirm("You must be logged in to save listings. Go to login?");
      if (goLogin) navigate("/auth");
      return;
    }
    if (!item?.id) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("saved_listings").insert({
        user_id: viewer.id,
        listing_id: item.id,
      });
      if (error) {
        console.error(error);
        alert(`Failed to save listing: ${error.message}`);
      } else {
        alert("Listing saved!");
      }
    } finally {
      setSaving(false);
    }
  };

  // Start messaging
  const onClickMessage = async () => {
    if (!viewer) {
      if (window.confirm("You must be logged in to message hosts. Go to login?")) {
        navigate("/auth");
      }
      return;
    }
    const hostId = item?.user_id;
    if (!hostId) {
      alert("This listing has no host linked yet.");
      return;
    }
    if (viewer.id === hostId) {
      alert("You can’t message yourself about your own listing.");
      return;
    }

    try {
      setMessaging(true);
      const cid = await ensureConversationWith(hostId);
      navigate(`/app/inbox?c=${encodeURIComponent(cid)}`);
    } catch (e) {
      console.error("Failed to start chat:", e);
      alert("Could not start the chat. Please try again.");
    } finally {
      setMessaging(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!item) return <div className="p-6">Not found.</div>;

  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl">Gida</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/listings" className="hover:opacity-70">Listings</Link>
            <Link to="/app/my-listings" className="hover:opacity-70">My Listings</Link>
            <Link to="/app/inbox" className="hover:opacity-70">Inbox</Link>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.225 4.811 4.811 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.811z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`${mobileOpen ? "block" : "hidden"} md:hidden border-t border-black/5`}>
          <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            <Link to="/listings" className="py-2 font-medium hover:opacity-70" onClick={() => setMobileOpen(false)}>Listings</Link>
            <Link to="/app/my-listings" className="py-2 font-medium hover:opacity-70" onClick={() => setMobileOpen(false)}>My Listings</Link>
            <Link to="/app/inbox" className="py-2 font-medium hover:opacity-70" onClick={() => setMobileOpen(false)}>Inbox</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        {/* Title + meta */}
        <h1 className="text-2xl md:text-3xl font-extrabold">{title}</h1>
        <p className="mt-1 text-black/70">{display(item.location)}{item.city ? `, ${item.city}` : ""}</p>

        {/* Photo gallery (Airbnb-style) */}
        <section className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {/* Big left image */}
            <button
              type="button"
              onClick={() => openLightbox(0)}
              className="relative h-[260px] md:h-[460px] w-full overflow-hidden rounded-2xl bg-white shadow"
              aria-label="Open main photo"
            >
              <img
                src={images[0]}
                alt={title}
                className="w-full h-full object-cover"
              />
              {images.length > 0 && (
                <span className="absolute bottom-3 left-3 rounded-lg bg-black/50 text-white px-2 py-1 text-xs">
                  1 / {images.length}
                </span>
              )}
            </button>

            {/* Right 4-up grid */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {images.slice(1, 5).map((src, i) => {
                const idx = i + 1;
                const isLastThumb = idx === Math.min(5, images.length) - 1 && images.length > 5;
                return (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => openLightbox(idx)}
                    className="relative h-[128px] md:h-[225px] w-full overflow-hidden rounded-2xl bg-white shadow"
                    aria-label={`Open photo ${idx + 1}`}
                  >
                    <img src={src} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    {isLastThumb && (
                      <span className="absolute inset-0 bg-black/40 text-white grid place-items-center text-sm md:text-base font-semibold">
                        View all photos
                      </span>
                    )}
                  </button>
                );
              })}
              {/* Fill with placeholders to keep grid balanced if <4 thumbs */}
              {Array.from({ length: Math.max(0, 4 - Math.min(4, Math.max(0, images.length - 1))) }).map((_, i) => (
                <div key={`ph-${i}`} className="rounded-2xl bg-black/5 h-[128px] md:h-[225px]" />
              ))}
            </div>
          </div>
        </section>

        {/* Content layout: details left, action card right */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_380px] gap-6">
          {/* Left: details */}
          <div className="bg-white rounded-2xl p-6 shadow">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Fact label="Room Type" value={display(item.room_type)} />
              <Fact label="Property Type" value={display(item.property_type)} />
              <Fact label="Location" value={display(item.location)} />
              <Fact label="City" value={display(item.city)} />
            </div>

            <h3 className="mt-8 text-xl font-extrabold">Roommate Preferences</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Fact label="Gender" value={display(item.gender_pref, "Any")} />
              <Fact label="Lifestyle" value={display(item.lifestyle_pref, "Any")} />
              <Fact label="Pets" value={display(item.pets_pref, "No preference")} />
            </div>

            <h3 className="mt-8 text-xl font-extrabold">Amenities</h3>
            <p className="mt-3 leading-7">
              {Array.isArray(item.amenities) && item.amenities.length
                ? item.amenities.join(" · ")
                : "—"}
            </p>

            <h3 className="mt-8 text-2xl font-extrabold">About this listing</h3>
            <p className="mt-3 leading-7 whitespace-pre-line">
              {display(item.description, "No description provided by the host.")}
            </p>

            <div className="mt-8 text-xs text-black/50">
              Posted {new Date(item.created_at).toLocaleDateString()}
            </div>

            <button className="mt-6 text-sm underline underline-offset-4 text-black/80">
              Report
            </button>
          </div>

          {/* Right: action card (Reserve -> Message/Save) */}
          <aside className="bg-white rounded-2xl p-6 shadow h-fit sticky md:top-20">
            <div className="flex items-start justify-between">
              <div>
                {price != null && (
                  <div className="text-2xl font-extrabold text-[#5B3A1E]">
                    GH₵{Number(price).toLocaleString()}
                    <span className="text-sm font-semibold text-[#2A1E14]"> / month</span>
                  </div>
                )}
                <div className="mt-1 text-sm text-black/60">Message the host to ask questions or arrange a viewing.</div>
              </div>
            </div>

            {/* Host mini card */}
            <div className="mt-5 flex items-center gap-3">
              <img
                src={derivedHost.avatar}
                alt={derivedHost.name}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <div className="font-semibold">{derivedHost.name || "Host"}</div>
                {derivedHost.verified && <div className="text-xs text-emerald-700">Verified host</div>}
              </div>
            </div>

            {/* CTA buttons */}
            <div className="mt-5 grid grid-cols-1 gap-3">
              <button
                onClick={onClickMessage}
                disabled={messaging}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B3A1E] text-white py-3 font-semibold hover:opacity-95 disabled:opacity-60"
                title={!viewer ? "Sign in to message" : "Message host"}
              >
                {/* Message icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 3H4a2 2 0 0 0-2 2v14l4-4h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
                </svg>
                {messaging ? "Starting chat…" : "Message Host"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 py-3 font-semibold hover:bg-black/5 disabled:opacity-60"
              >
                {/* Heart / save icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.1 21.35 10 19.28C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6.002 6.002 0 0 1 20.5 3 5.5 5.5 0 0 1 22 8.5c0 3.78-3.4 6.86-7.99 10.78l-1.91 2.07z"/>
                </svg>
                {saving ? "Saving…" : "Save Listing"}
              </button>
            </div>

            <div className="mt-4 text-xs text-black/50">
              Tip: Introduce yourself and share your preferred move-in date when you message.
            </div>
          </aside>
        </section>
      </main>

      {/* LIGHTBOX / full-screen photo viewer */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/90">
          {/* top bar */}
          <div className="absolute top-0 inset-x-0 h-14 flex items-center justify-between px-4 text-white">
            <div className="text-sm">
              Photo {activeIdx + 1} of {images.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={closeLightbox}
                className="rounded-lg px-3 py-1.5 bg-white/10 hover:bg-white/20"
                aria-label="Minimize photo"
              >
                Close
              </button>
            </div>
          </div>

          {/* image */}
          <div className="h-full w-full flex items-center justify-center px-4">
            <img
              src={images[activeIdx]}
              alt={`Photo ${activeIdx + 1}`}
              className="max-h-[80vh] max-w-full rounded-lg shadow-2xl"
            />
          </div>

          {/* controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 hover:bg-white/25 p-3 text-white"
                aria-label="Previous photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m15.41 7.41-1.41-1.41L8.59 11l5.41 5.41 1.41-1.41L11.41 11z"/>
                </svg>
              </button>
              <button
                onClick={nextImg}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 hover:bg-white/25 p-3 text-white"
                aria-label="Next photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m8.59 16.59 1.41 1.41L15.41 12 10 6.59 8.59 8l3.59 4z"/>
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="rounded-xl border border-black/5 p-3">
      <div className="text-xs uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
