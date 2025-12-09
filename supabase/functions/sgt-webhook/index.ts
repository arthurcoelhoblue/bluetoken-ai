import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SGT Webhook - Patches 2, 3 e 4
// Atualizado conforme documentação oficial SGT v1.0
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sgt-signature, x-sgt-timestamp',
};

// ========================================
// TIPOS - Alinhados com documentação SGT
// ========================================
type SGTEventoTipo = 'LEAD_NOVO' | 'ATUALIZACAO' | 'CARRINHO_ABANDONADO' | 'MQL' | 'SCORE_ATUALIZADO' | 'CLIQUE_OFERTA' | 'FUNIL_ATUALIZADO';
type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type LeadStage = 'Lead' | 'Contato Iniciado' | 'Negociação' | 'Perdido' | 'Cliente';
type OrigemTipo = 'INBOUND' | 'OUTBOUND' | 'REFERRAL' | 'PARTNER';
type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';
type Prioridade = 1 | 2 | 3;

type IcpTokeniza = 'TOKENIZA_SERIAL' | 'TOKENIZA_MEDIO_PRAZO' | 'TOKENIZA_EMERGENTE' | 'TOKENIZA_ALTO_VOLUME_DIGITAL' | 'TOKENIZA_NAO_CLASSIFICADO';
type IcpBlue = 'BLUE_ALTO_TICKET_IR' | 'BLUE_RECURRENTE' | 'BLUE_PERDIDO_RECUPERAVEL' | 'BLUE_NAO_CLASSIFICADO';
type ICP = IcpTokeniza | IcpBlue;

type PersonaTokeniza = 'CONSTRUTOR_PATRIMONIO' | 'COLECIONADOR_DIGITAL' | 'INICIANTE_CAUTELOSO';
type PersonaBlue = 'CRIPTO_CONTRIBUINTE_URGENTE' | 'CLIENTE_FIEL_RENOVADOR' | 'LEAD_PERDIDO_RECUPERAVEL';
type Persona = PersonaTokeniza | PersonaBlue | null;

type CadenceCodigo = 'TOKENIZA_INBOUND_LEAD_NOVO' | 'TOKENIZA_MQL_QUENTE' | 'BLUE_INBOUND_LEAD_NOVO' | 'BLUE_IR_URGENTE';

// ========================================
// INTERFACES - Estrutura completa do payload SGT
// ========================================
interface DadosLead {
  nome: string;
  email: string;
  telefone?: string;
  
  // UTM parameters
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  
  // Score e stage
  score?: number;
  stage?: LeadStage | string;
  
  // Pipedrive
  pipedrive_deal_id?: string;
  url_pipedrive?: string;
  
  // Organização e origem
  organizacao?: string;
  origem_tipo?: OrigemTipo;
  lead_pago?: boolean;
  
  // Datas importantes
  data_criacao?: string;
  data_mql?: string;
  data_levantou_mao?: string;
  data_reuniao?: string;
  data_venda?: string;
  
  // Valor
  valor_venda?: number;
}

interface DadosTokeniza {
  valor_investido?: number;
  qtd_investimentos?: number;
  qtd_projetos?: number;
  ultimo_investimento_em?: string | null;
  projetos?: string[];
  carrinho_abandonado?: boolean;
  valor_carrinho?: number;
}

interface DadosBlue {
  qtd_compras_ir?: number;
  ticket_medio?: number;
  score_mautic?: number;
  plano_atual?: string | null;
  cliente_status?: string;
}

interface DadosMautic {
  contact_id?: number;
  score?: number;
  page_hits?: number;
  email_opens?: number;
  email_clicks?: number;
  last_active?: string;
  tags?: string[];
  segments?: string[];
}

interface DadosChatwoot {
  contact_id?: number;
  mensagens_total?: number;
  ultima_mensagem_em?: string;
  status_conversa?: string;
  canal?: string;
}

interface DadosNotion {
  page_id?: string;
  cliente_status?: string;
  conta_ativa?: boolean;
  ultimo_servico?: string;
  notas?: string;
}

interface EventMetadata {
  oferta_id?: string;
  valor_simulado?: number;
  pagina_visitada?: string;
  tipo_compra?: string;
  referrer?: string;
  device?: string;
  ip_address?: string;
}

