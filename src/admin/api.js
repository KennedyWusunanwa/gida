// src/admin/api.js
import { supabase } from "../supabaseClient";

// Only admins will pass the RLS inside the RPCs.
export async function fetchAdminOverview() {
  return await supabase.rpc("admin_overview");
}

export async function listPendingUsers({ limit = 50, from = 0 } = {}) {
  return await supabase
    .from("profiles")
    .select("id, full_name, is_verified, created_at, auth:auth.users(email)")
    .eq("is_verified", false)
    .range(from, from + limit - 1);
}

export async function listUsers({ limit = 50, from = 0 } = {}) {
  return await supabase
    .from("profiles")
    .select("id, full_name, is_verified, created_at, auth:auth.users(email)")
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
}

export async function approveUser(userId, makeVerified = true) {
  return await supabase.rpc("approve_user", { target_user: userId, make_verified: makeVerified });
}

export async function listListingsForReview({ limit = 50, from = 0, status = "pending" } = {}) {
  return await supabase
    .from("listings")
    .select("id, title, city, location, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .range(from, from + limit - 1);
}

export async function setListingStatus(listingId, newStatus) {
  return await supabase.rpc("set_listing_status", {
    target_listing: listingId,
    new_status: newStatus,
  });
}
