import React, { useState, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { useDashboardUser } from "../layouts/DashboardLayout";

const GH_LOCATIONS = { /* same as in Listings.jsx */ 
  "Greater Accra": [
    "Accra","East Legon","West Legon","North Legon","Airport Residential",
    "Cantonments","Labone","Osu","Dzorwulu","Roman Ridge","Abelemkpe",
    "Ridge","Spintex","Teshie","Nungua","Sakumono","Lashibi","Tema",
    "Tema Community 1","Tema Community 2","Tema Community 3","Tema Community 4",
    "Tema Community 5","Tema Community 6","Tema Community 7","Tema Community 8",
    "Tema Community 9","Tema Community 10","Tema Community 11","Tema Community 12",
    "Tema Community 13","Tema Community 14","Tema Community 15","Tema Community 16",
    "Tema Community 17","Tema Community 18","Tema Community 19","Tema Community 20",
    "Tema Community 25","Ashaiman","Adenta","Madina","Ashaley Botwe","Trassaco",
    "Oyibi","Oyarifa","Pokuase","Amasaman","Achimota","Haatso","Agbogba",
    "Kwabenya","Dansoman","Kasoa (GA boundary)","Weija","Sowutuom","Darkuman",
    "Mallam","Gbawe","McCarthy Hill","Tuba","Bortianor","Kokrobite"
  ],
  "Ashanti": ["Kumasi","Asokwa","Tafo","Suame","Ejisu","Obuasi","Tanoso","Atonsu","Kwadaso","Nyhiaeso","Santasi","Bantama","Bekwai","Mampong"],
  "Western": ["Sekondi-Takoradi","Anaji","Airport Ridge","Tarkwa","Apowa","Effia","Shama"],
  "Central": ["Cape Coast","Kasoa","Elmina","Mankessim","Winneba","Agona Swedru"],
  "Eastern": ["Koforidua","Nsawam","Akosombo","Aburi","Akim Oda","Nkawkaw"],
  "Northern": ["Tamale","Savelugu","Walewale","Yendi"],
  "Volta": ["Ho","Hohoe","Sogakope","Keta","Aflao"],
  "Upper East": ["Bolgatanga","Navrongo","Bawku"],
  "Upper West": ["Wa","Lawra","Tumu"],
  "Bono": ["Sunyani","Berekum","Dormaa Ahenkro"],
  "Bono East": ["Techiman","Kintampo","Atebubu"],
  "Ahafo": ["Goaso","Bechem"],
  "Western North": ["Sefwi Wiawso","Bibiani","Juaboso"],
  "Oti": ["Dambai","Jasikan","Nkwanta"],
  "Savannah": ["Damongo","Bole","Salaga"],
  "North East": ["Nalerigu","Gambaga"],
};

const BEDROOM_CHOICES = ["1", "2", "3", "4", "5", "5+"];
const AMENITIES = ["Wi-Fi","AC","Washer","Parking","Kitchen","Wardrobe","Security","Good road","Ghana Water","Running water","Borehole"];

export default function AddListing() {
  const user = useDashboardUser();

  // Core fields
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState(""); // neighborhood/landmark
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  // New persisted fields (no roomType; combine into Bedrooms)
  const [bedrooms, setBedrooms] = useState("");
  const [amenities, setAmenities] = useState([]);

  // Optional prefs (kept for compatibility)
  const [gender, setGender] = useState("Any");
  const [lifestyle, setLifestyle] = useState("Any");
  const [pets, setPets] = useState("No preference");

  // Images
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const fileInputRef = useRef(null);

  const [msg, setMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  const citiesForRegion = useMemo(
    () => (region ? GH_LOCATIONS[region] || [] : Object.values(GH_LOCATIONS).flat()),
    [region]
  );

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

  const toggleAmenity = (name) =>
    setAmenities((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

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

    // Require Title, Region, City, Location, Price, Description
    if (!title || !region || !city || !location || !price || !description) {
      return setMsg("Title, region, city, location, price, and description are required.");
    }
    if (!user?.id) return setMsg("You must be logged in to add a listing.");

    try {
      setAdding(true);

      const urls = await uploadImagesAndGetUrls();
      const mainUrl = urls[0] || null;
      const extraUrls = urls.slice(1);
      const bedroomsValue = bedrooms === "5+" ? 5 : bedrooms ? Number(bedrooms) : null;

      const { data: listing, error: listingErr } = await supabase
        .from("listings")
        .insert([
          {
            user_id: user.id,
            title,
            location,
            city,                // store canonical city
            price: Number(price),
            description,
            image_url: mainUrl,
            is_published: true,
            bedrooms: bedroomsValue,
            amenities: amenities.length ? amenities : null,
            // keep old prefs columns for compatibility if they exist
            gender_pref: gender,
            lifestyle_pref: lifestyle,
            pets_pref: pets,
          },
        ])
        .select("id")
        .single();

      if (listingErr) throw listingErr;

      if (extraUrls.length) {
        const rows = extraUrls.map((url) => ({ listing_id: listing.id, url }));
        const { error: imgErr } = await supabase.from("listing_images").insert(rows);
        if (imgErr) throw imgErr;
      }

      setMsg("Listing added!");
      // reset
      setTitle(""); setRegion(""); setCity(""); setLocation(""); setPrice(""); setDescription("");
      setBedrooms(""); setAmenities([]); setGender("Any"); setLifestyle("Any"); setPets("No preference");
      setFiles([]); setPreviews([]); if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (err) {
      setMsg(`Error: ${err.message || String(err)}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F2E9] py-6 px-4">
      <div className="mx-auto max-w-4xl rounded-2xl bg-[#FBF3E6] shadow-xl p-6 sm:p-10">
        <div className="mb-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#5B3A1E]">Create Listing</h1>
        </div>

        {msg && (
          <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${/^Error:|error/i.test(msg) ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {msg}
          </div>
        )}

        <form onSubmit={submit} className="space-y-7">
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Title *</label>
            <input
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              placeholder="e.g., Cozy 2BR Apartment in East Legon"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Region + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Region *</label>
              <select
                className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                value={region}
                onChange={(e) => { setRegion(e.target.value); setCity(""); }}
                required
              >
                <option value="">Select region</option>
                {Object.keys(GH_LOCATIONS).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2B2B2B] mb-2">City/Town *</label>
              <select
                className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              >
                <option value="">Select city/town</option>
                {citiesForRegion.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Neighborhood / Landmark *</label>
            <input
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              placeholder="e.g., Near American House, East Legon"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Price (GHS) *</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                placeholder="e.g., 3500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Bedrooms</label>
              <select
                className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
              >
                <option value="">Select</option>
                {BEDROOM_CHOICES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Amenities</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AMENITIES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={amenities.includes(a)} onChange={() => toggleAmenity(a)} />
                  <span>{a}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Upload Photos</label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFilesChange} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {previews.map((src, i) => (
                <div key={i} className="relative h-28 rounded-xl border-2 border-dashed border-[#E7E1D8] bg-white overflow-hidden flex items-center justify-center">
                  <img src={src} alt={`Preview ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImageAt(i)} className="absolute top-1.5 right-1.5 rounded-full bg-white/90 text-xs px-2 py-0.5 shadow" title="Remove">✕</button>
                </div>
              ))}
              <button type="button" onClick={triggerPick} className="h-28 rounded-xl border-2 border-dashed border-[#E7E1D8] bg-[#F7F2E9] hover:bg-[#f1e8d9] flex items-center justify-center" title="Add photos">
                <span className="text-2xl text-[#8B5E34]">+</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">First photo becomes the main image. JPEG/PNG, &lt; 5MB each.</p>
          </div>

          {/* Description (required) */}
          <div>
            <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Description *</label>
            <textarea
              rows={5}
              className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#A6724B]"
              placeholder="e.g., Spacious 2-bedroom apartment in East Legon with borehole water, tiled floors, fitted kitchen, and gated compound. 5 mins from American House. 1 year advance."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Optional roommate prefs */}
          <div>
            <h3 className="text-lg font-semibold text-[#2B2B2B] mb-4">Roommate Preferences (optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Gender</label>
                <select className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option>Any</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Lifestyle</label>
                <select className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3" value={lifestyle} onChange={(e) => setLifestyle(e.target.value)}>
                  <option>Any</option><option>Quiet</option><option>Social</option><option>Early riser</option><option>Night owl</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2B2B2B] mb-2">Pets</label>
                <select className="w-full rounded-xl border border-[#E7E1D8] bg-white px-4 py-3" value={pets} onChange={(e) => setPets(e.target.value)}>
                  <option>No preference</option><option>No pets allowed</option><option>Pets allowed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <button className="w-full rounded-xl bg-[#5B3A1E] text-white py-3 font-semibold hover:opacity-95 disabled:opacity-60" disabled={adding}>
              {adding ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
