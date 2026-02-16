/**
 * Centralized environment variable configuration for Edge Functions.
 * 
 * Usage:
 *   import { envConfig, getOptionalEnv } from '../_shared/config.ts';
 *   const supabase = createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);
 *   const apiKey = getOptionalEnv('OPENAI_API_KEY');
 * 
 * Required vars throw immediately if missing.
 * Optional vars return string | null.
 */

// ========================================
// Required environment variables
// ========================================

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}. Function cannot start.`);
  }
  return value;
}

/** Core required environment variables — validated at import time */
export const envConfig = {
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
} as const;

// ========================================
// Optional environment variables
// ========================================

/** 
 * Get an optional environment variable. Returns null if not set.
 * Use for API keys that may not be configured in all environments.
 */
export function getOptionalEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

/**
 * Get an optional environment variable with a default fallback.
 */
export function getOptionalEnvWithDefault(name: string, defaultValue: string): string {
  return Deno.env.get(name) ?? defaultValue;
}

// ========================================
// Convenience: Supabase client factory
// ========================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Create an authenticated Supabase admin client using service role key */
export function createServiceClient(): SupabaseClient {
  return createClient(envConfig.SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);
}