interface SGTPayload {
  lead_id: string;
  evento: SGTEventoTipo;
  empresa: EmpresaTipo;
  timestamp: string;
  dados_lead: DadosLead;
  dados_tokeniza?: DadosTokeniza;
  dados_blue?: DadosBlue;
  dados_mautic?: DadosMautic;
  dados_chatwoot?: DadosChatwoot;
  dados_notion?: DadosNotion;
  event_metadata?: EventMetadata;
}

interface LeadNormalizado {
  lead_id: string;
  empresa: EmpresaTipo;
  evento: SGTEventoTipo;
  timestamp: Date;
  nome: string;
  email: string;
  telefone: string | null;
  organizacao: string | null;
  
  // UTM
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  
  // Score e stage
  score: number;
  stage: LeadStage | null;
  
  // Origem
  origem_tipo: OrigemTipo | null;
  lead_pago: boolean;
  
  // Datas e valores
  data_mql: Date | null;
  data_venda: Date | null;
  valor_venda: number | null;
  
  // Dados específicos
  dados_empresa: DadosTokeniza | DadosBlue | null;
  dados_mautic: DadosMautic | null;
  dados_chatwoot: DadosChatwoot | null;
  dados_notion: DadosNotion | null;
  metadata: EventMetadata | null;
  
  // Pipedrive
  pipedrive_deal_id: string | null;
  url_pipedrive: string | null;
}

interface LeadClassificationResult {
  leadId: string;
  empresa: EmpresaTipo;
  icp: ICP;
  persona: Persona;
  temperatura: Temperatura;
  prioridade: Prioridade;
  scoreInterno: number;
}

// ========================================
// CONSTANTES
// ========================================
const EVENTOS_VALIDOS: SGTEventoTipo[] = [
  'LEAD_NOVO', 'ATUALIZACAO', 'CARRINHO_ABANDONADO', 
  'MQL', 'SCORE_ATUALIZADO', 'CLIQUE_OFERTA', 'FUNIL_ATUALIZADO'
];

const EMPRESAS_VALIDAS: EmpresaTipo[] = ['TOKENIZA', 'BLUE'];

const LEAD_STAGES_VALIDOS: string[] = ['Lead', 'Contato Iniciado', 'Negociação', 'Perdido', 'Cliente'];

// Eventos que indicam alta intenção (temperatura QUENTE)
const EVENTOS_QUENTES: SGTEventoTipo[] = ['MQL', 'CARRINHO_ABANDONADO', 'CLIQUE_OFERTA'];

// ========================================
// NORMALIZAÇÃO - Aceita payload completo SGT
// ========================================
function normalizeStage(stage: string | undefined): LeadStage | null {
  if (!stage) return null;
  const trimmed = stage.trim();
  
  // Mapeia variações comuns
  const stageMap: Record<string, LeadStage> = {
    'lead': 'Lead',
    'contato iniciado': 'Contato Iniciado',
    'negociação': 'Negociação',
    'negociacao': 'Negociação',
    'perdido': 'Perdido',
    'cliente': 'Cliente',
  };
  
  const normalized = stageMap[trimmed.toLowerCase()];
  if (normalized) return normalized;
  
  // Verifica se é um stage válido
  if (LEAD_STAGES_VALIDOS.includes(trimmed)) {
    return trimmed as LeadStage;
  }
  
  return null;
}

