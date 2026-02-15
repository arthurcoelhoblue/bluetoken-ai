// _shared/ai-provider.ts — Unified AI provider with Claude → Gemini → GPT-4o fallback + auto telemetry
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CallAIOptions {
  system: string;
  prompt: string;
  functionName: string;
  empresa?: string;
  temperature?: number;
  maxTokens?: number;
  promptVersionId?: string;
  supabase: SupabaseClient;
  /** If true, sends messages array instead of single prompt (for chat-style APIs) */
  messages?: Array<{ role: string; content: string }>;
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
  'claude-sonnet-4-20250514': { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  'gemini-3-pro-preview': { input: 1.25 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
};

export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const { system, prompt, functionName, empresa, temperature = 0.3, maxTokens = 1500, promptVersionId, supabase, messages } = opts;
  const startTime = Date.now();

  let content = '';
  let model = '';
  let provider = '';
  let tokensInput = 0;
  let tokensOutput = 0;

  // 1. Claude (primary)
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (ANTHROPIC_API_KEY) {
    try {
      const anthropicMessages = messages
        ? messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
        : [{ role: 'user', content: prompt }];

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, temperature, system, messages: anthropicMessages }),
      });
      if (resp.ok) {
        const data = await resp.json();
        content = data.content?.[0]?.text || '';
        model = 'claude-sonnet-4-20250514';
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
          model = 'gemini-3-pro-preview';
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
          model = 'gpt-4o';
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
    const costs = COST_TABLE[model] || { input: 0, output: 0 };
    const custoEstimado = (tokensInput * costs.input) + (tokensOutput * costs.output);

    await supabase.from('ai_usage_log').insert({
      function_name: functionName,
      provider: provider || 'none',
      model: model || 'none',
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      custo_estimado: Math.round(custoEstimado * 1_000_000) / 1_000_000,
      latency_ms: latencyMs,
      success: !!content,
      empresa: empresa || null,
      prompt_version_id: promptVersionId || null,
    });
  } catch (logErr) { console.warn(`[${functionName}] ai_usage_log error:`, logErr); }

  return { content, model, provider, tokensInput, tokensOutput, latencyMs };
}
