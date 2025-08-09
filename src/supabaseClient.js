// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// CRA uses process.env.REACT_APP_*
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,   // important if you use magic links
    storage: window.localStorage,
    storageKey: "gida-auth",    // 👈 stable key across tabs/windows
    flowType: "pkce",
  },
});
