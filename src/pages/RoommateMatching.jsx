// src/pages/RoommateMatching.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";

export default function RoommateMatching() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [me, setMe] = useState(null);
  const [matches, setMatches] = useState([]);

  // Profile preview modal
  const [preview, setPreview] = useState(null);

  // Avatars cache: { userId: url|null }
  const [avatars, setAvatars] = useState({});

  // Ghana-friendly defaults
  const [form, setForm] = useState({
    location_city: "",
    cleanliness: 3,
    smoking: "never",
    schedule: "flex",
    budget_min: "",
    budget_max: "",
    gender_pref: "any",
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

  // open (or create) a DM with target, then jump to that convo in Inbox
  const startMessage = async (targetUserId) => {
    try {
      const { data, error } = await supabase.rpc("start_or_get_dm", {
        p_user1: user.id,
        p_user2: targetUserId,
      });
      if (error) throw error;
      const convId = typeof data === "string" ? data : data?.id || data;
      navigate(`/app/inbox?conv=${encodeURIComponent(convId)}`);
    } catch (_e) {
      // fallback to old behavior if RPC missing
      navigate(`/app/inbox?to=${encodeURIComponent(targetUserId)}`);
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

      // call server-side matching
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

  // split matches by selected city
  const city = (form.location_city || "").trim().toLowerCase();

  const inCity = useMemo(() => {
    if (!city) return matches;
    return matches.filter((m) => (m.location_city || "").trim().toLowerCase() === city);
  }, [matches, city]);

  const outCity = useMemo(() => {
    if (!city) return [];
    return matches.filter((m) => (m.location_city || "").trim().toLowerCase() !== city);
  }, [matches, city]);

  if (loading) return <div className="p-6">Loading…</div>;

  // profile preview content
  const ProfileModal = ({ data, onClose }) => {
    if (!data) return null;
    const avatar = avatars[data.candidate_id];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow p-5">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-lg px-2 py-1 text-sm bg-black/5 hover:bg-black/10"
          >
            Close
          </button>

          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt={data.full_name || "User"} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-[#3B2719] text-white grid place-items-center">
                {initials(data.full_name)}
              </div>
            )}
            <div>
              <h3 className="text-xl font-extrabold">{data.full_name || "Gida user"}</h3>
              <p className="text-black/70 text-sm">{data.location_city || "—"}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-black/5 px-3 py-2">Cleanliness: {data.cleanliness ?? "—"}</div>
            <div className="rounded-xl bg-black/5 px-3 py-2">Schedule: {data.schedule || "—"}</div>
            <div className="rounded-xl bg-black/5 px-3 py-2">Smoking: {data.smoking || "—"}</div>
            <div className="rounded-xl bg-black/5 px-3 py-2">
              Budget: {(data.budget_min ?? "—")}–{(data.budget_max ?? "—")} GHS
            </div>
          </div>

          <p className="mt-4 text-sm">{data.bio || "No bio yet."}</p>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => { onClose(); startMessage(data.candidate_id); }}
              className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90"
            >
              Message
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] text-[#2A1E14]">
      {/* Header (matches other pages) */}
      <header className="sticky top-0 z-30 bg-[#F7F0E6]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="Gida" className="h-7 w-7 object-contain" />
            <span className="font-extrabold text-xl tracking-tight">Gida</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/roommate-matching" className="hover:opacity-70">Roommate Matching</Link>
            <Link to="/listings" className="hover:opacity-70">Listings</Link>
            <Link to={inboxHref} className="hover:opacity-70">Messages</Link>
            <button onClick={logout} className="hover:opacity-70">Sign Out</button>
          </nav>
        </div>
      </header>

      {/* Page container */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Tiny banner if profile is hidden */}
          {isHidden && (
            <div className="mb-4 p-3 rounded-xl bg-yellow-100 border border-yellow-300 text-yellow-800 text-sm flex items-center justify-between">
              <span>Your profile is currently hidden from roommate matching results.</span>
              <Link
                to="/app/edit-profile"
                className="ml-3 px-3 py-1 bg-yellow-200 rounded-lg hover:bg-yellow-300 text-xs font-semibold"
              >
                Edit Profile
              </Link>
            </div>
          )}

          <h1 className="text-3xl font-extrabold">Roommate Matching</h1>
          <p className="mt-2 text-black/70">
            City is key — pick your city and we’ll show your best matches there first.
          </p>

          {err && <p className="mt-3 text-red-600">{err}</p>}

          {/* QUIZ */}
          <div className="mt-6 grid gap-4 bg-white rounded-2xl p-4 shadow">
            {/* City */}
            <div>
              <label className="block text-sm font-semibold mb-1">City</label>
              <select
                value={form.location_city}
                onChange={(e) => onChange("location_city", e.target.value)}
                className="w-full rounded-xl border border-black/10 px-3 py-2"
              >
                <option value="">Select city</option>
                <option>Accra</option>
                <option>Kumasi</option>
                <option>Takoradi</option>
                <option>Tema</option>
                <option>Kasoa</option>
                <option>Cape Coast</option>
                <option>Sunyani</option>
                <option>Ho</option>
                <option>Tamale</option>
              </select>
            </div>

            {/* Cleanliness */}
            <div>
              <label className="block text-sm font-semibold mb-1">Cleanliness</label>
              <input
                type="range" min="1" max="5" value={form.cleanliness}
                onChange={(e) => onChange("cleanliness", e.target.value)}
                className="w-full"
              />
              <div className="text-sm mt-1">Preference: {form.cleanliness}/5</div>
            </div>

            {/* Smoking */}
            <div>
              <label className="block text-sm font-semibold mb-1">Smoking</label>
              <select
                value={form.smoking}
                onChange={(e) => onChange("smoking", e.target.value)}
                className="w-full rounded-xl border border-black/10 px-3 py-2"
              >
                <option value="never">No smoking</option>
                <option value="outside_only">Only outside</option>
                <option value="ok">It’s okay</option>
              </select>
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-semibold mb-1">Schedule</label>
              <select
                value={form.schedule}
                onChange={(e) => onChange("schedule", e.target.value)}
                className="w-full rounded-xl border border-black/10 px-3 py-2"
              >
                <option value="early">Early riser</option>
                <option value="flex">Flexible</option>
                <option value="late">Night owl</option>
              </select>
            </div>

            {/* Budget */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Budget Min (GHS)</label>
                <input
                  type="number"
                  value={form.budget_min}
                  onChange={(e) => onChange("budget_min", e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Budget Max (GHS)</label>
                <input
                  type="number"
                  value={form.budget_max}
                  onChange={(e) => onChange("budget_max", e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2"
                />
              </div>
            </div>

            {/* Gender preference */}
            <div>
              <label className="block text-sm font-semibold mb-1">Preferred Roommate Gender</label>
              <select
                value={form.gender_pref}
                onChange={(e) => onChange("gender_pref", e.target.value)}
                className="w-full rounded-XL border border-black/10 px-3 py-2"
              >
                <option value="any">Any</option>
                <option value="male">Male only</option>
                <option value="female">Female only</option>
              </select>
            </div>

            <button
              onClick={saveAndMatch}
              disabled={saving}
              className="rounded-xl bg-[#3B2719] text-white px-6 py-3 font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Finding matches…" : "Find Matches"}
            </button>
          </div>

          {/* IN-CITY RESULTS */}
          {inCity?.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-extrabold">
                Matches in {form.location_city}
              </h2>
              <p className="text-black/70 text-sm">Sorted by compatibility.</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {inCity.map((m) => {
                  const pct = toPercent(m.score);
                  const badge = matchColor(pct);
                  const ol = budgetOverlap(
                    me?.budget_min, me?.budget_max, m.budget_min, m.budget_max
                  );
                  const avatar = avatars[m.candidate_id];
                  return (
                    <div key={m.candidate_id} className="bg-white rounded-2xl p-4 shadow space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={m.full_name || "User"}
                              className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-[#3B2719] text-white grid place-items-center text-sm flex-shrink-0">
                              {initials(m.full_name)}
                            </div>
                          )}
                          <div className="font-bold truncate">{m.full_name || "Gida user"}</div>
                        </div>
                        <div className={`text-sm px-2 py-1 rounded-full border ${badge}`}>
                          Match: {pct}%
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs mt-2">
                        <span className="px-2 py-1 rounded-full bg-black/5">Same City</span>
                        {m.smoking && <span className="px-2 py-1 rounded-full bg-black/5">Smoking: {m.smoking}</span>}
                        {m.schedule && <span className="px-2 py-1 rounded-full bg-black/5">Schedule: {m.schedule}</span>}
                        <span className="px-2 py-1 rounded-full bg-black/5">Budget: {ol}</span>
                      </div>

                      <p className="text-sm text-black/70">
                        {m.bio || "No bio yet."}
                      </p>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setPreview(m)}
                          className="rounded-xl px-4 py-2 border border-black/10 hover:bg-black/5"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => startMessage(m.candidate_id)}
                          className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90"
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* OUT-OF-CITY RESULTS */}
          {city && outCity?.length > 0 && (
            <div className="mt-10">
              <h2 className="text-2xl font-extrabold">
                Good Matches outside {form.location_city}
              </h2>
              <p className="text-black/70 text-sm">These are strong matches, but in other cities.</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {outCity.map((m) => {
                  const pct = toPercent(m.score);
                  const badge = matchColor(pct);
                  const ol = budgetOverlap(
                    me?.budget_min, me?.budget_max, m.budget_min, m.budget_max
                  );
                  const avatar = avatars[m.candidate_id];
                  return (
                    <div key={m.candidate_id} className="bg-white rounded-2xl p-4 shadow space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={m.full_name || "User"}
                              className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-[#3B2719] text-white grid place-items-center text-sm flex-shrink-0">
                              {initials(m.full_name)}
                            </div>
                          )}
                          <div className="font-bold truncate">{m.full_name || "Gida user"}</div>
                        </div>
                        <div className={`text-sm px-2 py-1 rounded-full border ${badge}`}>
                          Match: {pct}%
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs mt-2">
                        <span className="px-2 py-1 rounded-full bg-black/5">{m.location_city || "—"}</span>
                        {m.smoking && <span className="px-2 py-1 rounded-full bg-black/5">Smoking: {m.smoking}</span>}
                        {m.schedule && <span className="px-2 py-1 rounded-full bg-black/5">Schedule: {m.schedule}</span>}
                        <span className="px-2 py-1 rounded-full bg-black/5">Budget: {ol}</span>
                      </div>

                      <p className="text-sm text-black/70">
                        {m.bio || "No bio yet."}
                      </p>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setPreview(m)}
                          className="rounded-xl px-4 py-2 border border-black/10 hover:bg-black/5"
                        >
                          View Profile
                        </button>
                        <button
                          onClick={() => startMessage(m.candidate_id)}
                          className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90"
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No results */}
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
