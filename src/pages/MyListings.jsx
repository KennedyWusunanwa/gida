import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useDashboardUser } from "../layouts/DashboardLayout";

const AMENITIES = [
  "Wi-Fi",
  "AC",
  "Washer",
  "Parking",
  "Kitchen",
  "Wardrobe",
  "Security",
  "Good road",
  "Ghana Water",
  "Running water",
  "Borehole",
];

export default function MyListings() {
  const user = useDashboardUser();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // selection + bulk actions
  const [selected, setSelected] = useState([]);
  const allSelected = listings.length > 0 && selected.length === listings.length;

  // inline edit state (now includes bedrooms & amenities)
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "", location: "", city: "", price: "", description: "",
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
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      location: item.location || "",
      city: item.city || "",
      price: item.price ?? "",
      description: item.description || "",
      bedrooms: item.bedrooms ?? "",
      amenities: Array.isArray(item.amenities) ? item.amenities : [],
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm({ title: "", location: "", city: "", price: "", description: "", bedrooms: "", amenities: [] });
  };
  const toggleAmenity = (name) =>
    setForm((f) => ({ ...f, amenities: f.amenities.includes(name) ? f.amenities.filter((x) => x !== name) : [...f.amenities, name] }));

  const saveEdit = async (e) => {
    e?.preventDefault();
    if (!editingId) return;
    setSaving(true);
    const payload = {
      title: form.title,
      location: form.location,
      city: form.city,
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
                      <div style={{ fontWeight: 800 }}>GH₵{Number(it.price).toLocaleString()}/mo</div>
                    </div>
                    <div style={{ color: "#6b7280", marginTop: 4 }}>
                      {it.location}, {it.city}{it.bedrooms ? ` • ${it.bedrooms} BR` : ""}
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
                    <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Location" />
                      <input className="input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="City" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input className="input" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="Price (GHS)" />
                      <select className="input" value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}>
                        <option value="">Bedrooms</option>
                        <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>5+</option>
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {AMENITIES.map((a) => (
                        <label key={a} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                          <input type="checkbox" checked={form.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
                          <span>{a}</span>
                        </label>
                      ))}
                    </div>
                    <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" />
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
