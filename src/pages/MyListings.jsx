import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useDashboardUser } from "../layouts/DashboardLayout";

/** Regions → Cities (same canonical list used in Listings/AddListing) */
const GH_LOCATIONS = {
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

const AMENITIES = [
  "Wi-Fi","AC","Washer","Parking","Kitchen","Wardrobe","Security",
  "Good road","Ghana Water","Running water","Borehole",
];

function regionForCity(city) {
  if (!city) return "";
  for (const [reg, cities] of Object.entries(GH_LOCATIONS)) {
    if (cities.includes(city)) return reg;
  }
  return ""; // unknown/legacy value
}

export default function MyListings() {
  const user = useDashboardUser();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // selection + bulk actions
  const [selected, setSelected] = useState([]);
  const allSelected = listings.length > 0 && selected.length === listings.length;

  // inline edit state (aligned with AddListing: region+city, bedrooms, amenities)
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "", location: "", region: "", city: "", price: "", description: "",
    bedrooms: "", amenities: [],
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) setMsg(error.message);
    else setListings(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();

    const channel = supabase
      .channel("listings-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = () => { if (allSelected) setSelected([]); else setSelected(listings.map((l) => l.id)); };

  const deleteOne = async (id) => {
    if (!window.confirm("Delete this listing?")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
      setListings((prev) => prev.filter((l) => l.id !== id));
      setSelected((s) => s.filter((x) => x !== id));
    } catch (e) {
      setMsg(e.message || String(e));
    } finally {
      setDeleting(false);
    }
  };
  const deleteSelected = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} selected listing(s)?`)) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("listings").delete().in("id", selected);
      if (error) throw error;
      setListings((prev) => prev.filter((l) => !selected.includes(l.id)));
      setSelected([]);
    } catch (e) {
      setMsg(e.message || String(e));
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (item) => {
    const reg = regionForCity(item.city);
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      location: item.location || "",
      region: reg,
      city: item.city || "",
      price: item.price ?? "",
      description: item.description || "",
      bedrooms: item.bedrooms == null ? "" : (item.bedrooms >= 5 ? "5+" : String(item.bedrooms)),
      amenities: Array.isArray(item.amenities) ? item.amenities : [],
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm({ title: "", location: "", region: "", city: "", price: "", description: "", bedrooms: "", amenities: [] });
  };
  const toggleAmenity = (name) =>
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(name) ? f.amenities.filter((x) => x !== name) : [...f.amenities, name],
    }));

  // cities list for chosen region (or all if none picked)
  const cityOptions = useMemo(
    () => (form.region ? GH_LOCATIONS[form.region] || [] : Object.values(GH_LOCATIONS).flat()),
    [form.region]
  );

  const saveEdit = async (e) => {
    e?.preventDefault();
    if (!editingId) return;

    if (!form.title || !form.city || !form.location || !form.price || !form.description) {
      setMsg("Title, city, location, price, and description are required.");
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title,
      location: form.location,
      city: form.city, // store canonical city only (region is UX)
      price: Number(form.price) || 0,
      description: form.description,
      bedrooms: form.bedrooms === "" ? null : (form.bedrooms === "5+" ? 5 : Number(form.bedrooms)),
      amenities: form.amenities.length ? form.amenities : null,
    };
    const { error } = await supabase.from("listings").update(payload).eq("id", editingId);
    if (error) setMsg(error.message);
    else {
      setListings((prev) => prev.map((l) => (l.id === editingId ? { ...l, ...payload } : l)));
      cancelEdit();
    }
    setSaving(false);
  };

  return (
    <div>
      <h1 style={{ margin: "0 0 14px", color: "#5B3A1E" }}>My Listings</h1>

      {/* toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
          <span>Select all</span>
        </label>
        <button className="btn" onClick={deleteSelected} disabled={selected.length === 0 || deleting}>
          {deleting ? "Deleting…" : `Delete Selected (${selected.length})`}
        </button>
        {msg && <span style={{ color: "#b91c1c", marginLeft: 8 }}>{msg}</span>}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : listings.length === 0 ? (
        <p>No listings yet.</p>
      ) : (
        <div className="grid">
          {listings.map((it) => {
            const isEditing = editingId === it.id;
            const priceBadge = it.price != null ? `GH₵${Number(it.price).toLocaleString("en-GH")}/mo` : "—";

            return (
              <article key={it.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={selected.includes(it.id)} onChange={() => toggleSelect(it.id)} />
                    <span style={{ opacity: 0.7, fontSize: 14 }}>Select</span>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!isEditing ? (
                      <>
                        <button className="btn" onClick={() => startEdit(it)}>Edit</button>
                        <button className="btn btn--danger" onClick={() => deleteOne(it.id)}>Delete</button>
                      </>
                    ) : (
                      <>
                        <button className="btn" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                        <button className="btn btn--ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
                      </>
                    )}
                  </div>
                </div>

                {it.image_url && !isEditing && (
                  <img
                    src={it.image_url}
                    alt={it.title}
                    style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 10 }}
                  />
                )}

                {!isEditing ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 800 }}>{it.title}</div>
                      <div style={{ fontWeight: 800 }}>{priceBadge}</div>
                    </div>
                    <div style={{ color: "#6b7280", marginTop: 4 }}>
                      {it.location}{it.city ? `, ${it.city}` : ""}{it.bedrooms ? ` • ${it.bedrooms} BR` : ""}
                    </div>
                    {Array.isArray(it.amenities) && it.amenities.length > 0 && (
                      <div style={{ color: "#374151", marginTop: 6, fontSize: 14 }}>
                        Amenities: {it.amenities.join(", ")}
                      </div>
                    )}
                    {it.description && (
                      <p style={{ color: "#374151", marginTop: 8, fontSize: 14 }}>{it.description}</p>
                    )}
                  </>
                ) : (
                  <form onSubmit={saveEdit} style={{ display: "grid", gap: 8 }}>
                    <input
                      className="input"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Title *"
                      required
                    />

                    {/* Region + City (store only City) */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select
                        className="input"
                        value={form.region}
                        onChange={(e) => setForm((f) => ({ ...f, region: e.target.value, city: "" }))}
                      >
                        <option value="">Region</option>
                        {Object.keys(GH_LOCATIONS).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select
                        className="input"
                        value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        required
                      >
                        <option value="">City/Town *</option>
                        {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        className="input"
                        value={form.location}
                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                        placeholder="Neighborhood / Landmark *"
                        required
                      />
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        placeholder="Price (GHS) *"
                        required
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <select
                        className="input"
                        value={form.bedrooms}
                        onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                      >
                        <option value="">Bedrooms</option>
                        <option>1</option><option>2</option><option>3</option>
                        <option>4</option><option>5</option><option>5+</option>
                      </select>
                      <div /> {/* spacer */}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {AMENITIES.map((a) => (
                        <label key={a} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                          <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
                          <span>{a}</span>
                        </label>
                      ))}
                    </div>

                    <textarea
                      className="textarea"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="e.g., Spacious 2-bedroom in East Legon with borehole water, tiled floors, fitted kitchen, gated compound. 5 mins from American House. 1 year advance. *"
                      required
                    />
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
