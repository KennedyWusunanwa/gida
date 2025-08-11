// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // form state
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null);

  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);        // 👈 no redirect here
      setLoadingUser(false);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadListings = async () => {
      setLoadingListings(true);
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) setMessage(error.message);
      else setListings(data || []);
      setLoadingListings(false);
    };
    loadListings();

    const channel = supabase
      .channel("listings-change")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings", filter: `user_id=eq.${user.id}` },
        () => loadListings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const resetForm = () => {
    setTitle(""); setLocation(""); setCity(""); setPrice("");
    setDescription(""); setImageUrl("");
  };

  const handleAddListing = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!title || !location || !city || !price || !user) {
      return setMessage("Title, location, city, price are required.");
    }
    setAdding(true);
    const { error } = await supabase.from("listings").insert([{
      user_id: user.id,
      title, location, city,
      price: Number(price),
      description,
      image_url: imageUrl || null,
    }]);
    if (error) setMessage(error.message); else { resetForm(); setMessage("Listing added!"); }
    setAdding(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");                         // ok to navigate after sign out
  };

  const card = {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
    boxShadow: "0 6px 18px rgba(0,0,0,.06)",
  };

  if (loadingUser) return <div style={{ padding: "2rem" }}><p>Loading…</p></div>;

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Welcome to your Dashboard</h2>
        <button onClick={handleLogout} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #ddd" }}>
          Logout
        </button>
      </div>

      {user && <p style={{ marginTop: -8, color: "#555" }}>Signed in as: {user.email}</p>}

      {message && (
        <div style={{ marginTop: 12, marginBottom: 16, color: /error|fail/i.test(message) ? "#b91c1c" : "#065f46" }}>
          {message}
        </div>
      )}

      {/* Add Listing Form */}
      <div style={{ ...card, marginTop: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Add New Listing</h3>
        <form onSubmit={handleAddListing} style={{ display: "grid", gap: 12 }}>
          <input placeholder="Title (e.g., Self-contained, 1BR)" value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} required />
          <input placeholder="Location (e.g., Spintex)" value={location} onChange={(e) => setLocation(e.target.value)} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} required />
          <input placeholder="City (e.g., Accra)" value={city} onChange={(e) => setCity(e.target.value)} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} required />
          <input type="number" placeholder="Price in GHS" value={price} onChange={(e) => setPrice(e.target.value)} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} required />
          <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} />
          <input placeholder="Image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={{ padding: 12, borderRadius: 10, border: "1px solid #ddd" }} />
          <button type="submit" disabled={adding} style={{ padding: "12px 16px", borderRadius: 10, border: "none", background: "#5B3A1E", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: adding ? 0.7 : 1 }}>
            {adding ? "Adding…" : "Add Listing"}
          </button>
        </form>
      </div>

      {/* My Listings */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>My Listings</h3>
        {loadingListings ? <p>Loading listings…</p> : listings.length === 0 ? (
          <p>No listings yet. Add your first one above.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {listings.map((item) => (
              <div key={item.id} style={card}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
                ) : null}
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                <div style={{ color: "#555", marginBottom: 4 }}>{item.location}, {item.city}</div>
                <div style={{ color: "#111", marginBottom: 8 }}>GHC {Number(item.price).toLocaleString()}</div>
                {item.description ? <div style={{ color: "#666", fontSize: 14 }}>{item.description}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
