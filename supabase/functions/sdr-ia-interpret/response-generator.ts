// ========================================
// RESPONSE GENERATOR MODULE — Extracted from sdr-response-generator Edge Function
// Sanitizes robotic AI responses and generates fallback responses
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-provider.ts";

// ========================================
// ANTI-ROBOTIC SANITIZATION
// ========================================

function detectRoboticPattern(resposta: string, leadNome?: string): boolean {
  if (!resposta) return false;
  const patternProibidos = [
    /^(Perfeito|Entendi|Entendido|Com certeza|Que bom|Excelente|Ótimo|Ótima|Claro|Certo|Legal|Maravilha|Beleza|Fantástico|Incrível|Show|Sensacional|Bacana),?\s+\w+[!.]/i,
    /^(Olá|Oi|Hey|Eai|E aí),?\s+\w+[!.]/i,
    /^(Bom dia|Boa tarde|Boa noite),?\s+\w+[!.]/i,
    /^(Essa é uma|Esta é uma|É uma)\s+(ótima|excelente|boa|super importante|muito boa|interessante)\s+(pergunta|dúvida|questão)/i,
    /^(Boa pergunta|Ótima pergunta|Excelente pergunta|Legal|Interessante),?\s+\w+[!.]/i,
    /(bem comum|muito comum|frequente|bastante comum),?\s+\w+[!.]/i,
    /^(Olha|Então|Bom|Ah),?\s+\w+,\s/i,
  ];
  for (const p of patternProibidos) { if (p.test(resposta)) return true; }
  const frasesElogio = [
    /que (mostra|demonstra) que você (está|é) (atento|interessado|engajado)/i,
    /fico (feliz|contente) que você/i,
    /essa é uma dúvida (bem |muito )?(comum|frequente)/i,
    /essa pergunta é (importante|super importante|muito boa)/i,
  ];
  for (const p of frasesElogio) { if (p.test(resposta)) return true; }
  if (leadNome) {
    const roboticAfterName = new RegExp(
      `^${leadNome},?\\s+(entendi|perfeito|que bom|excelente|ótimo|claro|certo|legal|maravilha|show|beleza|fantástico|incrível|sensacional|bacana)`,
      'i'
    );
    if (roboticAfterName.test(resposta)) return true;
  }
  return false;
}

