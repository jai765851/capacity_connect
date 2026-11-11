import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAppIntegrationConfig } from '../config/env';

const { supabaseUrl, supabaseAnonKey } = getAppIntegrationConfig();

// Client uses ONLY public anon key; service-role keys never exist in frontend code.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function requireSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
    );
  }
  return supabase;
}
