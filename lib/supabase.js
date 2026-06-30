// lib/supabase.js
// Two clients: one for public reads (used by pages), one for the cron jobs
// that write data (uses the service role key, which bypasses RLS).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getPublicClient() {
  return createClient(url, anonKey);
}

export function getServiceClient() {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
