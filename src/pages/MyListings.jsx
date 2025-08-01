import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useDashboardUser } from "../layouts/DashboardLayout";

export default function MyListings() {
  const user = useDashboardUser();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
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

  return (
    <div>
      <h1 style={{ margin: "0 0 14px", color: "#5B3A1E" }}>My Listings</h1>
      {msg && <p style={{ color: "#b91c1c" }}>{msg}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : listings.length === 0 ? (
        <p>No listings yet.</p>
      ) : (
        <div className="grid">
          {listings.map((it) => (
            <article key={it.id} className="card">
              {it.image_url && (
                <img
                  src={it.image_url}
                  alt={it.title}
                  style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 10 }}
                />
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{it.title}</div>
                <div style={{ fontWeight: 800 }}>GH₵{Number(it.price).toLocaleString()}/mo</div>
              </div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>{it.location}, {it.city}</div>
              {it.description && (
                <p style={{ color: "#374151", marginTop: 8, fontSize: 14 }}>{it.description}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
