// src/pages/EditProfile.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";

const GENDERS = ["Male", "Female", "Non-binary", "Other", "Prefer not to say"];
const LIFESTYLES = ["Very clean", "Clean", "Average", "Laid back"];
const PETS = ["No pets", "Cat", "Dog", "Other"];
const GH_CITIES = ["Accra","Kumasi","Takoradi","Tema","Kasoa","Cape Coast","Sunyani","Ho","Tamale"];
const SCHEDULES = [
  { label: "Early riser", value: "early" },
  { label: "Flexible", value: "flex" },
  { label: "Night owl", value: "late" },
];
const SMOKING_UI = [
  { label: "No smoking", value: "never" },
  { label: "Only outside", value: "outside_only" },
  { label: "It’s okay", value: "ok" },
];

export default function EditProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Header badge (unread)
  const [unread, setUnread] = useState(0);

  // Core profile
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [budget, setBudget] = useState("");           // legacy single budget
  const [currency, setCurrency] = useState("GHS");
  const [lifestyle, setLifestyle] = useState("");
  const [pets, setPets] = useState("");
  const [about, setAbout] = useState("");
  const [interests, setInterests] = useState("");
  const [preferredRoommates, setPreferredRoommates] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Roommate matching fields
  const [locationCity, setLocationCity] = useState("");
  const [cleanliness, setCleanliness] = useState(3);
  const [smoking, setSmoking] = useState("never");
  const [schedule, setSchedule] = useState("flex");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [genderPref, setGenderPref] = useState("any");

  // Have-a-place fields
  const [hasPlace, setHasPlace] = useState(false);
  const [rentTotal, setRentTotal] = useState("");
  const [splitYou, setSplitYou] = useState("");
  const [splitThem, setSplitThem] = useState("");
  const [utilitiesIncluded, setUtilitiesIncluded] = useState(false);
  const [availableFrom, setAvailableFrom] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { navigate("/auth"); return; }
      setUser(auth.user);

      // unread badge initial
      refreshUnread(auth.user.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
          id,full_name,age,gender,budget,currency,lifestyle,pets,about,interests,preferred_roommates,avatar_url,
          is_active,location_city,cleanliness,smoking,schedule,budget_min,budget_max,gender_pref,
          has_place,rent_total_ghs,split_you,split_them,utilities_included,available_from,lease_end
        `)
        .eq("id", auth.user.id)
        .maybeSingle();

      if (error) setErr(error.message);
      if (profile) {
        setFullName(profile.full_name || "");
        setAge(profile.age ?? "");
        setGender(profile.gender || "");
        setBudget(profile.budget ?? "");
        setCurrency(profile.currency || "GHS");
        setLifestyle(profile.lifestyle || "");
        setPets(profile.pets || "");
        setAbout(profile.about || "");
        setInterests(Array.isArray(profile.interests) ? profile.interests.join(", ") : (profile.interests || ""));
        setPreferredRoommates(profile.preferred_roommates || "");
        setAvatarUrl(profile.avatar_url || "");

        setIsActive(profile.is_active ?? true);
        setLocationCity(profile.location_city || "");
        setCleanliness(profile.cleanliness ?? 3);
        setSmoking(profile.smoking || "never");
        setSchedule(profile.schedule || "flex");
        setBudgetMin(profile.budget_min ?? "");
        setBudgetMax(profile.budget_max ?? "");
        setGenderPref(profile.gender_pref || "any");

        setHasPlace(!!profile.has_place);
        setRentTotal(profile.rent_total_ghs ?? "");
        setSplitYou(profile.split_you ?? "");
        setSplitThem(profile.split_them ?? "");
        setUtilitiesIncluded(!!profile.utilities_included);
        setAvailableFrom(profile.available_from ?? "");
        setLeaseEnd(profile.lease_end ?? "");
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  // Live unread badge via realtime inserts
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => refreshUnread(user.id)
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  async function refreshUnread(uid) {
    // Count threads with has_unread=true from the view/RPC you already use
    const { data, error } = await supabase
      .from("inbox_threads")
      .select("has_unread")
      .eq("me_id", uid);
    if (!error) {
      setUnread((data || []).filter((t) => t.has_unread).length);
    }
  }

  const badgeBudget = useMemo(() => {
    if (!budget) return "";
    const amt = Number(budget);
    if (Number.isNaN(amt)) return "";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "GHS",
      maximumFractionDigits: 0,
    }).format(amt) + "/month";
  }, [budget, currency]);

  const guestShare = useMemo(() => {
    const rt = Number(rentTotal);
    const a = Number(splitYou);
    const b = Number(splitThem);
    if (!hasPlace || !rt || !a || !b || a + b <= 0) return null;
    return Math.round((rt * (b / (a + b))) * 100) / 100;
  }, [hasPlace, rentTotal, splitYou, splitThem]);

  const onAvatarChange = async (file) => {
    if (!file || !user) return;
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      setAvatarUrl(url);
    } catch (e) {
      console.error(e);
      alert("Avatar upload failed.");
    }
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    if (!user) return navigate("/auth");
    setSaving(true);
    setErr(null);

    const interestsArray =
      interests.split(",").map((t) => t.trim()).filter(Boolean) || [];

    const payload = {
      id: user.id,
      full_name: fullName || null,
      age: age ? Number(age) : null,
      gender: gender || null,
      budget: budget ? Number(budget) : null,
      currency: currency || null,
      lifestyle: lifestyle || null,
      pets: pets || null,
      about: about || null,
      interests: interestsArray.length ? interestsArray : null,
      preferred_roommates: preferredRoommates || null,
      avatar_url: avatarUrl || null,

      is_active: !!isActive,
      location_city: locationCity || null,
      cleanliness: cleanliness ? Number(cleanliness) : 3,
      smoking,
      schedule,
      budget_min: budgetMin ? Number(budgetMin) : null,
      budget_max: budgetMax ? Number(budgetMax) : null,
      gender_pref: genderPref || "any",

      has_place: !!hasPlace,
      rent_total_ghs: rentTotal ? Number(rentTotal) : null,
      split_you: splitYou ? Number(splitYou) : null,
      split_them: splitThem ? Number(splitThem) : null,
      utilities_included: !!utilitiesIncluded,
      available_from: availableFrom || null,
      lease_end: leaseEnd || null,

      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    setSaving(false);
    if (error) {
      console.error(error);
      setErr(error.message);
      alert(`Failed to save: ${error.message}`);
    } else {
      alert("Profile saved!");
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

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
            <Link to="/roommate-matching" className="hover:opacity-70">Roommate Matching</Link>
            <Link to="/app/inbox" className="relative hover:opacity-70">
              Messages
              {unread > 0 && (
                <span className="absolute -right-3 -top-2 rounded-full bg-orange-500 text-white text-[10px] px-2 py-0.5">
                  {unread}
                </span>
              )}
            </Link>
            <Link to="/app/my-listings" className="hover:opacity-70">View Listings</Link>
            <button onClick={logout} className="hover:opacity-70">Sign Out</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Top section (avatar + key facts) */}
        <section className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-8">
          {/* Left: avatar */}
          <div className="bg-white rounded-3xl p-5 shadow">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black/5 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={fullName || "Avatar"} className="w-full h-full object-cover" />
              ) : (
                <div className="opacity-50">No photo</div>
              )}
            </div>
            <label className="mt-4 inline-block cursor-pointer rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-black/5">
              Upload photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onAvatarChange(e.target.files?.[0])}/>
            </label>
          </div>

          {/* Right: editable fields */}
          <form onSubmit={onSave} className="bg-white rounded-3xl p-6 shadow">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <input
                className="text-3xl md:text-5xl font-extrabold bg-transparent outline-none w-full md:w-auto"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {/* Visibility toggle */}
            <div className="mt-3">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span className="text-sm">Show my profile in roommate matching</span>
              </label>
            </div>

            {/* Fields */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <Field label="Age">
                <input type="number" className="w-full rounded-xl border border-black/10 px-3 py-2" value={age} onChange={(e) => setAge(e.target.value)} />
              </Field>

              <Field label="Gender">
                <select className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>

              <Field label="Budget (single)">
                <div className="flex gap-2">
                  <select className="rounded-xl border border-black/10 px-3 py-2 bg-white" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option>GHS</option><option>USD</option><option>EUR</option>
                  </select>
                  <input type="number" className="flex-1 rounded-xl border border-black/10 px-3 py-2" placeholder="e.g. 1500" value={budget} onChange={(e) => setBudget(e.target.value)} />
                </div>
                {badgeBudget && <div className="mt-1 text-sm text-black/70">{badgeBudget}</div>}
              </Field>

              <Field label="Lifestyle">
                <select className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white" value={lifestyle} onChange={(e) => setLifestyle(e.target.value)}>
                  <option value="">Select</option>
                  {LIFESTYLES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>

              <Field label="City">
                <select className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white" value={locationCity} onChange={(e) => setLocationCity(e.target.value)}>
                  <option value="">Select city</option>
                  {GH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Cleanliness (1–5)">
                <input type="range" min="1" max="5" value={cleanliness} onChange={(e) => setCleanliness(e.target.value)} className="w-full" />
                <div className="text-sm mt-1">Preference: {cleanliness}/5</div>
              </Field>

              <Field label="Smoking">
                <select className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white" value={smoking} onChange={(e) => setSmoking(e.target.value)}>
                  {SMOKING_UI.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>

              <Field label="Schedule">
                <select className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                  {SCHEDULES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>

              <Field label="Budget Range (GHS)">
                <div className="flex gap-2">
                  <input type="number" className="w-full rounded-xl border border-black/10 px-3 py-2" placeholder="Min e.g. 800" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                  <input type="number" className="w-full rounded-xl border border-black/10 px-3 py-2" placeholder="Max e.g. 2000" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                </div>
              </Field>

              <Field label="Preferred Roommate Gender">
                <select className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white" value={genderPref} onChange={(e) => setGenderPref(e.target.value)}>
                  <option value="any">Any</option>
                  <option value="male">Male only</option>
                  <option value="female">Female only</option>
                </select>
              </Field>
            </div>

            {/* Have a place */}
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={hasPlace} onChange={(e)=>setHasPlace(e.target.checked)} />
                <span className="font-semibold">I already have a place and want a roommate to split the rent</span>
              </label>

              {hasPlace && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Total monthly rent (GHS)">
                    <input type="number" className="w-full rounded-xl border border-black/10 px-3 py-2"
                      value={rentTotal} onChange={(e)=>setRentTotal(e.target.value)} />
                  </Field>

                  <Field label="Split ratio (Me : Roommate)">
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-24 rounded-xl border border-black/10 px-3 py-2"
                        value={splitYou} onChange={(e)=>setSplitYou(e.target.value)} placeholder="1" />
                      <span>:</span>
                      <input type="number" className="w-24 rounded-xl border border-black/10 px-3 py-2"
                        value={splitThem} onChange={(e)=>setSplitThem(e.target.value)} placeholder="1" />
                    </div>
                  </Field>

                  <Field label="Available from">
                    <input type="date" className="w-full rounded-xl border border-black/10 px-3 py-2"
                      value={availableFrom || ""} onChange={(e)=>setAvailableFrom(e.target.value)} />
                  </Field>

                  <Field label="Lease end">
                    <input type="date" className="w-full rounded-xl border border-black/10 px-3 py-2"
                      value={leaseEnd || ""} onChange={(e)=>setLeaseEnd(e.target.value)} />
                  </Field>

                  <div className="md:col-span-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={utilitiesIncluded} onChange={(e)=>setUtilitiesIncluded(e.target.checked)} />
                      <span>Utilities included</span>
                    </label>
                  </div>

                  {guestShare != null && (
                    <div className="md:col-span-2 text-sm">
                      A future roommate would pay about <b>{guestShare.toLocaleString()} GHS</b> per month (rent only).
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* About */}
            <h3 className="mt-8 text-2xl font-extrabold">About Me</h3>
            <textarea
              className="mt-3 w-full min-h-[120px] rounded-xl border border-black/10 px-3 py-2"
              placeholder="Tell us a bit about yourself…"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
            />

            {/* Interests + Preferred Roommates */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-2xl font-extrabold">Interests</h3>
                <input
                  className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2"
                  placeholder="Comma separated (e.g., Cooking, hiking, movies)"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                />
              </div>

              <div>
                <h3 className="text-2xl font-extrabold">Preferred Roommates (notes)</h3>
                <input
                  className="mt-3 w-full rounded-xl border border-black/10 px-3 py-2"
                  placeholder="Young professional, neat, respectful…"
                  value={preferredRoommates}
                  onChange={(e) => setPreferredRoommates(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#5B3A1E] text-white px-6 py-3 font-semibold hover:opacity-95 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Profile"}
              </button>

              <Link to="/app/inbox" className="rounded-xl border border-black/10 px-6 py-3 font-semibold hover:bg-black/5">
                Message
              </Link>

              <Link to="/app/my-listings" className="rounded-xl border border-black/10 px-6 py-3 font-semibold hover:bg-black/5">
                View Listings
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-black/70">{label}</div>
      <div className="mt-1">{children}</div>
    </label>
  );
}
