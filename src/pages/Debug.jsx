// src/pages/Debug.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Debug() {
  const [out, setOut] = useState({
    env: null, session: null, user: null, profile: null, errors: [],
  });

  useEffect(() => {
    (async () => {
      const errors = [];
      const env = {
        REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL,
        REACT_APP_SUPABASE_ANON_KEY_present: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
      };

      const { data: sData, error: sErr } = await supabase.auth.getSession();
      if (sErr) errors.push({ where: "getSession", message: sErr.message });

      const { data: uData, error: uErr } = await supabase.auth.getUser();
      if (uErr) errors.push({ where: "getUser", message: uErr.message });

      let profile = null;
      if (uData?.user) {
        const { data: pData, error: pErr } = await supabase
          .from("profiles")
          .select("id, is_admin, is_approved, full_name")
          .eq("id", uData.user.id)
          .maybeSingle();
        if (pErr) errors.push({ where: "profiles select", message: pErr.message, hint: "RLS/policy?" });
        else profile = pData;
      }

      setOut({ env, session: sData?.session || null, user: uData?.user || null, profile, errors });
    })();
  }, []);

  return (
    <div className="p-4">
      <h2 className="font-bold mb-2">Debug</h2>
      <pre className="text-xs overflow-auto bg-white p-3 rounded shadow">{JSON.stringify(out, null, 2)}</pre>
    </div>
  );
}
