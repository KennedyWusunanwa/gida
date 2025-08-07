import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Saved() {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadSaved = async () => {
      setLoading(true);
      setErr(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get saved listings with joined listing data
      const { data, error } = await supabase
        .from("saved_listings")
        .select(`
          id,
          listing:listing_id (
            id,
            title,
            city,
            location,
            price,
            image_url
          )
        `)
        .eq("user_id", user.id);

      if (error) setErr(error.message);
      else setSaved(data || []);

      setLoading(false);
    };

    loadSaved();
  }, [navigate]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Saved Listings</h1>
      {saved.length === 0 ? (
        <p>No saved listings yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {saved.map((entry) => {
            const listing = entry.listing;
            return (
              <Link
                key={entry.id}
                to={`/listings/${listing.id}`}
                className="bg-white rounded-xl shadow hover:shadow-lg overflow-hidden"
              >
                <img
                  src={listing.image_url || "/images/placeholder.jpg"}
                  alt={listing.title}
                  className="h-48 w-full object-cover"
                />
                <div className="p-4">
                  <h2 className="font-semibold text-lg">{listing.title}</h2>
                  <p className="text-black/70">
                    {listing.city}, {listing.location}
                  </p>
                  {listing.price && (
                    <p className="text-[#5B3A1E] font-bold mt-1">
                      GH₵{Number(listing.price).toLocaleString()}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
