import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL dan SUPABASE_SECRET_KEY harus diatur.");
  }
  if (serviceRoleKey.startsWith("sb_publishable_") || serviceRoleKey.startsWith("sb_anon_")) {
    throw new Error("SUPABASE_SECRET_KEY harus berupa secret key server, bukan publishable key.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
