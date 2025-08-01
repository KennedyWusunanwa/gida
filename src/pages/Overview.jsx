import React, { useEffect, useState } from "react";
import { fetchAdminOverview } from "../api";

export default function Overview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAdminOverview().then(({ data, error }) => {
      if (!error) setData(data?.[0] || null);
    });
  }, []);

  if (!data) return <div>Loading…</div>;

  const cards = [
    { label: "Total Users", value: data.total_users },
    { label: "Verified Users", value: data.verified_users },
    { label: "Total Listings", value: data.total_listings },
    { label: "Approved Listings", value: data.approved_listings },
    { label: "Pending Listings", value: data.pending_listings },
    { label: "Rejected Listings", value: data.rejected_listings },
    { label: "New Users (30d)", value: data.last_30d_new_users },
    { label: "New Listings (30d)", value: data.last_30d_new_listings },
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
