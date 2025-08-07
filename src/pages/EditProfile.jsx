import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Logo from "../assets/logo.png";

const GENDERS = ["Male", "Female", "Non-binary", "Other", "Prefer not to say"];
const LIFESTYLES = ["Very clean", "Clean", "Average", "Laid back"];
const SMOKING = ["Non-smoker", "Occasionally", "Smoker"];
const PETS = ["No pets", "Cat", "Dog", "Other"];

export default function EditProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [lifestyle, setLifestyle] = useState("");
  const [smoking, setSmoking] = useState("");
  const [pets, setPets] = useState("");
  const [about, setAbout] = useState("");
  const [interests, setInterests] = useState(""); // comma-separated string for UI
  const [preferredRoommates, setPreferredRoommates] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // ------ Load user + profile ------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate("/auth");
        return;
      }
      setUser(auth.user);

      // fetch or init profile
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          [
            "id",
            "full_name",
            "age",
            "gender",
            "budget",
            "currency",
            "lifestyle",
            "smoking",
            "pets",
            "about",
            "interests",
            "preferred_roommates",
            "avatar_url",
            "is_verified",
          ].join(",")
        )
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
        setSmoking(profile.smoking || "");
        setPets(profile.pets || "");
        setAbout(profile.about || "");
        setInterests(
          Array.isArray(profile.interests) ? profile.interests.join(", ") : (profile.interests || "")
        );
        setPreferredRoommates(profile.preferred_roommates || "");
        setAvatarUrl(profile.avatar_url || "");
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

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

  // ------ Avatar upload ------
  const onAvatarChange = async (file) => {
    if (!file || !user) return;
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
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

  // ------ Save profile ------
  const onSave = async (e) => {
    e?.preventDefault?.();
    if (!user) return navigate("/auth");
    setSaving(true);
    setErr(null);

    const interestsArray =
      interests
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean) || [];

    const payload = {
      id: user.id,
      full_name: fullName || null,
      age: age ? Number(age) : null,
      gender: gender || null,
      budget: budget ? Number(budget) : null,
      currency: currency || null,
      lifestyle: lifestyle || null,
      smoking: smoking || null,
      pets: pets || null,
      about: about || null,
      interests: interestsArray.length ? interestsArray : null,
      preferred_roommates: preferredRoommates || null,
      avatar_url: avatarUrl || null,
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
            <Link to="/listings" className="hover:opacity-70">Find Room</Link>
            <Link to="/app/my-listings" className="hover:opacity-70">View Listings</Link>
            <Link to="/auth" className="hover:opacity-70">Sign Out</Link>
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
            <label
              className="mt-4 inline-block cursor-pointer rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-black/5"
            >
              Upload photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onAvatarChange(e.target.files?.[0])}
              />
            </label>
          </div>

          {/* Right: editable fields matching the mock */}
          <form onSubmit={onSave} className="bg-white rounded-3xl p-6 shadow">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <input
                className="text-3xl md:text-5xl font-extrabold bg-transparent outline-none w-full md:w-auto"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <Field label="Age">
                <input
                  type="number"
                  className="w-full rounded-xl border border-black/10 px-3 py-2"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </Field>

              <Field label="Gender">
                <select
                  className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </Field>

              <Field label="Budget">
                <div className="flex gap-2">
                  <select
                    className="rounded-xl border border-black/10 px-3 py-2 bg-white"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option>GHS</option>
                    <option>USD</option>
                    <option>EUR</option>
                  </select>
                  <input
                    type="number"
                    className="flex-1 rounded-xl border border-black/10 px-3 py-2"
                    placeholder="e.g. 1500"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                {badgeBudget && <div className="mt-1 text-sm text-black/70">{badgeBudget}</div>}
              </Field>

              <Field label="Lifestyle">
                <select
                  className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white"
                  value={lifestyle}
                  onChange={(e) => setLifestyle(e.target.value)}
                >
                  <option value="">Select</option>
                  {LIFESTYLES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>

              <Field label="Smoking">
                <select
                  className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white"
                  value={smoking}
                  onChange={(e) => setSmoking(e.target.value)}
                >
                  {SMOKING.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              <Field label="Pets">
                <select
                  className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white"
                  value={pets}
                  onChange={(e) => setPets(e.target.value)}
                >
                  {PETS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
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
                <h3 className="text-2xl font-extrabold">Preferred Roommates</h3>
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

              <Link
                to="/app/inbox"
                className="rounded-xl border border-black/10 px-6 py-3 font-semibold hover:bg-black/5"
              >
                Message
              </Link>

              <Link
                to="/app/my-listings"
                className="rounded-xl border border-black/10 px-6 py-3 font-semibold hover:bg-black/5"
              >
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
