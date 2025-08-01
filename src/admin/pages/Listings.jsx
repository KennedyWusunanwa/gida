import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function AdminListings() {
  const [listings, setListings] = useState([]);

  const fetchListings = async () => {
    const { data } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
    setListings(data || []);
  };

  const toggleApproval = async (id, is_published) => {
    await supabase.from("listings").update({ is_published: !is_published }).eq("id", id);
    fetchListings();
  };

  useEffect(() => {
    fetchListings();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Listings</h2>
      <div className="space-y-4">
        {listings.map((listing) => (
          <div key={listing.id} className="bg-white p-4 rounded shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-semibold">{listing.title || listing.city}</h3>
              <p className="text-sm text-gray-500">GH₵ {listing.price}</p>
            </div>
            <button
              onClick={() => toggleApproval(listing.id, listing.is_published)}
              className={`px-4 py-2 text-sm rounded ${listing.is_published ? "bg-green-600" : "bg-gray-400"} text-white`}
            >
              {listing.is_published ? "Approved" : "Pending"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
