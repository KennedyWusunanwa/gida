import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";
import { ensureUserHostConversation } from "../lib/createOrGetConversation";

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

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setErr(null);

      // 1) Get listing (no FK join, fallback to separate profile fetch)
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

      // 2) Try fetching host profile separately
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

      // 3) Extra images
      const { data: imgs } = await supabase
        .from("listing_images")
        .select("id, url")
        .eq("listing_id", id)
        .order("created_at", { ascending: true });

      // 4) Viewer (logged in user, if any)
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

  // Host display info
  const derivedHost = useMemo(() => {
    const fallbackName =
      item?.host_name ||
      (item?.profiles?.full_name ? null : "Host");
    const name =
      item?.profiles?.full_name ||
      item?.host_name ||
      fallbackName ||
      "Host";

    const initialsUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      name || "Host"
    )}`;
    const avatar =
      item?.profiles?.avatar_url ||
      item?.host_avatar_url ||
      initialsUrl;

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

  // Save listing
  const handleSave = async () => {
    if (!viewer) {
      const goLogin = window.confirm(
        "You must be logged in to save listings. Go to login?"
      );
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
    if (!item?.id) {
      alert("This listing is not available yet. Please refresh and try again.");
      return;
    }
    if (!viewer) {
      if (
        window.confirm(
          "You must be logged in to message hosts. Go to login?"
        )
      ) {
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
      const convo = await ensureUserHostConversation(
        item.id,
        viewer.id,
        hostId
      );
      const convoId =
        (typeof convo === "string" && convo) ||
        (convo && (convo.id || convo.conversation_id));
      if (!convoId) throw new Error("No conversation id returned.");
      navigate(`/app/inbox?c=${encodeURIComponent(convoId)}`);
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
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl">Gida</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/listings" className="hover:opacity-70">
              Listings
            </Link>
            <Link to="/app/my-listings" className="hover:opacity-70">
              My Listings
            </Link>
            <Link to="/app/inbox" className="hover:opacity-70">
              Inbox
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Price + title */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            {price != null && (
              <div className="text-2xl md:text-3xl font-extrabold text-[#5B3A1E]">
                GH₵{Number(price).toLocaleString()}
                <span className="text-base font-semibold text-[#2A1E14]">
                  {" "}
                  / month
                </span>
              </div>
            )}
            <h1 className="mt-1 text-4xl md:text-5xl font-extrabold">
              {title}
            </h1>
            <p className="mt-1 text-black/70">
              {display(item.location)}
              {item.city ? `, ${item.city}` : ""}
            </p>
          </div>
        </div>

        {/* Hero image */}
        <div className="mt-6 bg-white rounded-2xl overflow-hidden shadow">
          <img
            src={
              item.image_url?.startsWith?.("http")
                ? item.image_url
                : item.image_url || "/images/placeholder.jpg"
            }
            alt={title}
            className="w-full h-[380px] object-cover"
          />
        </div>

        {/* Extra images */}
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
          {/* Left details */}
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

          {/* Right: Host card */}
          <aside className="bg-white rounded-2xl p-6 shadow">
            <div className="flex items-center gap-3">
              <img
                src={derivedHost.avatar}
                alt={derivedHost.name}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <div className="font-semibold">{derivedHost.name || "Host"}</div>
                {derivedHost.verified && (
                  <div className="text-xs text-emerald-700">Verified host</div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={onClickMessage}
                disabled={messaging}
                className="rounded-xl bg-[#5B3A1E] text-white py-3 font-semibold hover:opacity-95 disabled:opacity-60"
                title={!viewer ? "Sign in to message" : "Message host"}
              >
                {messaging ? "Starting chat…" : "Message"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl border border-black/10 py-3 font-semibold hover:bg-black/5 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </aside>
        </section>
      </main>
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
