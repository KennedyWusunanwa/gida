import React, { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useDashboardUser } from "../layouts/DashboardLayout";

export default function AddListing() {
  const user = useDashboardUser();

  // Core fields
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  // New UI fields (now persisted)
  const [roomType, setRoomType] = useState("Single Room");
  const [gender, setGender] = useState("Any");
  const [lifestyle, setLifestyle] = useState("Any");
  const [pets, setPets] = useState("No preference");

  // Images
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);

  const [msg, setMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  // ---- handlers ----
  const onFilesChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const next = [...files, ...selected].slice(0, 12);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const removeImageAt = (idx) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const triggerPick = () => fileInputRef.current?.click();

  const uploadImagesAndGetUrls = async () => {
    if (!files.length) return [];
    const bucket = "listing-images";
    const uploads = files.map(async (f, idx) => {
      const path = `${user.id}/${Date.now()}-${idx}-${f.name.replace(/\s+/g, "-")}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || "image/*",
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    });
    return Promise.all(uploads);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!title || !location || !city || !price) {
      return setMsg("Title, location, city, and price are required.");
    }
    if (!user?.id) return setMsg("You must be logged in to add a listing.");

    try {
      setAdding(true);

      // 1) Upload images
      const urls = await uploadImagesAndGetUrls();
      const mainUrl = urls[0] || null;
      const extraUrls = urls.slice(1);

      // 2) Insert listing (PERSIST NEW FIELDS)
      const { data: listing, error: listingErr } = await supabase
        .from("listings")
        .insert([
          {
            user_id: user.id,
            title,
            location,
            city,
            price: Number(price),
            description,
            image_url: mainUrl,
            is_published: true,

            // NEW persisted fields
            room_type: roomType,
            gender_pref: gender,
            lifestyle_pref: lifestyle,
            pets_pref: pets,
          },
        ])
        .select("id")
        .single();

      if (listingErr) throw listingErr;

      // 3) Extra images
      if (extraUrls.length) {
        const rows = extraUrls.map((url) => ({ listing_id: listing.id, url }));
        const { error: imgErr } = await supabase.from("listing_images").insert(rows);
        if (imgErr) throw imgErr;
      }

      setMsg("Listing added!");
      // reset
      setTitle("");
      setLocation("");
      setCity("");
      setPrice("");
      setDescription("");
      setRoomType("Single Room");
      setGender("Any");
      setLifestyle("Any");
      setPets("No preference");
      setFiles([]);
      setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (err) {
      setMsg(`Error: ${err.message || String(err)}`);
    } finally {
      setAdding(false);
    }
  };

  // ---- UI ----
  return (
    <div className="min-h-screen bg-[#F7F2E9] py-6 px-4">
      <div className="mx-auto max-w-4xl rounded-2xl bg-[#FBF3E6] shadow-xl p-6 sm:p-10">
        {/* Title */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#5B3A1E]">
            Create Listing
          </h1>
        </div>

        {/* Section label */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#2B2B2B]">Room Information</h2>
        </div>

        {msg && (
          <div
            className={`mb-6 rounded-lg px-4 py-3 text-sm ${
              /^Error:|error/i.test(msg)
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {msg}
          </div>
        )}

        <form onSubmit={submit} className="space-y-7">
          {/* 1) Title */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">
              Title
            </label>
            <input
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              placeholder="Short title (e.g., Cozy 1BR)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* 2) Location */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">
              Location
            </label>
            <input
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              placeholder="Enter location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* 3) City + 4) Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2B2B2B] mb-2">
                City
              </label>
              <input
                className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                placeholder="Enter city (e.g., Accra)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2B2B2B] mb-2">
                Price
              </label>
              <input
                type="number"
                className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                placeholder="Enter price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          {/* 5) Room Type */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">
              Room Type
            </label>
            <select
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
            >
              <option>Single Room</option>
              <option>Self-Contained</option>
              <option>1 Bedroom</option>
              <option>2 Bedroom</option>
              <option>Shared Room</option>
            </select>
          </div>

          {/* 6) Upload Photos */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">
              Upload Photos
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFilesChange}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="relative h-28 rounded-xl border-2 border-dashed border-[#E7E1D8] bg-white overflow-hidden flex items-center justify-center"
                >
                  <img
                    src={src}
                    alt={`Preview ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImageAt(i)}
                    className="absolute top-1.5 right-1.5 rounded-full bg-white/90 text-xs px-2 py-0.5 shadow"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={triggerPick}
                className="h-28 rounded-xl border-2 border-dashed border-[#E7E1D8] bg-[#F7F2E9] hover:bg-[#f1e8d9] flex items-center justify-center"
                title="Add photos"
              >
                <span className="text-2xl text-[#8B5E34]">+</span>
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              First photo becomes the main image. JPEG/PNG, &lt; 5MB each.
            </p>
          </div>

          {/* 7) Roommate Preferences */}
          <div>
            <h3 className="text-lg font-semibold text-[#2B2B2B] mb-4">
              Roommate Preferences
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Gender</label>
                <select
                  className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option>Any</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Lifestyle</label>
                <select
                  className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                  value={lifestyle}
                  onChange={(e) => setLifestyle(e.target.value)}
                >
                  <option>Any</option>
                  <option>Quiet</option>
                  <option>Social</option>
                  <option>Early riser</option>
                  <option>Night owl</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Pets</label>
                <select
                  className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                  value={pets}
                  onChange={(e) => setPets(e.target.value)}
                >
                  <option>No preference</option>
                  <option>No pets allowed</option>
                  <option>Pets allowed</option>
                </select>
              </div>
            </div>
          </div>

          {/* 8) Description */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">
              Description
            </label>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              placeholder="Describe the place…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Publish */}
          <div className="pt-1">
            <button
              className="w-full rounded-xl bg-[#5B3A1E] text-white py-3 font-semibold hover:opacity-95 disabled:opacity-60"
              disabled={adding}
            >
              {adding ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
