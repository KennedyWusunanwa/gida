import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function Overview() {
  const [stats, setStats] = useState({ users: 0, listings: 0 });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setErr(null);
      setLoading(true);

      const [profilesRes, listingsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("listings").select("*", { count: "exact", head: true }),
      ]);

      if (profilesRes.error || listingsRes.error) {
        setErr("Failed to load stats.");
      } else {
        setStats({
          users: profilesRes.count ?? 0,
          listings: listingsRes.count ?? 0,
        });
      }

      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-600">{err}</p>;

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
