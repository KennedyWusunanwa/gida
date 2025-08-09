// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "./supabaseClient";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <SessionContextProvider supabaseClient={supabase}>
    <App />
  </SessionContextProvider>
);

reportWebVitals();
