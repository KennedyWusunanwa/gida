import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, email, is_approved");
    setUsers(data || []);
  };

  const toggleApproval = async (id, current) => {
    await supabase.from("profiles").update({ is_approved: !current }).eq("id", id);
    fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Users</h2>
      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
            <div>
              <p className="font-semibold">{user.full_name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
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