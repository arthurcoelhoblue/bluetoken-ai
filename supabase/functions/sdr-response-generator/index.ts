import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { createServiceClient } from '../_shared/config.ts';
import { createLogger } from '../_shared/logger.ts';
import { getWebhookCorsHeaders } from "../_shared/cors.ts";

const log = createLogger('sdr-response-generator');
const corsHeaders = getWebhookCorsHeaders();

// ========================================
// ANTI-ROBOTIC SANITIZATION (from monolith PATCH 5K)
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
    const nomePattern = new RegExp(`^${leadNome},?\\s`, 'i');
    if (nomePattern.test(resposta)) return true;
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
    cleaned = cleaned.replace(new RegExp(`^${leadNome},?\\s*`, 'i'), '');
    // Limit name to 1x per message
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
// CHANNEL RULES & INVESTOR PROFILE EXAMPLES
// ========================================

const CHANNEL_RULES: Record<string, string> = {
  WHATSAPP: 'Mensagens CURTAS (2-4 linhas). Tom conversacional. UMA pergunta por mensagem.',
  EMAIL: 'Mensagens ESTRUTURADAS. Tom consultivo. 3-4 parágrafos. Retomar contexto no início.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { intent, confidence, temperatura, sentimento, acao_recomendada, framework_updates,
      mensagem_normalizada, empresa, canal, contato, classificacao, conversation_state,
      historico, resposta_sugerida_ia, promptVersionId } = body;

    // If the intent classifier already generated a response, just sanitize it
    if (resposta_sugerida_ia) {
      const leadNome = contato?.nome || contato?.primeiro_nome;
      let resposta = resposta_sugerida_ia;
      if (detectRoboticPattern(resposta, leadNome)) {
        resposta = sanitizeRoboticResponse(resposta, leadNome);
      }
      if (!resposta || resposta.length < 10) {
        resposta = `Olá${leadNome ? ` ${leadNome}` : ''}! Vou encaminhar para um especialista que pode te ajudar melhor. 😊`;
      }
      return new Response(JSON.stringify({ resposta, model: 'sanitized', provider: 'pass-through' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate response via AI if no pre-generated response
    // Load product knowledge
    const { data: products } = await supabase.from('product_knowledge').select('nome, descricao_curta, preco_texto, diferenciais').eq('empresa', empresa).eq('ativo', true).limit(5);

    // Load active prompt version with A/B testing
    let systemPrompt = '';
    let selectedPromptId: string | null = promptVersionId || null;
    try {
      const { data: pvList } = await supabase.from('prompt_versions').select('id, content, ab_weight').eq('function_name', 'sdr-response-generator').eq('prompt_key', 'system').eq('is_active', true).gt('ab_weight', 0);
      if (pvList && pvList.length > 0) {
        const totalWeight = pvList.reduce((sum: number, p: any) => sum + (p.ab_weight || 100), 0);
        let rand = Math.random() * totalWeight;
        let selected = pvList[0];
        for (const pv of pvList) { rand -= (pv.ab_weight || 100); if (rand <= 0) { selected = pv; break; } }
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
    const historicoText = (historico || []).slice(0, 8).map((m: any) => `[${m.direcao}] ${m.conteudo}`).join('\n');
    const productsText = products?.map((p: any) => `${p.nome}: ${p.descricao_curta} (${p.preco_texto || 'consultar'})`).join('\n') || '';

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
    if (resposta && detectRoboticPattern(resposta, contactName)) {
      resposta = sanitizeRoboticResponse(resposta, contactName);
    }

    if (!resposta || resposta.length < 10) {
      resposta = `Olá ${contactName}! Recebi sua mensagem. Vou encaminhar para um especialista que pode te ajudar melhor. Obrigada! 😊`;
    }

    return new Response(JSON.stringify({ resposta, model: aiResult.model, provider: aiResult.provider, prompt_version_id: selectedPromptId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Error', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
