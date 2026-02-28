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
    /^(Perfeito|Entendi|Entendido|Excelente|Ótimo|Ótima|Legal|Maravilha|Show|Certo|Claro|Com certeza|Que bom|Beleza|Fantástico|Incrível|Sensacional|Bacana|Perfeita|Entendida)[,;!.]?\s*/i,
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

// ========================================
// DISC TONE INSTRUCTIONS (mirrored from intent-classifier)
// ========================================

type PerfilDISC = 'D' | 'I' | 'S' | 'C';

function getDiscToneInstruction(disc: PerfilDISC | string | null | undefined): string | null {
  if (!disc) return null;
  const instrucoes: Record<string, string> = {
    'D': `## TOM DE VOZ OBRIGATÓRIO (DISC D)\nSeja DIRETO e objetivo. Foque em RESULTADOS e números. Mensagens CURTAS. Evite rodeios. Vá direto ao ponto. O lead D valoriza eficiência e detesta enrolação.`,
    'I': `## TOM DE VOZ OBRIGATÓRIO (DISC I)\nSeja AMIGÁVEL e entusiasmado. Use HISTÓRIAS e exemplos de sucesso. Conecte emocionalmente. O lead I quer se sentir especial e parte de algo maior.`,
    'S': `## TOM DE VOZ OBRIGATÓRIO (DISC S)\nSeja CALMO e acolhedor. Enfatize SEGURANÇA e estabilidade. Não apresse decisão. O lead S precisa de tempo e confiança antes de decidir.`,
    'C': `## TOM DE VOZ OBRIGATÓRIO (DISC C)\nSeja PRECISO e técnico. Forneça NÚMEROS, dados, prazos, comparativos. O lead C decide com base em lógica e evidências concretas.`,
  };
  return instrucoes[disc] || null;
}

// ========================================
// LEAD FACTS FORMATTING
// ========================================

function formatLeadFacts(leadFacts: Record<string, unknown> | null | undefined): string {
  if (!leadFacts || Object.keys(leadFacts).length === 0) return '';
  const lines: string[] = ['\n## FATOS CONHECIDOS DO LEAD'];
  if (leadFacts.cargo) lines.push(`- Cargo: ${leadFacts.cargo}`);
  if (leadFacts.empresa_lead) lines.push(`- Empresa: ${leadFacts.empresa_lead}`);
  if (leadFacts.pain_points) {
    const pains = Array.isArray(leadFacts.pain_points) ? leadFacts.pain_points : [leadFacts.pain_points];
    lines.push(`- Pain points: ${pains.join(', ')}`);
  }
  if (leadFacts.concorrentes) {
    const conc = Array.isArray(leadFacts.concorrentes) ? leadFacts.concorrentes : [leadFacts.concorrentes];
    lines.push(`- Concorrentes mencionados: ${conc.join(', ')}`);
  }
  if (leadFacts.decisor) lines.push(`- Decisor: ${leadFacts.decisor}`);
  if (leadFacts.volume_operacoes) lines.push(`- Volume operações: ${leadFacts.volume_operacoes}`);
  if (leadFacts.patrimonio_faixa) lines.push(`- Patrimônio (faixa): ${leadFacts.patrimonio_faixa}`);
  return lines.join('\n');
}

interface HistoricoMsg {
  direcao: string;
  conteudo: string;
}

interface ProductRow {
  produto_nome: string;
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

  const { data: products } = await supabase.from('product_knowledge').select('produto_nome, descricao_curta, preco_texto, diferenciais').eq('empresa', empresa).eq('ativo', true).limit(5);

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

  // Build DISC tone block
  const discTone = getDiscToneInstruction(conversation_state?.perfil_disc as string | null);

