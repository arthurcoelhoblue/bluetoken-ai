// _shared/ai-provider.ts — Unified AI provider with Claude → Gemini → GPT-4o fallback + auto telemetry + rate limiting
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CallAIOptions {
  system: string;
  prompt: string;
  functionName: string;
  empresa?: string | null;
  temperature?: number;
  maxTokens?: number;
  promptVersionId?: string;
  supabase: SupabaseClient;
  /** If true, sends messages array instead of single prompt (for chat-style APIs) */
  messages?: Array<{ role: string; content: string }>;
  /** Optional user ID for rate limiting. If omitted (CRON/system calls), rate limiting is skipped. */
  userId?: string;
  /**
   * When set to 'gemini-flash', tries gemini-3-flash-preview first (via GOOGLE_API_KEY)
   * before falling through to the normal Claude → Gemini Pro → GPT-4o chain.
   * Functions in "Group A" (customer-facing) should NOT pass this flag.
   */
  model?: 'gemini-flash';
}

export interface CallAIResult {
  content: string;
  model: string;
  provider: string;
  tokensInput: number;
  tokensOutput: number;
  latencyMs: number;
}

const COST_TABLE: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':      { input: 3.0    / 1_000_000, output: 15.0  / 1_000_000 },
  'gemini-3-pro-preview':   { input: 1.25   / 1_000_000, output: 10.0  / 1_000_000 },
  'gemini-3-flash-preview': { input: 0.075  / 1_000_000, output: 0.30  / 1_000_000 },
  'gpt-4o':                 { input: 2.5    / 1_000_000, output: 10.0  / 1_000_000 },
};

// ========================================
// RATE LIMITING
// ========================================

const RATE_LIMITS: Record<string, number> = {
  'copilot-chat': 60,
  'sdr-intent-classifier': 200,
  'sdr-response-generator': 200,
  'deal-scoring': 100,
};
const DEFAULT_RATE_LIMIT = 100;

async function checkRateLimit(supabase: SupabaseClient, functionName: string, userId?: string): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
  // Skip rate limiting for system/CRON calls (no userId)
  if (!userId) return { allowed: true, currentCount: 0, limit: 0 };

  const limit = RATE_LIMITS[functionName] ?? DEFAULT_RATE_LIMIT;
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0); // Round to current hour
  const windowStartISO = windowStart.toISOString();

  try {
    // Try to find existing record for this window
    const { data: existing } = await supabase
      .from('ai_rate_limits')
      .select('id, call_count')
      .eq('function_name', functionName)
      .eq('user_id', userId)
      .eq('window_start', windowStartISO)
      .maybeSingle();

    if (existing) {
      if (existing.call_count >= limit) {
        return { allowed: false, currentCount: existing.call_count, limit };
      }
      // Increment
      await supabase
        .from('ai_rate_limits')
        .update({ call_count: existing.call_count + 1 })
        .eq('id', existing.id);
      return { allowed: true, currentCount: existing.call_count + 1, limit };
    }

    // Insert new record
    await supabase.from('ai_rate_limits').insert({
      function_name: functionName,
      user_id: userId,
      window_start: windowStartISO,
      call_count: 1,
    });
    return { allowed: true, currentCount: 1, limit };
  } catch (e) {
    console.warn(`[${functionName}] Rate limit check error (allowing):`, e);
    return { allowed: true, currentCount: 0, limit };
  }
}

// ========================================
// MAIN callAI FUNCTION
// ========================================

