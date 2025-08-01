import React, { useEffect, useState } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Protected() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setAuthed(!!data?.session?.user);
      setLoading(false);

      const res = supabase.auth.onAuthStateChange((_evt, session) => {
        setAuthed(!!session?.user);
      });
      sub = res.data.subscription;
    })();
    return () => sub?.unsubscribe();
  }, []);

  if (loading) return null; // or a spinner
  if (!authed) return <Navigate to="/auth" replace state={{ from: location }} />;
  return <Outlet />;
}