function normalizeSGTEvent(payload: SGTPayload): LeadNormalizado {
  const { lead_id, evento, empresa, timestamp, dados_lead, dados_tokeniza, dados_blue, dados_mautic, dados_chatwoot, dados_notion, event_metadata } = payload;
  
  // Normaliza dados específicos da empresa
  let dadosEmpresa: DadosTokeniza | DadosBlue | null = null;
  if (empresa === 'TOKENIZA' && dados_tokeniza) {
    dadosEmpresa = {
      valor_investido: dados_tokeniza.valor_investido ?? 0,
      qtd_investimentos: dados_tokeniza.qtd_investimentos ?? 0,
      qtd_projetos: dados_tokeniza.qtd_projetos ?? 0,
      ultimo_investimento_em: dados_tokeniza.ultimo_investimento_em ?? null,
      projetos: dados_tokeniza.projetos ?? [],
      carrinho_abandonado: dados_tokeniza.carrinho_abandonado ?? false,
      valor_carrinho: dados_tokeniza.valor_carrinho ?? 0,
    };
  } else if (empresa === 'BLUE' && dados_blue) {
    dadosEmpresa = {
      qtd_compras_ir: dados_blue.qtd_compras_ir ?? 0,
      ticket_medio: dados_blue.ticket_medio ?? 0,
      score_mautic: dados_blue.score_mautic ?? 0,
      plano_atual: dados_blue.plano_atual ?? undefined,
      cliente_status: dados_blue.cliente_status ?? undefined,
    };
  }

  // Normaliza dados do Mautic
  const dadosMauticNormalized: DadosMautic | null = dados_mautic ? {
    contact_id: dados_mautic.contact_id,
    score: dados_mautic.score ?? 0,
    page_hits: dados_mautic.page_hits ?? 0,
    email_opens: dados_mautic.email_opens ?? 0,
    email_clicks: dados_mautic.email_clicks ?? 0,
    last_active: dados_mautic.last_active ?? undefined,
    tags: dados_mautic.tags ?? [],
    segments: dados_mautic.segments ?? [],
  } : null;

  // Normaliza dados do Chatwoot
  const dadosChatwootNormalized: DadosChatwoot | null = dados_chatwoot ? {
    contact_id: dados_chatwoot.contact_id,
    mensagens_total: dados_chatwoot.mensagens_total ?? 0,
    ultima_mensagem_em: dados_chatwoot.ultima_mensagem_em ?? undefined,
    status_conversa: dados_chatwoot.status_conversa ?? undefined,
    canal: dados_chatwoot.canal ?? undefined,
  } : null;

  // Normaliza dados do Notion
  const dadosNotionNormalized: DadosNotion | null = dados_notion ? {
    page_id: dados_notion.page_id ?? undefined,
    cliente_status: dados_notion.cliente_status ?? undefined,
    conta_ativa: dados_notion.conta_ativa ?? false,
    ultimo_servico: dados_notion.ultimo_servico ?? undefined,
    notas: dados_notion.notas ?? undefined,
  } : null;

  // Parse de datas
  const parseDateSafe = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  return {
    lead_id,
    empresa,
    evento,
    timestamp: new Date(timestamp),
    nome: dados_lead.nome?.trim() || 'Sem nome',
    email: dados_lead.email?.trim().toLowerCase() || '',
    telefone: dados_lead.telefone?.replace(/\D/g, '') || null,
    organizacao: dados_lead.organizacao?.trim() || null,
    
    // UTM completo
    utm_source: dados_lead.utm_source || null,
    utm_medium: dados_lead.utm_medium || null,
    utm_campaign: dados_lead.utm_campaign || null,
    utm_term: dados_lead.utm_term || null,
    utm_content: dados_lead.utm_content || null,
    
    // Score e stage
    score: dados_lead.score ?? 0,
    stage: normalizeStage(dados_lead.stage as string),
    
    // Origem
    origem_tipo: dados_lead.origem_tipo || null,
    lead_pago: dados_lead.lead_pago ?? false,
    
    // Datas e valores
    data_mql: parseDateSafe(dados_lead.data_mql),
    data_venda: parseDateSafe(dados_lead.data_venda),
    valor_venda: dados_lead.valor_venda ?? null,
    
    // Dados específicos
    dados_empresa: dadosEmpresa,
    dados_mautic: dadosMauticNormalized,
    dados_chatwoot: dadosChatwootNormalized,
    dados_notion: dadosNotionNormalized,
    metadata: event_metadata || null,
    
    // Pipedrive
    pipedrive_deal_id: dados_lead.pipedrive_deal_id || null,
    url_pipedrive: dados_lead.url_pipedrive || null,
  };
}

// ========================================
// AUTENTICAÇÃO
// ========================================
function validateBearerToken(authHeader: string | null): boolean {
  const secret = Deno.env.get('SGT_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[SGT Webhook] SGT_WEBHOOK_SECRET não configurado');
    return false;
  }

  if (!authHeader) {
    console.error('[SGT Webhook] Header Authorization ausente');
    return false;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.error('[SGT Webhook] Formato de Authorization inválido');
    return false;
  }

  return match[1] === secret;
}