export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const { system, prompt, functionName, empresa, temperature = 0.3, maxTokens = 1500, promptVersionId, supabase, messages, userId, model } = opts;
  const startTime = Date.now();

  // Rate limit check
  const rateCheck = await checkRateLimit(supabase, functionName, userId);
  if (!rateCheck.allowed) {
    const latencyMs = Date.now() - startTime;
    // Log rate-limited attempt
    try {
      await supabase.from('ai_usage_log').insert({
        function_name: functionName, provider: 'none', model: 'none',
        tokens_input: 0, tokens_output: 0, custo_estimado: 0,
        latency_ms: latencyMs, success: false, empresa: empresa || null,
        error_message: `Rate limited: ${rateCheck.currentCount}/${rateCheck.limit} calls/hour`,
        prompt_version_id: promptVersionId || null,
      });
    } catch { /* ignore */ }
    return { content: '', model: 'rate-limited', provider: 'none', tokensInput: 0, tokensOutput: 0, latencyMs };
  }

  let content = '';
  let usedModel = '';
  let provider = '';
  let tokensInput = 0;
  let tokensOutput = 0;

  // 0. Gemini Flash (primary for analytical functions — pass model: 'gemini-flash')
  const GOOGLE_API_KEY_FLASH = Deno.env.get('GOOGLE_API_KEY');
  if (model === 'gemini-flash' && GOOGLE_API_KEY_FLASH) {
    try {
      const fullPrompt = messages
        ? `${system}\n\n${messages.map(m => `[${m.role}]: ${m.content}`).join('\n')}`
        : `${system}\n\n${prompt}`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_API_KEY_FLASH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens } }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const flashContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (flashContent) {
          content = flashContent;
          usedModel = 'gemini-3-flash-preview';
          provider = 'gemini';
          tokensInput = data.usageMetadata?.promptTokenCount || 0;
          tokensOutput = data.usageMetadata?.candidatesTokenCount || 0;
        }
      }
    } catch (e) { console.warn(`[${functionName}] Gemini Flash failed, falling back:`, e); }
  }

  // 1. Claude (primary for conversational / Group A functions)
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!content && ANTHROPIC_API_KEY) {
    try {
      const anthropicMessages = messages
        ? messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
        : [{ role: 'user', content: prompt }];

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, temperature, system, messages: anthropicMessages }),
      });
      if (resp.ok) {
        const data = await resp.json();
        content = data.content?.[0]?.text || '';
        usedModel = 'claude-sonnet-4-6';
        provider = 'claude';
        tokensInput = data.usage?.input_tokens || 0;
        tokensOutput = data.usage?.output_tokens || 0;
      }
    } catch (e) { console.warn(`[${functionName}] Claude failed:`, e); }
  }

  // 2. Gemini (fallback 1)
  if (!content) {
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (GOOGLE_API_KEY) {
      try {
        const fullPrompt = messages
          ? `${system}\n\n${messages.map(m => `[${m.role}]: ${m.content}`).join('\n')}`
          : `${system}\n\n${prompt}`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens } }),
        });
        if (resp.ok) {
          const data = await resp.json();
          content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          usedModel = 'gemini-3-pro-preview';
          provider = 'gemini';
          tokensInput = data.usageMetadata?.promptTokenCount || 0;
          tokensOutput = data.usageMetadata?.candidatesTokenCount || 0;
        }
      } catch (e) { console.warn(`[${functionName}] Gemini failed:`, e); }
    }
  }

  // 3. GPT-4o (fallback 2)
  if (!content) {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (OPENAI_API_KEY) {
      try {
        const openaiMessages = messages
          ? [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))]
          : [{ role: 'system', content: system }, { role: 'user', content: prompt }];

        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o', messages: openaiMessages, temperature, max_tokens: maxTokens }),
        });
        if (resp.ok) {
          const data = await resp.json();
          content = data.choices?.[0]?.message?.content ?? '';
          usedModel = 'gpt-4o';
          provider = 'openai';
          tokensInput = data.usage?.prompt_tokens || 0;
          tokensOutput = data.usage?.completion_tokens || 0;
        }
      } catch (e) { console.warn(`[${functionName}] GPT-4o failed:`, e); }
    }
  }

  const latencyMs = Date.now() - startTime;

  // Auto-log telemetry
  try {
    const costs = COST_TABLE[usedModel] || { input: 0, output: 0 };
    const custoEstimado = (tokensInput * costs.input) + (tokensOutput * costs.output);

    await supabase.from('ai_usage_log').insert({
      function_name: functionName,
      provider: provider || 'none',
      model: usedModel || 'none',
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      custo_estimado: Math.round(custoEstimado * 1_000_000) / 1_000_000,
      latency_ms: latencyMs,
      success: !!content,
      empresa: empresa || null,
      prompt_version_id: promptVersionId || null,
    });
  } catch (logErr) { console.warn(`[${functionName}] ai_usage_log error:`, logErr); }

  return { content, model: usedModel, provider, tokensInput, tokensOutput, latencyMs };
}
