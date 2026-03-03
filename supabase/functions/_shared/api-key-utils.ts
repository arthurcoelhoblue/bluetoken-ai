// Shared API key validation utilities
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface ApiKeyRecord {
  id: string;
  empresa: string;
  permissions: string[];
  is_active: boolean;
  expires_at: string | null;
}

/** Hash a raw API key using SHA-256 and return hex string */
export async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Validate an API key from request header. Returns the key record or null. */
export async function validateApiKey(
  req: Request,
  requiredPermission?: string
): Promise<ApiKeyRecord | null> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return null;

  const keyHash = await hashApiKey(apiKey);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, empresa, permissions, is_active, expires_at")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Check permission
  if (requiredPermission && !data.permissions.includes(requiredPermission)) return null;

  // Update last_used_at (fire-and-forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return data as ApiKeyRecord;
}