// ========================================
// VALIDAÇÃO DE PAYLOAD
// ========================================
function normalizePayloadFormat(payload: Record<string, unknown>): Record<string, unknown> {
  // Se já tem dados_lead, retorna como está
  if (payload.dados_lead && typeof payload.dados_lead === 'object') {
    return payload;
  }

  // Modo flat: campos no nível raiz → converte para nested
  const flatFields = ['nome', 'email', 'telefone', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'score', 'stage', 'pipedrive_deal_id', 'url_pipedrive', 'organizacao', 'origem_tipo', 'lead_pago'];
  const hasFlatFields = flatFields.some(f => f in payload);
  
  if (hasFlatFields) {
    console.log('[SGT Webhook] Payload em formato flat detectado, convertendo...');
    const dadosLead: Record<string, unknown> = {};
    flatFields.forEach(field => {
      if (payload[field] !== undefined) {
        dadosLead[field] = payload[field];
      }
    });
    
    if (!payload.timestamp) {
      payload.timestamp = new Date().toISOString();
    }
    
    return {
      ...payload,
      dados_lead: dadosLead,
    };
  }

  return payload;
}

function validatePayload(payload: unknown): { valid: boolean; error?: string; normalized?: Record<string, unknown> } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  const p = normalizePayloadFormat(payload as Record<string, unknown>);

  if (!p.lead_id || typeof p.lead_id !== 'string') {
    return { valid: false, error: 'lead_id é obrigatório' };
  }

  if (!p.evento || !EVENTOS_VALIDOS.includes(p.evento as SGTEventoTipo)) {
    return { valid: false, error: `evento inválido. Valores aceitos: ${EVENTOS_VALIDOS.join(', ')}` };
  }

  if (!p.empresa || !EMPRESAS_VALIDAS.includes(p.empresa as EmpresaTipo)) {
    return { valid: false, error: `empresa inválida. Valores aceitos: ${EMPRESAS_VALIDAS.join(', ')}` };
  }

  if (!p.timestamp || typeof p.timestamp !== 'string') {
    return { valid: false, error: 'timestamp é obrigatório' };
  }

  if (!p.dados_lead || typeof p.dados_lead !== 'object') {
    return { valid: false, error: 'dados_lead é obrigatório (ou forneça nome/email/telefone no nível raiz)' };
  }

  const dadosLead = p.dados_lead as Record<string, unknown>;
  if (!dadosLead.email || typeof dadosLead.email !== 'string') {
    return { valid: false, error: 'email é obrigatório (dados_lead.email ou email)' };
  }

  return { valid: true, normalized: p };
}

function generateIdempotencyKey(payload: SGTPayload): string {
  return `${payload.lead_id}_${payload.evento}_${payload.timestamp}`;
}

// ========================================
// CLASSIFICAÇÃO - Usa dados enriquecidos
// ========================================
function classificarTokeniza(lead: LeadNormalizado): { icp: IcpTokeniza; persona: PersonaTokeniza | null } {
  const dados = lead.dados_empresa as DadosTokeniza | null;
  const valorInvestido = dados?.valor_investido ?? 0;
  const qtdInvestimentos = dados?.qtd_investimentos ?? 0;
  const qtdProjetos = dados?.qtd_projetos ?? 0;
  const carrinhoAbandonado = dados?.carrinho_abandonado ?? false;
  const valorCarrinho = dados?.valor_carrinho ?? 0;

  // Carrinho abandonado com valor alto → Prioridade máxima
  if (carrinhoAbandonado && valorCarrinho >= 5000) {
    return { icp: 'TOKENIZA_SERIAL', persona: 'CONSTRUTOR_PATRIMONIO' };
  }

  // TOKENIZA_SERIAL
  if (valorInvestido >= 100000 || qtdInvestimentos >= 40 || qtdProjetos >= 20) {
    return { icp: 'TOKENIZA_SERIAL', persona: 'CONSTRUTOR_PATRIMONIO' };
  }

  // TOKENIZA_ALTO_VOLUME_DIGITAL
  if (lead.metadata?.tipo_compra && valorInvestido >= 10000) {
    return { icp: 'TOKENIZA_ALTO_VOLUME_DIGITAL', persona: 'COLECIONADOR_DIGITAL' };
  }

  // TOKENIZA_MEDIO_PRAZO
  if ((valorInvestido >= 20000 && valorInvestido < 100000) || 
      (qtdInvestimentos >= 15 && qtdInvestimentos < 40)) {
    return { icp: 'TOKENIZA_MEDIO_PRAZO', persona: 'CONSTRUTOR_PATRIMONIO' };
  }

  // TOKENIZA_EMERGENTE
  if ((valorInvestido >= 5000 && valorInvestido < 20000) || 
      (qtdInvestimentos >= 5 && qtdInvestimentos < 15) ||
      carrinhoAbandonado) {
    return { icp: 'TOKENIZA_EMERGENTE', persona: 'INICIANTE_CAUTELOSO' };
  }

  return { icp: 'TOKENIZA_NAO_CLASSIFICADO', persona: null };
}