function sanitizeRoboticResponse(resposta: string, leadNome?: string): string {
  if (!resposta) return '';
  let cleaned = resposta;
  const patterns = [
    /^(Perfeito|Entendi|Entendido|Excelente|Ótimo|Ótima|Legal|Maravilha|Show|Certo|Claro|Com certeza|Que bom|Beleza|Fantástico|Incrível|Sensacional|Bacana|Perfeita|Entendida)[!.]?\s*/i,
    /^(Perfeito|Entendi|Entendido|Com certeza|Que bom|Excelente|Ótimo|Ótima|Claro|Certo|Legal|Maravilha|Beleza),?\s+\w+[!.]?\s*/i,
    /^(Olá|Oi|Hey|Eai|E aí),?\s+\w+[!.]?\s*/i,
    /^(Bom dia|Boa tarde|Boa noite),?\s+\w+[!.]?\s*/i,
    /^(Essa é uma|Esta é uma|É uma)\s+(ótima|excelente|boa|super importante|muito boa|interessante)\s+(pergunta|dúvida|questão)[,.]?\s+\w*[,.]?\s*(e )?(mostra|demonstra)?[^.!?]*[.!?]?\s*/i,
    /^(Boa pergunta|Ótima pergunta|Excelente pergunta|Legal|Interessante),?\s+\w+[!.]?\s*/i,
    /^(Olha|Então|Bom|Ah),?\s+\w+,\s*/i,
    /^Essa é uma dúvida (bem |muito )?(comum|frequente)[,.]?\s*/i,
    /^Essa pergunta é (importante|super importante|muito boa)[,.]?\s*/i,
  ];
  for (const p of patterns) { cleaned = cleaned.replace(p, ''); }
  cleaned = cleaned.replace(/,?\s*que (mostra|demonstra) que você (está|é) (atento|interessado|engajado)[^.!?]*/gi, '');
  cleaned = cleaned.replace(/,?\s*e?\s*fico (feliz|contente) que você[^.!?]*/gi, '');
  cleaned = cleaned.replace(/me conta:?\s*/gi, '');
  cleaned = cleaned.replace(/me conta uma coisa:?\s*/gi, '');
  cleaned = cleaned.replace(/agora me conta:?\s*/gi, '');
  cleaned = cleaned.replace(/me fala:?\s*/gi, '');
  if (leadNome) {
    cleaned = cleaned.replace(new RegExp(`^${leadNome}[,;.!]?\\s*`, 'i'), '');
    const parts = cleaned.split(new RegExp(`(${leadNome})`, 'gi'));
    if (parts.length > 3) {
      let count = 0;
      cleaned = parts.map(part => {
        if (part.toLowerCase() === leadNome.toLowerCase()) { count++; return count === 1 ? part : ''; }
        return part;
      }).join('');
    }
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

// ========================================
// CHANNEL RULES
// ========================================

const CHANNEL_RULES: Record<string, string> = {
  WHATSAPP: 'Mensagens CURTAS (2-4 linhas). Tom conversacional. UMA pergunta por mensagem.',
  EMAIL: 'Mensagens ESTRUTURADAS. Tom consultivo. 3-4 parágrafos. Retomar contexto no início.',
};

interface HistoricoMsg {
  direcao: string;
  conteudo: string;
}

interface ProductRow {
  nome: string;
  descricao_curta: string;
  preco_texto: string | null;
  diferenciais: string | null;
}

interface PromptVersionRow {
  id: string;
  content: string;
  ab_weight: number | null;
}

// ========================================
// PUBLIC API
// ========================================

export interface SanitizeParams {
  resposta_sugerida: string;
  leadNome?: string;
  empresa: string;
  canal?: string;
  intent?: string;
}

/**
 * Sanitize an existing AI-generated response (fast path — no AI call needed).
 */
export function sanitizeResponse(resposta: string, leadNome?: string): string {
  if (!resposta) return '';
  let result = resposta;
  if (detectRoboticPattern(result, leadNome)) {
    result = sanitizeRoboticResponse(result, leadNome);
  }
  if (!result || result.length < 10) {
    result = `Olá${leadNome ? ` ${leadNome}` : ''}! Vou encaminhar para um especialista que pode te ajudar melhor. 😊`;
  }
  return result;
}

export interface GenerateResponseParams {
  intent: string;
  confidence: number;
  temperatura?: string;
  sentimento?: string;
  acao_recomendada?: string;
  mensagem_normalizada: string;
  empresa: string;
  canal: string;
  contato?: Record<string, unknown>;
  classificacao?: Record<string, unknown>;
  conversation_state?: Record<string, unknown>;
  historico?: HistoricoMsg[];
  promptVersionId?: string;
}

/**
 * Generate a response via AI when no pre-generated response exists.
 */
export async function generateResponse(supabase: SupabaseClient, params: GenerateResponseParams): Promise<{ resposta: string; model?: string; provider?: string; prompt_version_id?: string | null }> {
  const { intent, confidence, temperatura, sentimento, acao_recomendada, mensagem_normalizada, empresa, canal, contato, conversation_state, historico } = params;

  const { data: products } = await supabase.from('product_knowledge').select('nome, descricao_curta, preco_texto, diferenciais').eq('empresa', empresa).eq('ativo', true).limit(5);

  let systemPrompt = '';
  let selectedPromptId: string | null = params.promptVersionId || null;
  try {
    const { data: pvList } = await supabase.from('prompt_versions').select('id, content, ab_weight').eq('function_name', 'sdr-response-generator').eq('prompt_key', 'system').eq('is_active', true).gt('ab_weight', 0);
    if (pvList && pvList.length > 0) {
      const rows = pvList as PromptVersionRow[];
      const totalWeight = rows.reduce((sum: number, p) => sum + (p.ab_weight || 100), 0);
      let rand = Math.random() * totalWeight;
      let selected = rows[0];
      for (const pv of rows) { rand -= (pv.ab_weight || 100); if (rand <= 0) { selected = pv; break; } }
      systemPrompt = selected.content;
      selectedPromptId = selected.id;
    }
  } catch { /* use default */ }

  if (!systemPrompt) {
    systemPrompt = `Você é a Amélia, SDR IA do ${empresa === 'TOKENIZA' ? 'Tokeniza (investimentos tokenizados)' : 'Blue (IR/tributação cripto)'}.
Tom: profissional, acolhedor, direto. Nunca robótica.
${canal === 'WHATSAPP' ? CHANNEL_RULES.WHATSAPP : CHANNEL_RULES.EMAIL}
Adapte ao perfil DISC: ${conversation_state?.perfil_disc || 'não identificado'}.
${conversation_state?.perfil_investidor ? `Perfil investidor: ${conversation_state.perfil_investidor}` : ''}
PROIBIDO: começar com nome do lead, elogiar perguntas, "Perfeito!", "Entendi!".`;
  }

  const contactName = contato?.nome || contato?.primeiro_nome || 'Lead';
  const typedHistorico = (historico || []) as HistoricoMsg[];
  const historicoText = typedHistorico.slice(0, 8).map((m) => `[${m.direcao}] ${m.conteudo}`).join('\n');
  const typedProducts = (products || []) as ProductRow[];
  const productsText = typedProducts.map((p) => `${p.nome}: ${p.descricao_curta} (${p.preco_texto || 'consultar'})`).join('\n') || '';

  const prompt = `CONTEXTO:
Contato: ${contactName}
Intent: ${intent} (confiança: ${confidence})
Temperatura: ${temperatura}
Sentimento: ${sentimento}
Ação recomendada: ${acao_recomendada}
Estado funil: ${conversation_state?.estado_funil || 'SAUDACAO'}
Canal: ${canal}

PRODUTOS:
${productsText}

HISTÓRICO RECENTE:
${historicoText}

MENSAGEM DO LEAD:
${mensagem_normalizada}

Gere uma resposta personalizada e natural. Se intent for OPT_OUT, respeite. Se for ESCALAR_HUMANO, avise que vai transferir.
Responda APENAS com o texto da mensagem, sem prefixos.`;

  const aiResult = await callAI({
    system: systemPrompt,
    prompt,
    functionName: 'sdr-response-generator',
    empresa,
    temperature: 0.5,
    maxTokens: 500,
    promptVersionId: selectedPromptId || undefined,
    supabase,
  });

  let resposta = aiResult.content;
  if (resposta && detectRoboticPattern(resposta, contactName as string)) {
    resposta = sanitizeRoboticResponse(resposta, contactName as string);
  }

  if (!resposta || resposta.length < 10) {
    resposta = `Olá ${contactName}! Recebi sua mensagem. Vou encaminhar para um especialista que pode te ajudar melhor. Obrigada! 😊`;
  }

  return { resposta, model: aiResult.model, provider: aiResult.provider, prompt_version_id: selectedPromptId };
}