  if (!systemPrompt) {
    systemPrompt = `Você é a Amélia, SDR IA do ${empresa === 'TOKENIZA' ? 'Tokeniza (investimentos tokenizados)' : 'Blue (IR/tributação cripto)'}.
Tom: profissional, acolhedor, direto. Nunca robótica.
${canal === 'WHATSAPP' ? CHANNEL_RULES.WHATSAPP : CHANNEL_RULES.EMAIL}
${discTone || 'Adapte ao perfil DISC quando identificado.'}
${conversation_state?.perfil_investidor ? `Perfil investidor: ${conversation_state.perfil_investidor}` : ''}
PROIBIDO: começar com nome do lead, elogiar perguntas, "Perfeito!", "Entendi!".
PROIBIDO INVENTAR: Nunca cite planos, preços, valores ou produtos que NÃO estejam listados na seção PRODUTOS abaixo. Se não souber o preço ou plano exato, diga que vai verificar com a equipe.
PROIBIDO PROMETER ENVIO FUTURO: NUNCA diga "vou te mandar", "já envio", "segue o resumo", "tá indo". Inclua TODO o conteúdo na PRÓPRIA resposta. Se não tiver a informação, diga que vai verificar com a equipe.
${empresa === 'TOKENIZA' ? `
## 🚫 PROCESSO TOKENIZA — REGRA CRÍTICA
Investimentos são feitos EXCLUSIVAMENTE pela plataforma plataforma.tokeniza.com.br.
PROIBIDO: gerar contratos, pedir CPF/documentos, prometer envio de dados bancários, simular processo de fechamento fora da plataforma.
Se o lead quer investir, direcione para plataforma.tokeniza.com.br. NUNCA simule um processo de fechamento.
NUNCA peça dados pessoais (CPF, RG, email) para "gerar contrato" ou "iniciar processo". Todo o processo é feito pela plataforma.` : ''}`;
  } else if (discTone) {
    // Inject DISC tone into A/B tested prompts too
    systemPrompt += `\n\n${discTone}`;
  }

  const contactName = contato?.nome || contato?.primeiro_nome || 'Lead';
  const typedHistorico = (historico || []) as HistoricoMsg[];

  // Use summary + recent messages if available, else fallback to last 8
  const summary = conversation_state?.summary as string | undefined;
  const historicoText = summary
    ? `[RESUMO ANTERIOR] ${summary}\n` + typedHistorico.slice(0, 5).map((m) => `[${m.direcao}] ${m.conteudo}`).join('\n')
    : typedHistorico.slice(0, 8).map((m) => `[${m.direcao}] ${m.conteudo}`).join('\n');

  // Format lead_facts for prompt injection
  const leadFacts = conversation_state?.lead_facts as Record<string, unknown> | undefined;
  const leadFactsText = formatLeadFacts(leadFacts);
  const typedProducts = (products || []) as ProductRow[];
  const productsText = typedProducts.map((p) => {
    let line = `${p.produto_nome}: ${p.descricao_curta || ''}`;
    if (p.preco_texto) line += ` | Preço: ${p.preco_texto}`;
    if (p.diferenciais) line += ` | Diferenciais: ${p.diferenciais}`;
    return line;
  }).join('\n') || 'Nenhum produto cadastrado — NÃO invente informações.';

  const prompt = `CONTEXTO:
Contato: ${contactName}
Intent: ${intent} (confiança: ${confidence})
Temperatura: ${temperatura}
Sentimento: ${sentimento}
Ação recomendada: ${acao_recomendada}
Estado funil: ${conversation_state?.estado_funil || 'SAUDACAO'}
Canal: ${canal}
${leadFactsText}

PRODUTOS:
${productsText}

HISTÓRICO RECENTE:
${historicoText}

MENSAGEM DO LEAD:
${mensagem_normalizada}

Gere uma resposta personalizada e natural. Se intent for OPT_OUT, respeite. Se for ESCALAR_HUMANO, avise que vai transferir.
IMPORTANTE: Use APENAS os produtos e preços listados acima. Se não houver preço listado, diga que vai confirmar com a equipe. NUNCA invente planos ou valores.
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
