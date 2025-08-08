import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_approved")
      .order("created_at", { ascending: false });

    if (error) setErr("Failed to load users.");
    setUsers(data || []);
    setLoading(false);
  };

  const toggleApproval = async (id, current) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: !current })
      .eq("id", id);

    if (error) {
      alert("Update failed (check RLS/policies).");
      return;
    }
    fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loading) return <p>Loading…</p>;
  if (err) return <p className="text-red-600">{err}</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Users</h2>
      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
            <div>
              <p className="font-semibold">{user.full_name || "—"}</p>
              <p className="text-sm text-gray-500">{user.email || "No email saved"}</p>
            </div>
            <button
              onClick={() => toggleApproval(user.id, user.is_approved)}
              className={`px-4 py-2 text-sm rounded ${user.is_approved ? "bg-green-600" : "bg-gray-400"} text-white`}
            >
              {user.is_approved ? "Approved" : "Pending"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
