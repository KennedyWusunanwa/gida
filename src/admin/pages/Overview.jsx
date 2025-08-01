import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function Overview() {
  const [stats, setStats] = useState({ users: 0, listings: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: userCount }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("listings").select("*", { count: "exact", head: true }),
      ]);

      const { count: listingCount } = await supabase
        .from("listings")
        .select("*", { count: "exact", head: true });

      setStats({ users: userCount, listings: listingCount });
    };

    fetchStats();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Overview</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded shadow">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-2xl font-bold">{stats.users}</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <p className="text-sm text-gray-500">Total Listings</p>
          <p className="text-2xl font-bold">{stats.listings}</p>
        </div>
      </div>
    </div>
  );
}
