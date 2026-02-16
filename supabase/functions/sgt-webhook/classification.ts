// ========================================
// sgt-webhook/classification.ts — Classificação de leads
// Extraído do index.ts (Fase D)
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  EmpresaTipo, ICP, IcpTokeniza, IcpBlue,
  PersonaTokeniza, PersonaBlue, Persona,
  Prioridade, LeadNormalizado, LeadClassificationResult,
  DadosTokeniza, DadosBlue, ScoreBreakdown,
  SGTEventoTipo, Temperatura,
} from "./types.ts";
import { EVENTOS_QUENTES } from "./types.ts";

// ========================================
// CLASSIFICAÇÃO TOKENIZA
// ========================================
export function classificarTokeniza(lead: LeadNormalizado): { icp: IcpTokeniza; persona: PersonaTokeniza | null; razao: string } {
  const dados = lead.dados_empresa as DadosTokeniza | null;
  const valorInvestido = dados?.valor_investido ?? 0;
  const qtdInvestimentos = dados?.qtd_investimentos ?? 0;
  const qtdProjetos = dados?.qtd_projetos ?? 0;
  const carrinhoAbandonado = dados?.carrinho_abandonado ?? false;
  const valorCarrinho = dados?.valor_carrinho ?? 0;

  if (carrinhoAbandonado && valorCarrinho >= 5000) {
    return { 
      icp: 'TOKENIZA_SERIAL', 
      persona: 'CONSTRUTOR_PATRIMONIO',
      razao: `Carrinho abandonado com valor alto (R$ ${valorCarrinho.toLocaleString('pt-BR')}). Lead prioritário para recuperação.`
    };
  }

  if (valorInvestido >= 100000 || qtdInvestimentos >= 40 || qtdProjetos >= 20) {
    const motivos: string[] = [];
    if (valorInvestido >= 100000) motivos.push(`valor investido de R$ ${valorInvestido.toLocaleString('pt-BR')} (≥ R$ 100.000)`);
    if (qtdInvestimentos >= 40) motivos.push(`${qtdInvestimentos} investimentos (≥ 40)`);
    if (qtdProjetos >= 20) motivos.push(`${qtdProjetos} projetos (≥ 20)`);
    return { 
      icp: 'TOKENIZA_SERIAL', 
      persona: 'CONSTRUTOR_PATRIMONIO',
      razao: `Investidor de alto volume: ${motivos.join(', ')}.`
    };
  }

  if (lead.metadata?.tipo_compra && valorInvestido >= 10000) {
    return { 
      icp: 'TOKENIZA_ALTO_VOLUME_DIGITAL', 
      persona: 'COLECIONADOR_DIGITAL',
      razao: `Perfil de compra digital identificado com R$ ${valorInvestido.toLocaleString('pt-BR')} investidos.`
    };
  }

  if ((valorInvestido >= 20000 && valorInvestido < 100000) || 
      (qtdInvestimentos >= 15 && qtdInvestimentos < 40)) {
    const motivos: string[] = [];
    if (valorInvestido >= 20000) motivos.push(`R$ ${valorInvestido.toLocaleString('pt-BR')} investidos (entre R$ 20.000 e R$ 100.000)`);
    if (qtdInvestimentos >= 15) motivos.push(`${qtdInvestimentos} investimentos (entre 15 e 40)`);
    return { 
      icp: 'TOKENIZA_MEDIO_PRAZO', 
      persona: 'CONSTRUTOR_PATRIMONIO',
      razao: `Investidor de médio porte: ${motivos.join(', ')}.`
    };
  }

  if ((valorInvestido >= 5000 && valorInvestido < 20000) || 
      (qtdInvestimentos >= 5 && qtdInvestimentos < 15) ||
      carrinhoAbandonado) {
    const motivos: string[] = [];
    if (valorInvestido >= 5000 && valorInvestido < 20000) motivos.push(`R$ ${valorInvestido.toLocaleString('pt-BR')} investidos`);
    if (qtdInvestimentos >= 5 && qtdInvestimentos < 15) motivos.push(`${qtdInvestimentos} investimentos`);
    if (carrinhoAbandonado) motivos.push(`carrinho abandonado de R$ ${valorCarrinho.toLocaleString('pt-BR')}`);
    return { 
      icp: 'TOKENIZA_EMERGENTE', 
      persona: 'INICIANTE_CAUTELOSO',
      razao: `Investidor iniciante/emergente: ${motivos.join(', ')}.`
    };
  }

  return { 
    icp: 'TOKENIZA_NAO_CLASSIFICADO', 
    persona: null,
    razao: 'Dados insuficientes para classificação. Lead precisa de mais interações.'
  };
}

