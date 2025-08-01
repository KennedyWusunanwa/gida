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

  // NEW: multiple files
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [msg, setMsg] = useState(null);
  const [adding, setAdding] = useState(false);

  const onFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setPreviews(selectedFiles.map((f) => URL.createObjectURL(f)));
  };

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
    if (!user?.id) {
      return setMsg("You must be logged in to add a listing.");
    }

    try {
      setAdding(true);

      // 1) Upload images
      const urls = await uploadImagesAndGetUrls();
      const mainUrl = urls[0] || null;
      const extraUrls = urls.slice(1);

      // 2) Insert listing and get id
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
          },
        ])
        .select("id")
        .single();

      if (listingErr) throw listingErr;

      // 3) Insert extra images
      if (extraUrls.length) {
        const rows = extraUrls.map((url) => ({
          listing_id: listing.id,
          url,
        }));
        const { error: imgErr } = await supabase.from("listing_images").insert(rows);
        if (imgErr) throw imgErr;
      }

      setMsg("Listing added!");
      // reset form
      setTitle("");
      setLocation("");
      setCity("");
      setPrice("");
      setDescription("");
      setFiles([]);
      setPreviews([]);
      const inputEl = document.getElementById("listing-images-input");
      if (inputEl) inputEl.value = "";

    } catch (err) {
      setMsg(`Error: ${err.message || String(err)}`);
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

        {/* Multiple images */}
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 14, opacity: 0.8 }}>
            Listing Images (first image becomes main photo)
          </label>
          <input
            id="listing-images-input"
            className="input"
            type="file"
            accept="image/*"
            multiple
            onChange={onFilesChange}
          />
          {previews.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {previews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Preview ${i + 1}`}
                  style={{
                    width: 120,
                    height: 90,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                />
              ))}
            </div>
          )}
          <small style={{ opacity: 0.7 }}>
            Select multiple images at once. Recommended: JPEG/PNG, &lt; 5MB each.
          </small>
        </div>

        <button className="btn btn--primary" disabled={adding}>
          {adding ? "Adding…" : "Add Listing"}
        </button>
      </form>
    </div>
  );
}
