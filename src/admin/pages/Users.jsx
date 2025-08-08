// src/admin/pages/Users.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setErr(null);
    setLoading(true);

    // Use the admin RPC (must exist). Falls back to plain profiles if RPC missing.
    let data = null, error = null;

    const rpc = await supabase.rpc("admin_list_profiles");
    if (rpc.error && rpc.error.message?.includes("function admin_list_profiles")) {
      // RPC not found — fallback to profiles (no email)
      const res = await supabase.from("profiles").select("id, full_name, is_approved");
      data = res.data; error = res.error;
    } else {
      data = rpc.data; error = rpc.error;
    }

    if (error) {
      console.error("profiles/admin_list_profiles error:", error);
      setErr(`Failed to load users: ${error.message}`);
    } else {
      setUsers(data || []);
    }

    setLoading(false);
  };

  const toggleApproval = async (id, current) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: !current })
      .eq("id", id);

    if (error) {
      console.error("profiles update error:", error);
      alert(`Update failed: ${error.message} (check RLS/policies).`);
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
              {"email" in user && (
                <p className="text-sm text-gray-500">{user.email || "No email"}</p>
              )}
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