// ========================================
// CLASSIFICAÇÃO BLUE
// ========================================
export function classificarBlue(lead: LeadNormalizado): { icp: IcpBlue; persona: PersonaBlue | null; razao: string } {
  const dados = lead.dados_empresa as DadosBlue | null;
  const ticketMedio = dados?.ticket_medio ?? 0;
  const scoreMautic = dados?.score_mautic ?? 0;
  const qtdComprasIr = dados?.qtd_compras_ir ?? 0;
  const stage = lead.stage;
  
  const mauticScore = lead.dados_mautic?.score ?? scoreMautic;
  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const emailClicks = lead.dados_mautic?.email_clicks ?? 0;

  if (ticketMedio >= 5000 || qtdComprasIr >= 3 || (mauticScore >= 80 && pageHits >= 20)) {
    const motivos: string[] = [];
    if (ticketMedio >= 5000) motivos.push(`ticket médio de R$ ${ticketMedio.toLocaleString('pt-BR')} (≥ R$ 5.000)`);
    if (qtdComprasIr >= 3) motivos.push(`${qtdComprasIr} compras de IR (≥ 3)`);
    if (mauticScore >= 80 && pageHits >= 20) motivos.push(`Mautic score ${mauticScore} + ${pageHits} page hits`);
    return { 
      icp: 'BLUE_ALTO_TICKET_IR', 
      persona: 'CRIPTO_CONTRIBUINTE_URGENTE',
      razao: `Cliente de alto valor: ${motivos.join(', ')}.`
    };
  }

  if ((qtdComprasIr >= 1 && qtdComprasIr < 3) || ticketMedio >= 500 || (mauticScore >= 30 && emailClicks >= 3)) {
    const motivos: string[] = [];
    if (qtdComprasIr >= 1) motivos.push(`${qtdComprasIr} compra(s) de IR`);
    if (ticketMedio >= 500) motivos.push(`ticket médio de R$ ${ticketMedio.toLocaleString('pt-BR')}`);
    if (mauticScore >= 30) motivos.push(`Mautic score ${mauticScore}`);
    return { 
      icp: 'BLUE_RECURRENTE', 
      persona: 'CLIENTE_FIEL_RENOVADOR',
      razao: `Cliente recorrente: ${motivos.join(', ')}.`
    };
  }

  if (stage === 'Perdido' && (mauticScore >= 20 || pageHits >= 5 || emailClicks >= 1)) {
    return { 
      icp: 'BLUE_PERDIDO_RECUPERAVEL', 
      persona: 'LEAD_PERDIDO_RECUPERAVEL',
      razao: `Lead perdido com sinais de reengajamento: Mautic score ${mauticScore}, ${pageHits} page hits, ${emailClicks} email clicks.`
    };
  }

  return { 
    icp: 'BLUE_NAO_CLASSIFICADO', 
    persona: null,
    razao: 'Dados insuficientes para classificação Blue. Lead precisa de mais interações.'
  };
}

// ========================================
// TEMPERATURA
// ========================================
export function calcularTemperatura(
  lead: LeadNormalizado,
  icp: ICP
): { temperatura: Temperatura; razao: string } {
  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const emailClicks = lead.dados_mautic?.email_clicks ?? 0;
  const evento = lead.evento;
  
  if (EVENTOS_QUENTES.includes(evento)) {
    return { temperatura: 'QUENTE', razao: `Evento de alta intenção: ${evento}.` };
  }

  if (icp === 'TOKENIZA_SERIAL' || icp === 'BLUE_ALTO_TICKET_IR') {
    return { temperatura: 'QUENTE', razao: `ICP de alto valor: ${icp}.` };
  }

  if (lead.score >= 80 || (pageHits >= 20 && emailClicks >= 5)) {
    return { temperatura: 'QUENTE', razao: `Alto engajamento: score ${lead.score}, ${pageHits} page hits, ${emailClicks} email clicks.` };
  }

  if (icp === 'BLUE_PERDIDO_RECUPERAVEL') {
    return { temperatura: 'MORNO', razao: 'Lead perdido demonstrando sinais de reengajamento.' };
  }

  if (icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE' || icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL') {
    return { temperatura: 'MORNO', razao: `ICP de médio valor (${icp}).` };
  }

  if (pageHits >= 5) {
    return { temperatura: 'MORNO', razao: `Engajamento moderado com ${pageHits} page hits.` };
  }

  if (evento === 'LEAD_NOVO' || evento === 'ATUALIZACAO') {
    if (icp.includes('NAO_CLASSIFICADO')) {
      return { temperatura: 'FRIO', razao: 'Lead novo sem classificação definida. Aguardando mais dados.' };
    }
    return { temperatura: 'MORNO', razao: `Lead ${evento === 'LEAD_NOVO' ? 'novo' : 'atualizado'} com ICP definido.` };
  }

  return { temperatura: 'FRIO', razao: 'Sem sinais claros de engajamento ou intenção.' };
}

