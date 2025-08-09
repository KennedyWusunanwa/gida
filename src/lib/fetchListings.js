// src/lib/fetchListings.js
import { supabase } from "../supabaseClient";

/**
 * filters = {
 *   q: string,             // keyword
 *   city: string,          // e.g. 'Accra'
 *   price: '0-600'|'600-1000'|'1000-1500'|'1500-'|'',
 *   amenities: string[],   // ['Wi-Fi','AC']
 * }
 */
export async function fetchListings(filters = {}, limit = 24, from = 0) {
  let query = supabase
    .from("listings")
    .select(`
      id, title, description, city, price, amenities, images, created_at
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  const { q = "", city = "", price = "", amenities = [] } = filters;

  // City (location) — exact or ilike
  if (city) {
    query = query.ilike("city", `%${city}%`);
  }

  // Keyword across multiple columns
  if (q) {
    const escaped = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(
      `title.ilike.%${escaped}%,description.ilike.%${escaped}%,address.ilike.%${escaped}%`
    );
  }

  // Price bucket parsing
  if (price) {
    const [min, max] = price.split("-");
    if (min && !isNaN(Number(min))) query = query.gte("price", Number(min));
    if (max) {
      if (!isNaN(Number(max))) query = query.lte("price", Number(max));
    }
  }

  // Amenities contains (choose ONE of the two blocks below depending on your column type)
  // A) If amenities is a TEXT[] column in Postgres:
  if (amenities?.length) {
    query = query.contains("amenities", amenities);
  }
  // B) If amenities is JSON array (e.g. ['Wi-Fi','AC']):
  // if (amenities?.length) {
  //   query = query.contains({ amenities });
  // }

  const { data, error, count } = await query;
  return { data, error, count };
}
