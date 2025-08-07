import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Saved() {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("saved_listings")
        .select("listing_id, listings(*)")
        .eq("user_id", user.id);

      if (error) setErr(error.message);
      else setSaved(data || []);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) return <p>Loading saved listings…</p>;
  if (err) return <p className="text-red-600">{err}</p>;
  if (!saved.length) return <p>No saved listings yet.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#5B3A1E] mb-4">Saved Listings</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {saved.map(({ listings }) => (
          <Link
            key={listings.id}
            to={`/listing/${listings.id}`}
            className="bg-white rounded-2xl overflow-hidden shadow hover:shadow-lg transition"
          >
            <img
              src={listings.image_url || "/images/placeholder.jpg"}
              alt={listings.title}
              className="h-48 w-full object-cover"
            />
            <div className="p-4">
              <h4 className="font-bold">{listings.title}</h4>
              <p className="text-sm text-black/60">{listings.city}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
