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
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        gender_pref: form.gender_pref,
      };

      const { error: upErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (upErr) throw upErr;

      // call server-side matching
      const { data: suggested, error: mErr } = await supabase
        .rpc("match_roommates", { p_user: user.id, p_limit: 24 });

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

  if (loading) return <div className="p-6">Loading…</div>;

  const inboxPath = "/app/inbox";
  const inboxHref = user ? inboxPath : `/auth?next=${encodeURIComponent(inboxPath)}`;
  const isHidden = me && me.is_active === false;

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
            Answer a few quick questions. We’ll compute a compatibility score and suggest roommates in {form.location_city || "your city"}.
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
                className="w-full rounded-xl border border-black/10 px-3 py-2"
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

          {/* RESULTS */}
          {matches?.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-extrabold">Suggested Roommates</h2>
              <p className="text-black/70 text-sm">Sorted by compatibility score.</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {matches.map((m) => (
                  <div key={m.candidate_id} className="bg-white rounded-2xl p-4 shadow space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold">{m.full_name || "Gida user"}</div>
                      <div className="text-sm px-2 py-1 rounded-full bg-black/5">
                        Score: {Math.round(m.score)}
                      </div>
                    </div>
                    <div className="text-sm text-black/70">
                      {m.location_city || "—"} • Cleanliness {m.cleanliness || "—"} • {m.schedule}
                    </div>
                    <p className="text-sm line-clamp-2">{m.bio || "No bio yet."}</p>

                    <div className="flex gap-2 pt-2">
                      <Link
                        to={`/profile/${m.candidate_id}`}
                        className="rounded-xl px-4 py-2 border border-black/10 hover:bg-black/5"
                      >
                        View Profile
                      </Link>
                      <Link
                        to={`/app/inbox?to=${m.candidate_id}`}
                        className="rounded-xl px-4 py-2 bg-[#3B2719] text-white hover:opacity-90"
                      >
                        Message
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matches?.length === 0 && !saving && (
            <p className="mt-6 text-black/70">
              No strong matches yet. Try widening your budget or selecting “Any” for gender.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
