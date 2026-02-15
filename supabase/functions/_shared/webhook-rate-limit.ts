/**
 * Webhook Rate Limiting Module
 * 
 * Sliding-window rate limiter for public webhooks.
 * Uses a per-minute window with upsert-based counting.
 * Fail-open: if the DB check fails, the request is allowed.
 * 
 * Usage:
 *   import { checkWebhookRateLimit, rateLimitResponse } from '../_shared/webhook-rate-limit.ts';
 *   
 *   const rateCheck = await checkWebhookRateLimit(supabase, 'sgt-webhook', tokenHash, 120);
 *   if (!rateCheck.allowed) return rateLimitResponse(corsHeaders);
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
}

/**
 * Check and increment rate limit counter for a webhook.
 * 
 * @param supabase - Service-role Supabase client
 * @param functionName - Edge function name (e.g. 'sgt-webhook')
 * @param identifier - Unique caller identifier (token hash, IP, empresa, etc.)
 * @param maxPerMinute - Maximum allowed calls per minute
 * @returns RateLimitResult with allowed flag
 */
export async function checkWebhookRateLimit(
  supabase: SupabaseClient,
  functionName: string,
  identifier: string,
  maxPerMinute: number
): Promise<RateLimitResult> {
  try {
    // Round to current minute
    const now = new Date();
    now.setSeconds(0, 0);
    const windowStart = now.toISOString();

    // Upsert: insert or increment counter
    const { data, error } = await supabase
      .from('webhook_rate_limits')
      .upsert(
        {
          function_name: functionName,
          identifier: identifier,
          window_start: windowStart,
          call_count: 1,
        },
        { onConflict: 'function_name,identifier,window_start' }
      )
      .select('call_count')
      .single();

    if (error) {
      // If upsert failed, try to increment existing row
      const { data: existing } = await supabase
        .from('webhook_rate_limits')
        .select('call_count')
        .eq('function_name', functionName)
        .eq('identifier', identifier)
        .eq('window_start', windowStart)
        .maybeSingle();

      if (existing) {
        const newCount = (existing.call_count as number) + 1;
        await supabase
          .from('webhook_rate_limits')
          .update({ call_count: newCount })
          .eq('function_name', functionName)
          .eq('identifier', identifier)
          .eq('window_start', windowStart);

        return {
          allowed: newCount <= maxPerMinute,
          currentCount: newCount,
          limit: maxPerMinute,
        };
      }

      // Fail-open: allow if DB check completely fails
      console.warn(`[RateLimit] DB error for ${functionName}, fail-open:`, error.message);
      return { allowed: true, currentCount: 0, limit: maxPerMinute };
    }

    const currentCount = (data?.call_count as number) ?? 1;

    // The upsert resets to 1 instead of incrementing — we need a manual increment
    // Since Supabase upsert doesn't support SET call_count = call_count + 1,
    // we do a select + update approach for subsequent calls
    if (currentCount === 1) {
      // First call in this window — check if there's actually an existing row
      const { data: recheck } = await supabase
        .from('webhook_rate_limits')
        .select('call_count')
        .eq('function_name', functionName)
        .eq('identifier', identifier)
        .eq('window_start', windowStart)
        .maybeSingle();

      if (recheck && (recheck.call_count as number) > 1) {
        // Row already existed, increment it
        const newCount = (recheck.call_count as number) + 1;
        await supabase
          .from('webhook_rate_limits')
          .update({ call_count: newCount })
          .eq('function_name', functionName)
          .eq('identifier', identifier)
          .eq('window_start', windowStart);

        return {
          allowed: newCount <= maxPerMinute,
          currentCount: newCount,
          limit: maxPerMinute,
        };
      }
    }

    return {
      allowed: currentCount <= maxPerMinute,
      currentCount,
      limit: maxPerMinute,
    };
  } catch (err) {
    // Fail-open: never block legitimate traffic due to rate-limit errors
    console.error(`[RateLimit] Unexpected error for ${functionName}, fail-open:`, err);
    return { allowed: true, currentCount: 0, limit: maxPerMinute };
  }
}

/**
 * Simple hash function for identifier strings (token hashing).
 * Not cryptographic — just for bucketing.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Standard 429 response for rate-limited requests.
 */
export function rateLimitResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded', retryAfter: 60 }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '60',
      },
    }
  );
}
