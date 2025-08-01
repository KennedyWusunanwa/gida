import React, { useEffect, useState } from "react";
import { listUsers, approveUser } from "../api";

export default function Users() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await listUsers({ limit: 100 });
    if (error) setErr("Failed to load users.");
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id, makeVerified) => {
    const { error } = await approveUser(id, makeVerified);
    if (!error) load();
    else alert("Failed to update user status.");
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-[#5B3A1E] mb-6">Approve Users</h1>

      {loading ? (
        <p className="text-black/60">Loading users…</p>
      ) : err ? (
        <p className="text-red-600">{err}</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-black/10 bg-white">
          <table className="w-full text-left">
            <thead className="bg-[#F3EBDD] text-sm">
              <tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-black/5">
                  <Td className="text-black/70">{short(r.id)}</Td>
                  <Td>{r.full_name || "—"}</Td>
                  <Td className="text-black/70">{r.auth?.email || "—"}</Td>
                  <Td>{r.is_verified ? "Verified" : "Pending"}</Td>
                  <Td>
                    {r.is_verified ? (
                      <button
                        className="btn-outline"
                        onClick={() => toggle(r.id, false)}
                      >
                        Revoke
                      </button>
                    ) : (
                      <button
                        className="btn-primary"
                        onClick={() => toggle(r.id, true)}
                      >
                        Approve
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Th = (p) => (
  <th className={`px-3 py-2 ${p.className || ""}`}>{p.children}</th>
);
const Td = (p) => (
  <td className={`px-3 py-2 ${p.className || ""}`}>{p.children}</td>
);
const short = (id) => id?.slice(0, 8);
