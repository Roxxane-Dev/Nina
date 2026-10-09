import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Public (anon) client — used for JWT validation ONLY.
 * Respects Row Level Security. NEVER use for admin DB writes.
 */
export function createPublicClient(
  supabaseUrl: string,
  anonKey: string,
): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Admin client — service role key, bypasses RLS.
 * Used only for trusted server-side DB operations.
 * NEVER expose this key to the frontend.
 */
export function createAdminClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