// ========================================
// PRIORIDADE
// ========================================
export function calcularPrioridade(icp: ICP, temperatura: Temperatura): { prioridade: Prioridade; razao: string } {
  if (temperatura === 'QUENTE' && 
      (icp === 'TOKENIZA_SERIAL' || icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL' || icp === 'BLUE_ALTO_TICKET_IR')) {
    return { prioridade: 1, razao: `Prioridade máxima: temperatura QUENTE + ICP de alto valor (${icp}).` };
  }

  if ((icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE') ||
      (temperatura === 'QUENTE' && !icp.includes('NAO_CLASSIFICADO'))) {
    return { prioridade: 2, razao: `Prioridade média: ${temperatura === 'QUENTE' ? 'temperatura QUENTE' : `ICP ${icp}`}.` };
  }

  return { prioridade: 3, razao: 'Prioridade padrão: sem indicadores de urgência.' };
}

// ========================================
// SCORE INTERNO
// ========================================
export function calcularScoreInterno(lead: LeadNormalizado, icp: ICP, temperatura: Temperatura, prioridade: Prioridade): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    base_temperatura: 0, bonus_icp: 0, bonus_evento: 0,
    bonus_score_externo: 0, bonus_mautic: 0, bonus_chatwoot: 0,
    bonus_carrinho: 0, bonus_lead_pago: 0, ajuste_prioridade: 0, total: 0,
  };

  if (temperatura === 'QUENTE') breakdown.base_temperatura = 40;
  else if (temperatura === 'MORNO') breakdown.base_temperatura = 25;
  else breakdown.base_temperatura = 10;

  if (icp === 'TOKENIZA_SERIAL' || icp === 'BLUE_ALTO_TICKET_IR') breakdown.bonus_icp = 30;
  else if (icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE') breakdown.bonus_icp = 20;
  else if (icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL') breakdown.bonus_icp = 25;
  else if (!icp.includes('NAO_CLASSIFICADO')) breakdown.bonus_icp = 10;

  if (EVENTOS_QUENTES.includes(lead.evento)) breakdown.bonus_evento = 15;

  breakdown.bonus_score_externo = Math.min(Math.round(lead.score * 0.1), 10);

  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const emailClicks = lead.dados_mautic?.email_clicks ?? 0;
  breakdown.bonus_mautic = Math.min(Math.round(pageHits * 0.5) + Math.min(emailClicks, 5), 15);

  const mensagensTotal = lead.dados_chatwoot?.mensagens_total ?? 0;
  breakdown.bonus_chatwoot = Math.min(Math.round(mensagensTotal * 0.5), 5);

  const carrinhoAbandonado = (lead.dados_empresa as DadosTokeniza)?.carrinho_abandonado ?? false;
  if (carrinhoAbandonado) breakdown.bonus_carrinho = 15;

  if (lead.lead_pago) breakdown.bonus_lead_pago = 5;

  breakdown.ajuste_prioridade = (4 - prioridade) * 5;

  breakdown.total = Math.min(
    breakdown.base_temperatura + breakdown.bonus_icp + breakdown.bonus_evento +
    breakdown.bonus_score_externo + breakdown.bonus_mautic + breakdown.bonus_chatwoot +
    breakdown.bonus_carrinho + breakdown.bonus_lead_pago + breakdown.ajuste_prioridade,
    100
  );

  return breakdown;
}

// ========================================
// CLASSIFICAÇÃO ORQUESTRADORA
// ========================================
export async function classificarLead(
  supabase: SupabaseClient,
  eventId: string,
  lead: LeadNormalizado
): Promise<LeadClassificationResult> {
  console.log('[Classificação] Iniciando classificação:', {
    lead_id: lead.lead_id, empresa: lead.empresa, evento: lead.evento,
  });

  let icp: ICP;
  let persona: Persona;
  let icpRazao: string;

  if (lead.empresa === 'TOKENIZA') {
    const result = classificarTokeniza(lead);
    icp = result.icp; persona = result.persona; icpRazao = result.razao;
  } else {
    const result = classificarBlue(lead);
    icp = result.icp; persona = result.persona; icpRazao = result.razao;
  }

  const temperaturaResult = calcularTemperatura(lead, icp);
  const prioridadeResult = calcularPrioridade(icp, temperaturaResult.temperatura);
  const scoreBreakdown = calcularScoreInterno(lead, icp, temperaturaResult.temperatura, prioridadeResult.prioridade);

  const dadosTokeniza = lead.dados_empresa as DadosTokeniza | null;
  const dadosBlue = lead.dados_empresa as DadosBlue | null;
  
  const dadosUtilizados = {
    evento: lead.evento, stage: lead.stage, score_externo: lead.score,
    mautic_page_hits: lead.dados_mautic?.page_hits ?? 0,
    mautic_email_clicks: lead.dados_mautic?.email_clicks ?? 0,
    chatwoot_mensagens: lead.dados_chatwoot?.mensagens_total ?? 0,
    carrinho_abandonado: dadosTokeniza?.carrinho_abandonado ?? false,
    valor_carrinho: dadosTokeniza?.valor_carrinho ?? 0,
    valor_investido: dadosTokeniza?.valor_investido ?? 0,
    qtd_investimentos: dadosTokeniza?.qtd_investimentos ?? 0,
    qtd_compras_ir: dadosBlue?.qtd_compras_ir ?? 0,
    ticket_medio: dadosBlue?.ticket_medio ?? 0,
    lead_pago: lead.lead_pago,
  };

  const justificativa = {
    icp_razao: icpRazao,
    temperatura_razao: temperaturaResult.razao,
    prioridade_razao: prioridadeResult.razao,
    score_breakdown: scoreBreakdown,
    dados_utilizados: dadosUtilizados,
  };

  const classification: LeadClassificationResult = {
    leadId: lead.lead_id, empresa: lead.empresa,
    icp, persona,
    temperatura: temperaturaResult.temperatura,
    prioridade: prioridadeResult.prioridade,
    scoreInterno: scoreBreakdown.total,
  };

  console.log('[Classificação] Resultado:', classification);

  // Score composto
  let scoreComposto: number | null = null;
  const { data: leadContactData } = await supabase
    .from('lead_contacts')
    .select('score_marketing')
    .eq('lead_id', lead.lead_id)
    .eq('empresa', lead.empresa)
    .maybeSingle();

  if (leadContactData?.score_marketing !== null && leadContactData?.score_marketing !== undefined) {
    const scoreMarketing = Math.min(leadContactData.score_marketing, 100);
    scoreComposto = Math.round((scoreBreakdown.total * 0.6) + (scoreMarketing * 0.4));
    console.log('[Classificação] Score composto:', { score_interno: scoreBreakdown.total, score_marketing: leadContactData.score_marketing, score_composto: scoreComposto });
  }

  const { error: upsertError } = await supabase
    .from('lead_classifications')
    .upsert({
      lead_id: lead.lead_id, empresa: lead.empresa,
      icp, persona,
      temperatura: temperaturaResult.temperatura,
      prioridade: prioridadeResult.prioridade,
      score_interno: scoreBreakdown.total,
      score_composto: scoreComposto,
      fonte_evento_id: eventId,
      fonte_evento_tipo: lead.evento,
      classificado_em: new Date().toISOString(),
      justificativa,
    } as Record<string, unknown>, { onConflict: 'lead_id,empresa' });

  if (upsertError) {
    console.error('[Classificação] Erro ao salvar:', upsertError);
    throw upsertError;
  }

  await supabase.from('sgt_event_logs').insert({
    event_id: eventId,
    status: 'PROCESSADO',
    mensagem: `Lead classificado: ICP=${icp}, Temperatura=${temperaturaResult.temperatura}, Prioridade=${prioridadeResult.prioridade}`,
  } as Record<string, unknown>);

  return classification;
}
