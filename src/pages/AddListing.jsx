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

  // NEW: file upload states
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [msg, setMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const uploadImageAndGetUrl = async () => {
    if (!file) return null;

    const bucket = "listing-images";
    // unique path per user
    const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    // Upload to Storage
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/*",
      });

    if (uploadErr) throw uploadErr;

    // Get the public URL
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl ?? null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!title || !location || !city || !price) {
      return setMsg("Title, location, city, and price are required.");
    }
    if (!user?.id) {
      return setMsg("You must be logged in to add a listing.");
    }

    try {
      setAdding(true);

      // 1) upload image first (if provided)
      let imageUrl = null;
      if (file) {
        imageUrl = await uploadImageAndGetUrl();
      }

      // 2) insert listing
      const { error } = await supabase.from("listings").insert([
        {
          user_id: user.id,
          title,
          location,
          city,
          price: Number(price),
          description,
          image_url: imageUrl, // store the Storage public URL
          is_published: true,  // optional default
        },
      ]);

      if (error) throw error;

      setMsg("Listing added!");
      // reset
      setTitle("");
      setLocation("");
      setCity("");
      setPrice("");
      setDescription("");
      setFile(null);
      setPreview(null);
      // Clear file input visually
      const fileInput = document.getElementById("listing-image-input");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      setMsg(`Error: ${err.message || err.toString()}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, color: "#5B3A1E" }}>Add New Listing</h1>
      {msg && (
        <p style={{ color: /error|fail|^Error:/i.test(msg) ? "#b91c1c" : "#065f46" }}>
          {msg}
        </p>
      )}

      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input
          className="input"
          placeholder="Title (e.g., Self-contained, 1BR)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="input"
          placeholder="Location (e.g., Spintex)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <input
          className="input"
          placeholder="City (e.g., Accra)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <input
          className="input"
          type="number"
          placeholder="Price in GHS"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <textarea
          className="textarea"
          rows={4}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* NEW: Image upload (instead of URL) */}
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 14, opacity: 0.8 }}>Listing Image</label>
          <input
            id="listing-image-input"
            className="input"
            type="file"
            accept="image/*"
            onChange={onFileChange}
          />
          {preview && (
            <img
              src={preview}
              alt="Preview"
              style={{
                width: 220,
                height: 140,
                objectFit: "cover",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            />
          )}
          <small style={{ opacity: 0.7 }}>
            Recommended: JPEG/PNG, &lt; 5MB.
          </small>
        </div>

        <button className="btn btn--primary" disabled={adding}>
          {adding ? "Adding…" : "Add Listing"}
        </button>
      </form>
    </div>
  );
}
