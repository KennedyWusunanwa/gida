import React, { useEffect, useState } from "react";
import { fetchAdminOverview } from "../api";
import { supabase } from "../../supabaseClient";

export default function Overview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const {
        data: overviewData,
        error,
      } = await fetchAdminOverview();

      if (error) {
        setErr("Failed to load admin overview.");
      } else {
        setData(overviewData?.[0] || null);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) return <p className="text-black/60">Loading overview…</p>;
  if (err) return <p className="text-red-600">{err}</p>;
  if (!data) return <p className="text-black/60">No data available.</p>;

  const cards = [
    { label: "Total Users", value: data.total_users ?? 0 },
    { label: "Verified Users", value: data.verified_users ?? 0 },
    { label: "Total Listings", value: data.total_listings ?? 0 },
    { label: "Approved Listings", value: data.approved_listings ?? 0 },
    { label: "Pending Listings", value: data.pending_listings ?? 0 },
    { label: "Rejected Listings", value: data.rejected_listings ?? 0 },
    { label: "New Users (30d)", value: data.last_30d_new_users ?? 0 },
    { label: "New Listings (30d)", value: data.last_30d_new_listings ?? 0 },
  ];

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-[#5B3A1E] mb-6">Service Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white shadow p-4">
            <div className="text-xs uppercase text-black/50">{c.label}</div>
            <div className="mt-1 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