function classificarBlue(lead: LeadNormalizado): { icp: IcpBlue; persona: PersonaBlue | null } {
  const dados = lead.dados_empresa as DadosBlue | null;
  const ticketMedio = dados?.ticket_medio ?? 0;
  const scoreMautic = dados?.score_mautic ?? 0;
  const qtdComprasIr = dados?.qtd_compras_ir ?? 0;
  const stage = lead.stage;
  
  // Usa dados do Mautic para enriquecer classificação
  const mauticScore = lead.dados_mautic?.score ?? scoreMautic;
  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const emailClicks = lead.dados_mautic?.email_clicks ?? 0;

  // BLUE_ALTO_TICKET_IR - Considera engajamento do Mautic
  if (ticketMedio >= 4000 || 
      (mauticScore >= 30 && (stage === 'Negociação' || stage === 'Cliente')) ||
      (pageHits >= 20 && emailClicks >= 5)) {
    return { icp: 'BLUE_ALTO_TICKET_IR', persona: 'CRIPTO_CONTRIBUINTE_URGENTE' };
  }

  // BLUE_RECURRENTE
  if (qtdComprasIr >= 2) {
    return { icp: 'BLUE_RECURRENTE', persona: 'CLIENTE_FIEL_RENOVADOR' };
  }

  // BLUE_PERDIDO_RECUPERAVEL - Considera engajamento recente
  if (stage === 'Perdido' && (mauticScore >= 20 || pageHits >= 5)) {
    return { icp: 'BLUE_PERDIDO_RECUPERAVEL', persona: 'LEAD_PERDIDO_RECUPERAVEL' };
  }

  return { icp: 'BLUE_NAO_CLASSIFICADO', persona: null };
}

function calcularTemperatura(lead: LeadNormalizado, icp: ICP): Temperatura {
  const evento = lead.evento;
  const stage = lead.stage;
  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const carrinhoAbandonado = (lead.dados_empresa as DadosTokeniza)?.carrinho_abandonado ?? false;

  // Carrinho abandonado = QUENTE
  if (carrinhoAbandonado) {
    return 'QUENTE';
  }

  // Eventos quentes sempre aumentam temperatura
  if (EVENTOS_QUENTES.includes(evento)) {
    return 'QUENTE';
  }

  // Stage de negociação/cliente indica alta intenção
  if (stage === 'Negociação' || stage === 'Cliente') {
    return 'QUENTE';
  }

  // Alto engajamento no Mautic
  if (pageHits >= 15) {
    return 'QUENTE';
  }

  // ICPs de alto valor tendem a ser mais quentes
  if (icp === 'TOKENIZA_SERIAL' || icp === 'BLUE_ALTO_TICKET_IR') {
    return evento === 'LEAD_NOVO' ? 'MORNO' : 'QUENTE';
  }

  // Leads perdidos são mornos se tiverem engajamento
  if (icp === 'BLUE_PERDIDO_RECUPERAVEL') {
    return 'MORNO';
  }

  // ICPs médios
  if (icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE' || icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL') {
    return 'MORNO';
  }

  // Engajamento moderado no Mautic
  if (pageHits >= 5) {
    return 'MORNO';
  }

  // Default para leads novos ou emergentes
  if (evento === 'LEAD_NOVO' || evento === 'ATUALIZACAO') {
    return icp.includes('NAO_CLASSIFICADO') ? 'FRIO' : 'MORNO';
  }

  return 'FRIO';
}

