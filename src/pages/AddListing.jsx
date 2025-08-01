import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useDashboardUser } from "../layouts/DashboardLayout";

export default function AddListing() {
  const user = useDashboardUser();

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [msg, setMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!title || !location || !city || !price) {
      return setMsg("Title, location, city, and price are required.");
    }
    setAdding(true);
    const { error } = await supabase.from("listings").insert([{
      user_id: user.id,
      title, location, city,
      price: Number(price),
      description,
      image_url: imageUrl || null,
    }]);
    if (error) setMsg(error.message);
    else {
      setMsg("Listing added!");
      setTitle(""); setLocation(""); setCity(""); setPrice(""); setDescription(""); setImageUrl("");
    }
    setAdding(false);
  };

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, color: "#5B3A1E" }}>Add New Listing</h1>
      {msg && <p style={{ color: /error|fail/i.test(msg) ? "#b91c1c" : "#065f46" }}>{msg}</p>}
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input className="input" placeholder="Title (e.g., Self-contained, 1BR)" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="input" placeholder="Location (e.g., Spintex)" value={location} onChange={e=>setLocation(e.target.value)} />
        <input className="input" placeholder="City (e.g., Accra)" value={city} onChange={e=>setCity(e.target.value)} />
        <input className="input" type="number" placeholder="Price in GHS" value={price} onChange={e=>setPrice(e.target.value)} />
        <textarea className="textarea" rows={4} placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} />
        <input className="input" placeholder="Image URL (optional)" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} />
        <button className="btn btn--primary" disabled={adding}>{adding ? "Adding…" : "Add Listing"}</button>
      </form>
    </div>
  );
}
