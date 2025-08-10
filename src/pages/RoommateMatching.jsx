import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";
import { ensureConversationWith } from "../lib/ensureConversation";

export default function RoommateMatching() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [me, setMe] = useState(null);
  const [matches, setMatches] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Profile preview modal
  const [preview, setPreview] = useState(null);

  // Avatars cache: { userId: url|null }
  const [avatars, setAvatars] = useState({});

  // Local filters for discovery
  const [onlyHasPlace, setOnlyHasPlace] = useState(false);
  const [maxShare, setMaxShare] = useState("");

  // Defaults
  const [form, setForm] = useState({
    location_city: "",
    cleanliness: 3,
    smoking: "never",
    schedule: "flex",
    budget_min: "",
    budget_max: "",
    gender_pref: "any",
    has_place: false,
    rent_total_ghs: "",
    split_you: "",
    split_them: "",
    utilities_included: false,
    available_from: "",
    lease_end: "",
  });

  // auth + my profile
  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const current = data?.user ?? null;
      setUser(current);
      if (!current) { navigate("/auth?next=/roommate-matching"); return; }

      const { data: meProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", current.id)
        .single();

      if (meProfile) {
        setMe(meProfile);
        setForm((f) => ({
          ...f,
          location_city: meProfile.location_city ?? "",
          cleanliness: meProfile.cleanliness ?? 3,
          smoking: meProfile.smoking ?? "never",
          schedule: meProfile.schedule ?? "flex",
          budget_min: meProfile.budget_min ?? "",
          budget_max: meProfile.budget_max ?? "",
          gender_pref: meProfile.gender_pref ?? "any",
          has_place: !!meProfile.has_place,
          rent_total_ghs: meProfile.rent_total_ghs ?? "",
          split_you: meProfile.split_you ?? "",
          split_them: meProfile.split_them ?? "",
          utilities_included: !!meProfile.utilities_included,
          available_from: meProfile.available_from ?? "",
          lease_end: meProfile.lease_end ?? "",
        }));
      }
      setLoading(false);
      sub = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null)).data.subscription;
    })();
    return () => sub?.unsubscribe();
  }, [navigate]);

  // load avatars for any listed matches
  useEffect(() => {
    (async () => {
      const ids = [...new Set((matches || []).map((m) => m.candidate_id))];
      if (!ids.length) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, avatar_url")
        .in("id", ids);
      if (!error && data) {
        const map = {};
        for (const r of data) map[r.id] = r.avatar_url || null;
        setAvatars(map);
      }
    })();
  }, [matches]);

  const initials = (name) =>
    (name || "")
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "G";

  const startMessage = async (targetUserId) => {
    try {
      const cid = await ensureConversationWith(targetUserId);
      navigate(`/app/inbox?c=${encodeURIComponent(cid)}`);
    } catch (e) {
      console.error("Failed to start conversation:", e);
      alert("Couldn’t open chat. Please try again.");
    }
  };

  const onChange = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveAndMatch = async () => {
    try {
      setSaving(true);
      setErr(null);

      const payload = {
        location_city: form.location_city || null,
        cleanliness: Number(form.cleanliness) || 3,
        smoking: form.smoking,
        schedule: form.schedule,
        budget_min: form.budget_min !== "" ? Number(form.budget_min) : null,
        budget_max: form.budget_max !== "" ? Number(form.budget_max) : null,
        gender_pref: form.gender_pref,
      };

      const { error: upErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (upErr) throw upErr;

      const { data: suggested, error: mErr } = await supabase
        .rpc("match_roommates", { p_user: user.id, p_limit: 48 });
      if (mErr) throw mErr;

      setMatches(suggested || []);
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ---------- Derived values ----------
  const inboxPath = "/app/inbox";
  const inboxHref = user ? inboxPath : `/auth?next=${encodeURIComponent(inboxPath)}`;
  const isHidden = me && me.is_active === false;

  const [minScore, maxScore] = useMemo(() => {
    if (!matches?.length) return [0, 1];
    let min = Number.POSITIVE_INFINITY, max = Number.NEGATIVE_INFINITY;
    for (const m of matches) {
      const s = Number(m.score) || 0;
      if (s < min) min = s;
      if (s > max) max = s;
    }
    if (!isFinite(min) || !isFinite(max) || min === max) return [0, Math.max(1, max)];
    return [min, max];
  }, [matches]);

  const toPercent = (score) => {
    const s = Number(score) || 0;
    if (maxScore === minScore) return 50;
    const pct = ((s - minScore) / (maxScore - minScore)) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  };

  const matchGrade = (pct) => {
    if (pct >= 85) return "Excellent match";
    if (pct >= 70) return "Great match";
    if (pct >= 50) return "Good match";
    if (pct >= 30) return "Fair match";
    return "Low match";
  };

  const matchColor = (pct) => {
    if (pct >= 75) return "bg-green-100 text-green-800 border-green-300";
    if (pct >= 50) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (pct >= 25) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const budgetOverlap = (meMin, meMax, cMin, cMax) => {
    if ([meMin, meMax, cMin, cMax].some((v) => v == null)) return "—";
    const overlap = Math.max(0, Math.min(meMax, cMax) - Math.max(meMin, cMin));
    if (overlap <= 0) return "No overlap";
    if (overlap < 300) return "Low overlap";
    if (overlap < 800) return "Medium overlap";
    return "High overlap";
  };

  const calcGuestShare = (rTotal, you, them) => {
    const rt = Number(rTotal);
    const a = Number(you);
    const b = Number(them);
    if (!rt || !a || !b) return null;
    const sum = a + b;
    if (sum <= 0) return null;
    return Math.round((rt * (b / sum)) * 100) / 100;
  };

  const city = (form.location_city || "").trim().toLowerCase();

  const filtered = useMemo(() => {
    let arr = matches || [];
    if (onlyHasPlace) arr = arr.filter((m) => m.has_place === true);
    const cap = maxShare ? Number(maxShare) : null;
    if (cap && cap > 0) {
      arr = arr.filter((m) => {
        const gs = calcGuestShare(m.rent_total_ghs, m.split_you, m.split_them);
        return gs == null || gs <= cap;
      });
    }
    arr = [...arr].sort((a, b) => {
      if (!!b.has_place - !!a.has_place !== 0) return (!!b.has_place - !!a.has_place);
      return toPercent(b.score) - toPercent(a.score);
    });
    return arr;
  }, [matches, onlyHasPlace, maxShare]);

  const inCity = useMemo(() => {
    if (!city) return filtered;
    return filtered.filter((m) => (m.location_city || "").trim().toLowerCase() === city);
  }, [filtered, city]);

  const outCity = useMemo(() => {
    if (!city) return [];
    return filtered.filter((m) => (m.location_city || "").trim().toLowerCase() !== city);
  }, [filtered, city]);

  if (loading) return <div className="p-6">Loading…</div>;

  // Profile modal (bigger avatar + clearer labels)
  const ProfileModal = ({ data, onClose }) => {
    if (!data) return null;
    const avatar = avatars[data.candidate_id];
    const guestShare = calcGuestShare(data.rent_total_ghs, data.split_you, data.split_them);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-xl bg-white rounded-2xl shadow p-6">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-lg px-2 py-1 text-sm bg-black/5 hover:bg-black/10"
            aria-label="Close"
          >
            Close
          </button>

          <div className="flex items-center gap-4">
            {avatar ? (
              <img src={avatar} alt={data.full_name || "User"} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[#3B2719] text-white grid place-items-center text-xl font-bold">
                {initials(data.full_name)}
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-wide text-black/60">Name</div>
              <h3 className="text-2xl font-extrabold">{data.full_name || "Gida user"}</h3>
              <div className="text-sm text-black/70 mt-1">City: {data.location_city || "—"}</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoPill label="Cleanliness" value={data.cleanliness ?? "—"} />
            <InfoPill label="Schedule" value={data.schedule || "—"} />
            <InfoPill label="Smoking" value={data.smoking || "—"} />
            <InfoPill label="Budget" value={`${data.budget_min ?? "—"} – ${data.budget_max ?? "—"} GHS`} />
          </div>

          {data.has_place && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 p-3 text-sm">
              <div className="font-semibold">Has a place to share</div>
              <div>Total rent: {Number(data.rent_total_ghs || 0).toLocaleString()} GHS / month</div>
              {(data.split_you && data.split_them) && <div>Split ratio: {data.split_you}:{data.split_them}</div>}
              {guestShare != null && <div>Your estimated share: <b>{guestShare.toLocaleString()} GHS</b> / month</div>}
              <div>{data.utilities_included ? "Utilities included" : "Utilities not included"}</div>
            </div>
          )}

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-black/60">About</div>
            <p className="mt-1 text-sm">{data.bio || "No bio yet."}</p>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setPreview(null)}
              className="rounded-xl px-4 py-3 border border-black/10 hover:bg-black/5 font-semibold"
            >
              Close
            </button>
            <button
              onClick={() => { setPreview(null); startMessage(data.candidate_id); }}
              className="rounded-xl px-4 py-3 bg-[#3B2719] text-white hover:opacity-90 font-semibold"
            >
              Message
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Friendlier, larger card
  const MatchCard = ({ m, inSameCity }) => {
    const pct = toPercent(m.score);
    const badge = matchColor(pct);
    const grade = matchGrade(pct);
    const ol = budgetOverlap(me?.budget_min, me?.budget_max, m.budget_min, m.budget_max);
    const avatar = avatars[m.candidate_id];
    const guestShare = calcGuestShare(m.rent_total_ghs, m.split_you, m.split_them);

    return (
      <div className="bg-white rounded-2xl p-5 shadow space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            {avatar ? (
              <img
                src={avatar}
                alt={m.full_name || "User"}
                className="h-14 w-14 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-[#3B2719] text-white grid place-items-center text-lg font-bold flex-shrink-0">
                {initials(m.full_name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-black/60">Name</div>
              <div className="text-lg font-extrabold truncate">{m.full_name || "Gida user"}</div>
              <div className="text-sm text-black/70 mt-0.5">
                City: {inSameCity ? "Same City" : (m.location_city || "—")}
              </div>
            </div>
          </div>
          <div className={`text-sm px-3 py-1.5 rounded-full border font-semibold text-center ${badge}`}>
            {pct}% • {grade}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <InfoPill label="Smoking" value={m.smoking || "—"} />
          <InfoPill label="Schedule" value={m.schedule || "—"} />
          <InfoPill label="Budget fit" value={ol} />
          {m.has_place && <InfoPill label="Status" value="Has a place" tone="good" />}
          {m.has_place && guestShare != null && (
            <InfoPill label="Your share (est.)" value={`${guestShare.toLocaleString()} GHS / mo`} />
          )}
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-black/60">About</div>
          <p className="mt-1 text-sm text-black/80">{m.bio || "No bio yet."}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => setPreview(m)}
            className="rounded-xl px-4 py-3 border border-black/10 hover:bg-black/5 font-semibold"
            aria-label={`View profile of ${m.full_name || "user"}`}
          >
            View Profile
          </button>
          <button
            onClick={() => startMessage(m.candidate_id)}
            className="rounded-xl px-4 py-3 bg-[#3B2719] text-white hover:opacity-90 font-semibold"
            aria-label={`Message ${m.full_name || "user"}`}
          >
            Message
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#2A1E14]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl tracking-tight">Gida</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/roommate-matching" className="hover:opacity-70">Roommate Matching</Link>
            <Link to="/listings" className="hover:opacity-70">Listings</Link>
            <Link to={inboxHref} className="hover:opacity-70">Messages</Link>
            <button onClick={logout} className="hover:opacity-70">Sign Out</button>
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-black/20"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(v => !v)}
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

        {/* Mobile menu panel */}
        <div className={`${mobileOpen ? "block" : "hidden"} md:hidden border-t border-black/5`}>
          <nav className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3">
            <Link to="/roommate-matching" className="py-2 font-medium hover:opacity-70" onClick={() => setMobileOpen(false)}>Roommate Matching</Link>
            <Link to="/listings" className="py-2 font-medium hover:opacity-70" onClick={() => setMobileOpen(false)}>Listings</Link>
            <Link to={inboxHref} className="py-2 font-medium hover:opacity-70" onClick={() => setMobileOpen(false)}>Messages</Link>
            <button onClick={() => { setMobileOpen(false); logout(); }} className="py-2 text-left font-medium hover:opacity-70">Sign Out</button>
          </nav>
        </div>
      </header>

      {/* Page container */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Status banner */}
          {isHidden && (
            <div className="mb-4 p-3 rounded-xl bg-yellow-100 border border-yellow-300 text-yellow-800 text-sm flex items-center justify-between">
              <span>Your profile is hidden from results.</span>
              <Link to="/app/edit-profile" className="ml-3 px-3 py-1 bg-yellow-200 rounded-lg hover:bg-yellow-300 text-xs font-semibold">
                Edit Profile
              </Link>
            </div>
          )}

          <h1 className="text-3xl font-extrabold">Roommate Matching</h1>
          <p className="mt-2 text-black/70">Step 1: Tell us about your preferences. Step 2: Review your matches and message anyone who looks right.</p>

          {err && <p className="mt-3 text-red-600">{err}</p>}

          {/* STEP 1: Preferences */}
          <section className="mt-6 bg-white rounded-2xl p-5 shadow space-y-4">
            <h2 className="text-xl font-extrabold">Your Preferences</h2>

            <div className="grid gap-4">
              {/* City */}
              <div>
                <label htmlFor="city" className="block text-sm font-semibold mb-1">City</label>
                <select
                  id="city"
                  value={form.location_city}
                  onChange={(e) => onChange("location_city", e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2"
                >
                  <option value="">Select city</option>
                  <option>Accra</option><option>Kumasi</option><option>Takoradi</option>
                  <option>Tema</option><option>Kasoa</option><option>Cape Coast</option>
                  <option>Sunyani</option><option>Ho</option><option>Tamale</option>
                </select>
                <p className="text-xs text-black/60 mt-1">We’ll show same-city matches first.</p>
              </div>

              {/* Cleanliness */}
              <div>
                <label htmlFor="cleanliness" className="block text-sm font-semibold mb-1">Cleanliness (1–5)</label>
                <input
                  id="cleanliness"
                  type="range" min="1" max="5" value={form.cleanliness}
                  onChange={(e) => onChange("cleanliness", e.target.value)}
                  className="w-full"
                />
                <div className="text-sm mt-1">Preference: {form.cleanliness}/5</div>
              </div>

              {/* Smoking + Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="smoking" className="block text-sm font-semibold mb-1">Smoking</label>
                  <select
                    id="smoking"
                    value={form.smoking}
                    onChange={(e) => onChange("smoking", e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2"
                  >
                    <option value="never">No smoking</option>
                    <option value="outside_only">Only outside</option>
                    <option value="ok">It’s okay</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="schedule" className="block text-sm font-semibold mb-1">Schedule</label>
                  <select
                    id="schedule"
                    value={form.schedule}
                    onChange={(e) => onChange("schedule", e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2"
                  >
                    <option value="early">Early riser</option>
                    <option value="flex">Flexible</option>
                    <option value="late">Night owl</option>
                  </select>
                </div>
              </div>

              {/* Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="budget_min" className="block text-sm font-semibold mb-1">Budget Min (GHS)</label>
                  <input
                    id="budget_min"
                    type="number"
                    value={form.budget_min}
                    onChange={(e) => onChange("budget_min", e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="budget_max" className="block text-sm font-semibold mb-1">Budget Max (GHS)</label>
                  <input
                    id="budget_max"
                    type="number"
                    value={form.budget_max}
                    onChange={(e) => onChange("budget_max", e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2"
                  />
                </div>
              </div>

              {/* Gender preference */}
              <div>
                <label htmlFor="gender_pref" className="block text-sm font-semibold mb-1">Preferred Roommate Gender</label>
                <select
                  id="gender_pref"
                  value={form.gender_pref}
                  onChange={(e) => onChange("gender_pref", e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2"
                >
                  <option value="any">Any</option>
                  <option value="male">Male only</option>
                  <option value="female">Female only</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={saveAndMatch}
                disabled={saving}
                className="w-full sm:w-auto rounded-xl bg-[#3B2719] text-white px-6 py-3 font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Finding matches…" : "Find Matches"}
              </button>
            </div>
          </section>

          {/* STEP 2: Filters for results */}
          <section className="mt-4 bg-white rounded-2xl p-5 shadow space-y-3">
            <h2 className="text-xl font-extrabold">Refine Results (Optional)</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyHasPlace}
                  onChange={(e)=>setOnlyHasPlace(e.target.checked)}
                  aria-label="Only show people who already have a place"
                />
                Only show people who already have a place
              </label>
              <div className="flex items-center gap-2">
                <label htmlFor="max_share" className="whitespace-nowrap">Max share I can pay (GHS)</label>
                <input
                  id="max_share"
                  type="number"
                  className="w-32 rounded-xl border border-black/10 px-3 py-2"
                  value={maxShare}
                  onChange={(e)=>setMaxShare(e.target.value)}
                  placeholder="e.g. 1200"
                />
              </div>
            </div>
          </section>

          {/* RESULTS */}
          {inCity?.length > 0 && (
            <section className="mt-8">
              <h2 className="text-2xl font-extrabold">
                Matches in {form.location_city} <span className="text-black/60 text-base">({inCity.length})</span>
              </h2>
              <p className="text-black/70 text-sm">Best matches are shown first. People who already have a place appear first.</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {inCity.map((m) => (
                  <MatchCard key={m.candidate_id} m={m} inSameCity />
                ))}
              </div>
            </section>
          )}

          {city && outCity?.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-extrabold">
                Good Matches outside {form.location_city} <span className="text-black/60 text-base">({outCity.length})</span>
              </h2>
              <p className="text-black/70 text-sm">These are strong matches in other cities.</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {outCity.map((m) => (
                  <MatchCard key={m.candidate_id} m={m} />
                ))}
              </div>
            </section>
          )}

          {(inCity?.length === 0 && (!city || outCity?.length === 0)) && !saving && (
            <p className="mt-6 text-black/70">
              No strong matches yet. Try widening your budget or selecting “Any” for gender.
            </p>
          )}
        </div>
      </main>

      {/* Profile modal */}
      <ProfileModal data={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/** Small labeled pill component for clarity */
function InfoPill({ label, value, tone }) {
  const base = "rounded-xl px-3 py-2 text-sm border";
  const tones = {
    good: "bg-emerald-50 border-emerald-200 text-emerald-900",
    default: "bg-black/5 border-black/10 text-black/80",
  };
  return (
    <div className={`${base} ${tones[tone] || tones.default}`}>
      <span className="block text-[11px] uppercase tracking-wide text-black/50">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
