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
    cleaned = cleaned.replace(new RegExp(`^${leadNome}[,;.!?:]?\\s*`, 'i'), '');
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
  // Pre-fetched context (avoids duplicate RAG fetch)
  preloadedRagContext?: string | null;
  preloadedRagChunks?: any[] | null;
  preloadedRagSearchMethod?: string | null;
}

/**
 * Generate a response via AI when no pre-generated response exists.
 */
export async function generateResponse(supabase: SupabaseClient, params: GenerateResponseParams): Promise<{ resposta: string; model?: string; provider?: string; prompt_version_id?: string | null }> {
  const { intent, confidence, temperatura, sentimento, acao_recomendada, mensagem_normalizada, empresa, canal, contato, conversation_state, historico } = params;

  // Try RAG-based knowledge first, fallback to full product list
  let productsText = '';
  let ragChunks: any[] = [];
  let ragSearchMethod = '';

  // Use preloaded RAG context if available
  if (params.preloadedRagContext !== undefined) {
    if (params.preloadedRagContext) {
      productsText = params.preloadedRagContext;
      ragChunks = params.preloadedRagChunks || [];
      ragSearchMethod = params.preloadedRagSearchMethod || 'semantic';
    }
    // If preloadedRagContext is null, skip RAG and fall through to product fallback below
  } else {
    // Original RAG fetch (fallback when not preloaded)
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || '';
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || '';
      
      const ragResp = await fetch(`${SUPABASE_URL}/functions/v1/knowledge-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mensagem_normalizada, empresa, top_k: 5, threshold: 0.70 }),
      });

      if (ragResp.ok) {
        const ragData = await ragResp.json();
        ragChunks = ragData.chunks || [];
        ragSearchMethod = ragData.search_method || 'semantic';
        if (ragData.context && ragData.total > 0) {
          productsText = ragData.context;
        }
      }
    } catch { /* fallback below */ }
  }

  // === FASE 2: Increment use_count for FAQs used ===
  if (ragChunks.length > 0) {
    const faqIds = ragChunks.filter((c: any) => c.source_type === 'faq').map((c: any) => c.source_id);
    for (const faqId of faqIds) {
      try {
        await supabase.rpc('increment_faq_use_count', { faq_id: faqId });
      } catch { /* ignore - RPC may not exist yet */ }
    }
  }

  // === ML: Register search feedback for learning loop ===
  if (ragChunks.length > 0 || productsText) {
    const bestSimilarity = ragChunks.length > 0 ? Math.max(...ragChunks.map((c: any) => c.similarity || 0)) : 0;
    const isLowConfidence = ragChunks.length === 0 || bestSimilarity < 0.70;
    try {
      await supabase.from('knowledge_search_feedback').insert({
        query: mensagem_normalizada,
        expanded_query: null,
        chunks_returned: ragChunks.map((c: any) => ({ source_id: c.source_id, source_type: c.source_type, similarity: c.similarity })),
        search_method: ragSearchMethod,
        lead_id: contato?.legacy_lead_id || contato?.id || null,
        empresa,
        outcome: 'PENDENTE',
        escalou_por_baixa_confianca: isLowConfidence,
      });
    } catch (e) { console.error('Feedback registration failed:', e); }

    // === FASE 2: Low confidence → add warning
    if (isLowConfidence && productsText) {
      console.log(`[response-generator] Low confidence RAG (best similarity: ${bestSimilarity.toFixed(3)}). Will use fallback.`);
      productsText += '\n\n⚠️ AVISO SISTEMA: Os trechos acima têm BAIXA relevância para a pergunta do lead. Se não tiver certeza da resposta, diga: "Preciso confirmar com a equipe para te dar a informação exata. Já retorno!"';
    }
  }

  // === FASE 3: Register knowledge gap when no relevant context found ===
  if (ragChunks.length === 0 && mensagem_normalizada.length > 10) {
    try {
      // Check if similar gap already exists
      const { data: existingGaps } = await supabase
        .from('knowledge_gaps')
        .select('id, frequency, sample_queries')
        .eq('empresa', empresa)
        .eq('status', 'ABERTO')
        .ilike('topic', `%${mensagem_normalizada.slice(0, 50)}%`)
        .limit(1);

      if (existingGaps && existingGaps.length > 0) {
        const gap = existingGaps[0];
        const samples = gap.sample_queries || [];
        if (samples.length < 10) samples.push(mensagem_normalizada.slice(0, 200));
        await supabase.from('knowledge_gaps').update({
          frequency: gap.frequency + 1,
          sample_queries: samples,
          updated_at: new Date().toISOString(),
        }).eq('id', gap.id);
      } else {
        await supabase.from('knowledge_gaps').insert({
          empresa,
          topic: mensagem_normalizada.slice(0, 100),
          description: `Amélia não encontrou contexto relevante para esta pergunta (método: ${ragSearchMethod || 'none'})`,
          frequency: 1,
          sample_queries: [mensagem_normalizada.slice(0, 200)],
          status: 'ABERTO',
        });
      }
    } catch (e) { console.error('Knowledge gap registration failed:', e); }
  }

  if (!productsText) {
    // Fallback enriquecido: carregar products + knowledge_sections + knowledge_faq
    const { data: products } = await supabase.from('product_knowledge').select('id, produto_nome, descricao_curta, preco_texto, diferenciais').eq('empresa', empresa).eq('ativo', true).limit(5);
    const typedProducts = (products || []) as (ProductRow & { id: string })[];
    
    if (typedProducts.length > 0) {
      const productIds = typedProducts.map(p => p.id);
      
      // Carregar knowledge_sections associadas (top 3 por produto)
      const { data: sections } = await supabase.from('knowledge_sections')
        .select('product_knowledge_id, titulo, conteudo')
        .in('product_knowledge_id', productIds)
        .order('ordem')
        .limit(15);
      
      // Carregar knowledge_faq associados (top 5 por produto)
      const { data: faqs } = await supabase.from('knowledge_faq')
        .select('pergunta, resposta')
        .eq('empresa', empresa)
        .limit(10);
      
      productsText = typedProducts.map((p) => {
        let line = `### ${p.produto_nome}\n${p.descricao_curta || ''}`;
        if (p.preco_texto) line += `\nPreço: ${p.preco_texto}`;
        if (p.diferenciais) line += `\nDiferenciais: ${p.diferenciais}`;
        // Append sections for this product
        const productSections = (sections || []).filter((s: any) => s.product_knowledge_id === p.id);
        for (const s of productSections) {
          line += `\n**${(s as any).titulo}**: ${(s as any).conteudo}`;
        }
        return line;
      }).join('\n\n');
      
      // Append FAQs
      if (faqs && faqs.length > 0) {
        productsText += '\n\n## PERGUNTAS FREQUENTES\n';
        for (const faq of faqs) {
          productsText += `- **${(faq as any).pergunta}**: ${(faq as any).resposta}\n`;
        }
      }
    } else {
      productsText = 'Nenhum produto cadastrado — NÃO invente informações.';
    }
  }

  let systemPrompt = '';
  let selectedPromptId: string | null = params.promptVersionId || null;
  // A/B testing — DESATIVADO durante reestruturação (Passo 6)
  // TODO: Reativar após estabilização da nova arquitetura classificador/gerador
  // try {
  //   const { data: pvList } = await supabase.from('prompt_versions').select('id, content, ab_weight').eq('function_name', 'sdr-response-generator').eq('prompt_key', 'system').eq('is_active', true).gt('ab_weight', 0);
  //   if (pvList && pvList.length > 0) {
  //     const rows = pvList as PromptVersionRow[];
  //     const totalWeight = rows.reduce((sum: number, p) => sum + (p.ab_weight || 100), 0);
  //     let rand = Math.random() * totalWeight;
  //     let selected = rows[0];
  //     for (const pv of rows) { rand -= (pv.ab_weight || 100); if (rand <= 0) { selected = pv; break; } }
  //     systemPrompt = selected.content;
  //     selectedPromptId = selected.id;
  //   }
  // } catch { /* use default */ }

  // Build DISC tone block
  const discTone = getDiscToneInstruction(conversation_state?.perfil_disc as string | null);

  if (!systemPrompt) {
    const empresaDesc: Record<string, string> = {
      'BLUE': 'Blue Cripto (IR/tributação de criptoativos)',
      'TOKENIZA': 'Tokeniza (investimentos em ativos reais tokenizados)',
      'MPUPPE': 'MPuppe (Direito Digital — regulação Bacen, CVM, LGPD, governança de IA)',
      'AXIA': 'Axia Digital Solutions (infraestrutura fintech whitelabel)',
    };
    systemPrompt = `Você é a Amélia, SDR IA do ${empresaDesc[empresa] || empresa}.
Tom: profissional, acolhedor, direto. Nunca robótica.
${canal === 'WHATSAPP' ? CHANNEL_RULES.WHATSAPP : CHANNEL_RULES.EMAIL}
${discTone || 'Adapte ao perfil DISC quando identificado.'}
${conversation_state?.perfil_investidor ? `Perfil investidor: ${conversation_state.perfil_investidor}` : ''}
PROIBIDO: começar com nome do lead, elogiar perguntas, "Perfeito!", "Entendi!".
PROIBIDO INVENTAR: Nunca cite planos, preços, valores ou produtos que NÃO estejam listados na seção PRODUTOS abaixo. Se não souber o preço ou plano exato, diga que vai verificar com a equipe.
PROIBIDO PROMETER ENVIO FUTURO: NUNCA diga "vou te mandar", "já envio", "segue o resumo", "tá indo". Inclua TODO o conteúdo na PRÓPRIA resposta. Se não tiver a informação, diga que vai verificar com a equipe.

## REGRA DE OURO — VALORES E PREÇOS
- Cite valores EXATAMENTE como aparecem na seção PRODUTOS. Não arredonde, não crie faixas, não interpole.
- Se houver valores diferentes para ofertas diferentes, especifique QUAL oferta tem qual valor.
- Se não encontrar o valor exato para a oferta perguntada, diga: "Vou confirmar o valor exato com a equipe e te retorno."
- NUNCA diga "geralmente", "em média", "entre X e Y" para valores — cite o valor específico da oferta.
- Se os dados de PRODUTOS contêm informações de ofertas diferentes, distinga claramente qual informação pertence a qual oferta. Nunca misture dados de ofertas distintas numa mesma frase.
${empresa === 'TOKENIZA' ? `
## 🚫 PROCESSO TOKENIZA — REGRA CRÍTICA
Investimentos são feitos EXCLUSIVAMENTE pela plataforma plataforma.tokeniza.com.br.
PROIBIDO: gerar contratos, pedir CPF/documentos, prometer envio de dados bancários, simular processo de fechamento fora da plataforma.
Se o lead quer investir, direcione para plataforma.tokeniza.com.br. NUNCA simule um processo de fechamento.
NUNCA peça dados pessoais (CPF, RG, email) para "gerar contrato" ou "iniciar processo". Todo o processo é feito pela plataforma.
TERMINOLOGIA OBRIGATÓRIA: NUNCA use "mercado secundário". O termo correto é SEMPRE "mercado de transações subsequentes".` : ''}
${empresa === 'MPUPPE' ? `
## 🚫 PROCESSO MPUPPE — REGRA CRÍTICA
A MPuppe trabalha com modelo de recorrência mensal customizado. NUNCA cite preços fixos.
O objetivo é agendar uma reunião com o Dr. Rodrigo para entender a necessidade e montar uma proposta.
PROIBIDO: prometer valores, prazos de entrega ou resultados jurídicos específicos.` : ''}
${empresa === 'AXIA' ? `
## 🚫 PROCESSO AXIA — REGRA CRÍTICA
A Axia fornece plataformas modulares. Primeiro módulo: R$ 14.900/mês, módulos adicionais: R$ 4.900/mês.
O objetivo é entender o projeto do lead e agendar uma demo técnica.
PROIBIDO: prometer customizações não listadas ou prazos de entrega sem consultar a equipe técnica.` : ''}

## 🎯 DIRETRIZ DE ANCORAGEM (GROUNDING) — OBRIGATÓRIA
Sua resposta DEVE ser baseada EXCLUSIVAMENTE nas informações da seção PRODUTOS abaixo.
- Se a informação estiver nos PRODUTOS, responda diretamente com dados concretos.
- Se a informação NÃO estiver nos PRODUTOS, você está PROIBIDO de inventar.
  Responda: "Preciso confirmar com a equipe para te dar a informação exata."
  ou "Não tenho essa informação no momento, mas vou verificar para você."
- NUNCA use seu conhecimento geral para complementar. Use APENAS o contexto fornecido.
- Se o lead perguntar algo não coberto pelos PRODUTOS, reconheça a pergunta e diga que vai verificar.`;
  } else if (discTone) {
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

  // === BEHAVIORAL RAG: Fetch methodology chunks ===
  let behavioralText = '';
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || '';
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || '';
    const behResp = await fetch(`${SUPABASE_URL}/functions/v1/knowledge-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mensagem_normalizada, empresa, top_k: 3, threshold: 0.50, source_type_filter: 'behavioral' }),
    });
    if (behResp.ok) {
      const behData = await behResp.json();
      if (behData.context && behData.total > 0) {
        behavioralText = behData.context;
      }
    }
  } catch { /* behavioral search is optional */ }

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
${behavioralText ? `\n## METODOLOGIA DE VENDAS\nAplique as seguintes técnicas na sua abordagem (NÃO cite o nome do livro/metodologia ao lead):\n${behavioralText}` : ''}

HISTÓRICO RECENTE:
${historicoText}

MENSAGEM DO LEAD:
${mensagem_normalizada}

Gere uma resposta personalizada e natural. Se intent for OPT_OUT, respeite. Se for ESCALAR_HUMANO, avise que vai transferir.
IMPORTANTE: Use APENAS os produtos e preços listados acima. Se não houver preço listado, diga que vai confirmar com a equipe. NUNCA invente planos ou valores.
SEPARAÇÃO POR OFERTA: Se os dados acima contêm valores de ofertas diferentes, cite cada valor vinculado à sua oferta específica. Nunca misture ou interpole valores de ofertas distintas. Se o lead perguntar um valor genérico e houver múltiplas ofertas, liste cada uma separadamente.
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