function calcularPrioridade(icp: ICP, temperatura: Temperatura): Prioridade {
  if (temperatura === 'QUENTE' && 
      (icp === 'TOKENIZA_SERIAL' || icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL' || icp === 'BLUE_ALTO_TICKET_IR')) {
    return 1;
  }

  if ((icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE') ||
      (temperatura === 'QUENTE' && !icp.includes('NAO_CLASSIFICADO'))) {
    return 2;
  }

  return 3;
}

function calcularScoreInterno(lead: LeadNormalizado, icp: ICP, temperatura: Temperatura, prioridade: Prioridade): number {
  let score = 0;

  // Base por temperatura
  if (temperatura === 'QUENTE') score += 40;
  else if (temperatura === 'MORNO') score += 25;
  else score += 10;

  // Bonus por ICP
  if (icp === 'TOKENIZA_SERIAL' || icp === 'BLUE_ALTO_TICKET_IR') score += 30;
  else if (icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE') score += 20;
  else if (icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL') score += 25;
  else if (!icp.includes('NAO_CLASSIFICADO')) score += 10;

  // Bonus por evento
  if (EVENTOS_QUENTES.includes(lead.evento)) score += 15;

  // Bonus por score externo
  score += Math.min(lead.score * 0.1, 10);

  // Bonus por engajamento Mautic
  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const emailClicks = lead.dados_mautic?.email_clicks ?? 0;
  score += Math.min(pageHits * 0.5, 10);
  score += Math.min(emailClicks * 1, 5);

  // Bonus por conversas Chatwoot
  const mensagensTotal = lead.dados_chatwoot?.mensagens_total ?? 0;
  score += Math.min(mensagensTotal * 0.5, 5);

  // Bonus por carrinho abandonado
  const carrinhoAbandonado = (lead.dados_empresa as DadosTokeniza)?.carrinho_abandonado ?? false;
  if (carrinhoAbandonado) score += 15;

  // Bonus por lead pago
  if (lead.lead_pago) score += 5;

  // Ajuste por prioridade (inverso)
  score += (4 - prioridade) * 5;

  return Math.min(Math.round(score), 100);
}

async function classificarLead(
  supabase: SupabaseClient,
  eventId: string,
  lead: LeadNormalizado
): Promise<LeadClassificationResult> {
  console.log('[Classificação] Iniciando classificação:', {
    lead_id: lead.lead_id,
    empresa: lead.empresa,
    evento: lead.evento,
  });

  let icp: ICP;
  let persona: Persona;

  if (lead.empresa === 'TOKENIZA') {
    const result = classificarTokeniza(lead);
    icp = result.icp;
    persona = result.persona;
  } else {
    const result = classificarBlue(lead);
    icp = result.icp;
    persona = result.persona;
  }

  const temperatura = calcularTemperatura(lead, icp);
  const prioridade = calcularPrioridade(icp, temperatura);
  const scoreInterno = calcularScoreInterno(lead, icp, temperatura, prioridade);

  const classification: LeadClassificationResult = {
    leadId: lead.lead_id,
    empresa: lead.empresa,
    icp,
    persona,
    temperatura,
    prioridade,
    scoreInterno,
  };

  console.log('[Classificação] Resultado:', classification);

  const { error: upsertError } = await supabase
    .from('lead_classifications')
    .upsert({
      lead_id: lead.lead_id,
      empresa: lead.empresa,
      icp: icp,
      persona: persona,
      temperatura: temperatura,
      prioridade: prioridade,
      score_interno: scoreInterno,
      fonte_evento_id: eventId,
      fonte_evento_tipo: lead.evento,
      classificado_em: new Date().toISOString(),
    } as Record<string, unknown>, {
      onConflict: 'lead_id,empresa',
    });

  if (upsertError) {
    console.error('[Classificação] Erro ao salvar:', upsertError);
    throw upsertError;
  }

  await supabase.from('sgt_event_logs').insert({
    event_id: eventId,
    status: 'PROCESSADO',
    mensagem: `Lead classificado: ICP=${icp}, Temperatura=${temperatura}, Prioridade=${prioridade}`,
  } as Record<string, unknown>);

  return classification;
}

// ========================================
// MOTOR DE CADÊNCIAS
// ========================================
function decidirCadenciaParaLead(
  classification: LeadClassificationResult,
  evento: SGTEventoTipo
): CadenceCodigo | null {
  const { empresa, icp, temperatura } = classification;

  console.log('[Cadência] Decidindo cadência:', { empresa, icp, temperatura, evento });

  if (empresa === 'TOKENIZA') {
    if ((evento === 'MQL' || evento === 'CARRINHO_ABANDONADO') && temperatura === 'QUENTE') {
      return 'TOKENIZA_MQL_QUENTE';
    }
    if (evento === 'LEAD_NOVO') {
      return 'TOKENIZA_INBOUND_LEAD_NOVO';
    }
  }

  if (empresa === 'BLUE') {
    if (icp === 'BLUE_ALTO_TICKET_IR' || 
        (icp === 'BLUE_RECURRENTE' && evento === 'MQL')) {
      return 'BLUE_IR_URGENTE';
    }
    if (evento === 'LEAD_NOVO') {
      return 'BLUE_INBOUND_LEAD_NOVO';
    }
  }

  console.log('[Cadência] Nenhuma cadência aplicável para este evento');
  return null;
}

async function iniciarCadenciaParaLead(
  supabase: SupabaseClient,
  leadId: string,
  empresa: EmpresaTipo,
  cadenceCodigo: CadenceCodigo,
  classification: LeadClassificationResult,
  fonteEventoId: string
): Promise<{ success: boolean; runId?: string; skipped?: boolean; reason?: string }> {
  console.log('[Cadência] Iniciando cadência:', { leadId, empresa, cadenceCodigo });

  const { data: cadence, error: cadenceError } = await supabase
    .from('cadences')
    .select('id, codigo, nome')
    .eq('codigo', cadenceCodigo)
    .eq('ativo', true)
    .single();

  if (cadenceError || !cadence) {
    console.error('[Cadência] Cadência não encontrada:', cadenceCodigo);
    return { success: false, reason: `Cadência ${cadenceCodigo} não encontrada ou inativa` };
  }

  const { data: existingRun } = await supabase
    .from('lead_cadence_runs')
    .select('id, status')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .eq('status', 'ATIVA')
    .maybeSingle();

  if (existingRun) {
    console.log('[Cadência] Lead já possui cadência ativa:', existingRun.id);
    return { success: true, skipped: true, reason: 'Lead já possui cadência ativa', runId: existingRun.id };
  }

  const { data: firstStep, error: stepError } = await supabase
    .from('cadence_steps')
    .select('ordem, offset_minutos, template_codigo')
    .eq('cadence_id', cadence.id)
    .order('ordem', { ascending: true })
    .limit(1)
    .single();

  if (stepError || !firstStep) {
    console.error('[Cadência] Nenhum step encontrado para cadência:', cadenceCodigo);
    return { success: false, reason: 'Nenhum step configurado para esta cadência' };
  }

  const now = new Date();
  const nextRunAt = new Date(now.getTime() + firstStep.offset_minutos * 60 * 1000);

  const { data: newRun, error: runError } = await supabase
    .from('lead_cadence_runs')
    .insert({
      lead_id: leadId,
      empresa: empresa,
      cadence_id: cadence.id,
      status: 'ATIVA',
      started_at: now.toISOString(),
      last_step_ordem: 0,
      next_step_ordem: firstStep.ordem,
      next_run_at: nextRunAt.toISOString(),
      classification_snapshot: classification as unknown as Record<string, unknown>,
      fonte_evento_id: fonteEventoId,
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (runError || !newRun) {
    console.error('[Cadência] Erro ao criar run:', runError);
    return { success: false, reason: 'Erro ao criar run de cadência' };
  }

  console.log('[Cadência] Run criado:', newRun.id);

  await supabase.from('lead_cadence_events').insert({
    lead_cadence_run_id: newRun.id,
    step_ordem: firstStep.ordem,
    template_codigo: firstStep.template_codigo,
    tipo_evento: 'AGENDADO',
    detalhes: {
      next_run_at: nextRunAt.toISOString(),
      cadence_codigo: cadenceCodigo,
      cadence_nome: cadence.nome,
    },
  } as Record<string, unknown>);

  console.log('[Cadência] Evento AGENDADO criado para step', firstStep.ordem);

  return { success: true, runId: newRun.id };
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get('authorization');
    const bodyText = await req.text();
    
    console.log('[SGT Webhook] Requisição recebida:', {
      hasAuth: !!authHeader,
      bodyLength: bodyText.length,
    });

    const isValidToken = validateBearerToken(authHeader);
    if (!isValidToken) {
      console.error('[SGT Webhook] Token inválido ou ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let payload: SGTPayload;
    try {
      const rawPayload = JSON.parse(bodyText);
      const validation = validatePayload(rawPayload);
      if (!validation.valid) {
        console.error('[SGT Webhook] Payload inválido:', validation.error);
        return new Response(
          JSON.stringify({ error: validation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      payload = validation.normalized as unknown as SGTPayload;
    } catch {
      return new Response(
        JSON.stringify({ error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const idempotencyKey = generateIdempotencyKey(payload);
    
    const { data: existingEvent } = await supabase
      .from('sgt_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingEvent) {
      console.log('[SGT Webhook] Evento duplicado ignorado:', idempotencyKey);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Evento já processado',
          event_id: existingEvent.id,
          idempotent: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: newEvent, error: insertError } = await supabase
      .from('sgt_events')
      .insert({
        lead_id: payload.lead_id,
        empresa: payload.empresa,
        evento: payload.evento,
        payload: payload,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[SGT Webhook] Erro ao inserir evento:', insertError);
      throw insertError;
    }

    console.log('[SGT Webhook] Evento inserido:', newEvent.id);

    await supabase.from('sgt_event_logs').insert({
      event_id: newEvent.id,
      status: 'RECEBIDO',
      mensagem: `Evento ${payload.evento} recebido para lead ${payload.lead_id}`,
    } as Record<string, unknown>);

    const leadNormalizado = normalizeSGTEvent(payload);
    console.log('[SGT Webhook] Lead normalizado:', leadNormalizado);

    // Upsert em lead_contacts
    const primeiroNome = leadNormalizado.nome.split(' ')[0] || leadNormalizado.nome;
    const payloadAny = payload as unknown as Record<string, unknown>;
    const pipedriveDealeId = 
      payload.dados_lead?.pipedrive_deal_id || 
      payloadAny.pipedrive_deal_id ||
      null;
    
    await supabase.from('lead_contacts').upsert({
      lead_id: payload.lead_id,
      empresa: payload.empresa,
      nome: leadNormalizado.nome,
      email: leadNormalizado.email,
      telefone: leadNormalizado.telefone,
      primeiro_nome: primeiroNome,
      pipedrive_deal_id: pipedriveDealeId,
    }, {
      onConflict: 'lead_id,empresa',
    });
    console.log('[SGT Webhook] Lead contact upserted:', payload.lead_id, 'pipedrive_deal_id:', pipedriveDealeId);

    let classification: LeadClassificationResult | null = null;
    let cadenceResult: { cadenceCodigo: string | null; runId?: string; skipped?: boolean } = { cadenceCodigo: null };

    try {
      classification = await classificarLead(supabase, newEvent.id, leadNormalizado);
      
      const cadenceCodigo = decidirCadenciaParaLead(classification, payload.evento);
      cadenceResult.cadenceCodigo = cadenceCodigo;

      if (cadenceCodigo) {
        const result = await iniciarCadenciaParaLead(
          supabase,
          payload.lead_id,
          payload.empresa,
          cadenceCodigo,
          classification,
          newEvent.id
        );
        cadenceResult.runId = result.runId;
        cadenceResult.skipped = result.skipped;

        if (!result.success && !result.skipped) {
          console.warn('[SGT Webhook] Falha ao iniciar cadência:', result.reason);
        }
      }

      await supabase
        .from('sgt_events')
        .update({ processado_em: new Date().toISOString() })
        .eq('id', newEvent.id);

    } catch (pipelineError) {
      console.error('[SGT Webhook] Erro no pipeline:', pipelineError);
      
      await supabase.from('sgt_event_logs').insert({
        event_id: newEvent.id,
        status: 'ERRO',
        mensagem: 'Erro no pipeline de classificação/cadência',
        erro_stack: pipelineError instanceof Error ? pipelineError.stack : String(pipelineError),
      } as Record<string, unknown>);
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: newEvent.id,
        lead_id: payload.lead_id,
        evento: payload.evento,
        empresa: payload.empresa,
        classification: classification ? {
          icp: classification.icp,
          persona: classification.persona,
          temperatura: classification.temperatura,
          prioridade: classification.prioridade,
          score_interno: classification.scoreInterno,
        } : null,
        cadence: cadenceResult.cadenceCodigo ? {
          codigo: cadenceResult.cadenceCodigo,
          run_id: cadenceResult.runId,
          skipped: cadenceResult.skipped || false,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SGT Webhook] Erro geral:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
