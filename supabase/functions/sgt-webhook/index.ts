import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SGT Webhook - Patches 2, 3 e 4
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sgt-signature, x-sgt-timestamp',
};

// ========================================
// TIPOS
// ========================================
type SGTEventoTipo = 'LEAD_NOVO' | 'ATUALIZACAO' | 'CARRINHO_ABANDONADO' | 'MQL' | 'SCORE_ATUALIZADO' | 'CLIQUE_OFERTA' | 'FUNIL_ATUALIZADO';
type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type LeadStage = 'Contato Iniciado' | 'Negociação' | 'Perdido' | 'Cliente';
type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';
type Prioridade = 1 | 2 | 3;

type IcpTokeniza = 'TOKENIZA_SERIAL' | 'TOKENIZA_MEDIO_PRAZO' | 'TOKENIZA_EMERGENTE' | 'TOKENIZA_ALTO_VOLUME_DIGITAL' | 'TOKENIZA_NAO_CLASSIFICADO';
type IcpBlue = 'BLUE_ALTO_TICKET_IR' | 'BLUE_RECURRENTE' | 'BLUE_PERDIDO_RECUPERAVEL' | 'BLUE_NAO_CLASSIFICADO';
type ICP = IcpTokeniza | IcpBlue;

type PersonaTokeniza = 'CONSTRUTOR_PATRIMONIO' | 'COLECIONADOR_DIGITAL' | 'INICIANTE_CAUTELOSO';
type PersonaBlue = 'CRIPTO_CONTRIBUINTE_URGENTE' | 'CLIENTE_FIEL_RENOVADOR' | 'LEAD_PERDIDO_RECUPERAVEL';
type Persona = PersonaTokeniza | PersonaBlue | null;

type CadenceCodigo = 'TOKENIZA_INBOUND_LEAD_NOVO' | 'TOKENIZA_MQL_QUENTE' | 'BLUE_INBOUND_LEAD_NOVO' | 'BLUE_IR_URGENTE';

interface DadosLead {
  nome: string;
  email: string;
  telefone?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  score?: number;
  stage?: LeadStage;
  pipedrive_deal_id?: string;
}

interface DadosTokeniza {
  valor_investido?: number;
  qtd_investimentos?: number;
  qtd_projetos?: number;
  ultimo_investimento_em?: string | null;
}

interface DadosBlue {
  qtd_compras_ir?: number;
  ticket_medio?: number;
  score_mautic?: number;
  plano_atual?: string | null;
}

interface EventMetadata {
  oferta_id?: string;
  valor_simulado?: number;
  pagina_visitada?: string;
  tipo_compra?: string;
}

interface SGTPayload {
  lead_id: string;
  evento: SGTEventoTipo;
  empresa: EmpresaTipo;
  timestamp: string;
  dados_lead: DadosLead;
  dados_tokeniza?: DadosTokeniza;
  dados_blue?: DadosBlue;
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
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  score: number;
  stage: LeadStage | null;
  dados_empresa: DadosTokeniza | DadosBlue | null;
  metadata: EventMetadata | null;
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

// Validação de eventos permitidos
const EVENTOS_VALIDOS: SGTEventoTipo[] = [
  'LEAD_NOVO', 'ATUALIZACAO', 'CARRINHO_ABANDONADO', 
  'MQL', 'SCORE_ATUALIZADO', 'CLIQUE_OFERTA', 'FUNIL_ATUALIZADO'
];

const EMPRESAS_VALIDAS: EmpresaTipo[] = ['TOKENIZA', 'BLUE'];

// Eventos que indicam alta intenção (temperatura QUENTE)
const EVENTOS_QUENTES: SGTEventoTipo[] = ['MQL', 'CARRINHO_ABANDONADO', 'CLIQUE_OFERTA'];

// ========================================
// PATCH 2.2 - Normalizador de Dados
// ========================================
function normalizeSGTEvent(payload: SGTPayload): LeadNormalizado {
  const { lead_id, evento, empresa, timestamp, dados_lead, dados_tokeniza, dados_blue, event_metadata } = payload;
  
  let dadosEmpresa: DadosTokeniza | DadosBlue | null = null;
  if (empresa === 'TOKENIZA' && dados_tokeniza) {
    dadosEmpresa = {
      valor_investido: dados_tokeniza.valor_investido ?? 0,
      qtd_investimentos: dados_tokeniza.qtd_investimentos ?? 0,
      qtd_projetos: dados_tokeniza.qtd_projetos ?? 0,
      ultimo_investimento_em: dados_tokeniza.ultimo_investimento_em ?? null,
    };
  } else if (empresa === 'BLUE' && dados_blue) {
    dadosEmpresa = {
      qtd_compras_ir: dados_blue.qtd_compras_ir ?? 0,
      ticket_medio: dados_blue.ticket_medio ?? 0,
      score_mautic: dados_blue.score_mautic ?? 0,
      plano_atual: dados_blue.plano_atual ?? null,
    };
  }

  return {
    lead_id,
    empresa,
    evento,
    timestamp: new Date(timestamp),
    nome: dados_lead.nome?.trim() || 'Sem nome',
    email: dados_lead.email?.trim().toLowerCase() || '',
    telefone: dados_lead.telefone?.replace(/\D/g, '') || null,
    utm_source: dados_lead.utm_source || null,
    utm_medium: dados_lead.utm_medium || null,
    utm_campaign: dados_lead.utm_campaign || null,
    utm_term: dados_lead.utm_term || null,
    score: dados_lead.score ?? 0,
    stage: dados_lead.stage || null,
    dados_empresa: dadosEmpresa,
    metadata: event_metadata || null,
  };
}

// Validação Bearer Token (simplificado)
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

  // Extrai o token do formato "Bearer <token>"
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.error('[SGT Webhook] Formato de Authorization inválido');
    return false;
  }

  const token = match[1];
  return token === secret;
}

// Normaliza payload para aceitar formato flat (para testes) ou nested (produção)
function normalizePayloadFormat(payload: Record<string, unknown>): Record<string, unknown> {
  // Se já tem dados_lead, retorna como está
  if (payload.dados_lead && typeof payload.dados_lead === 'object') {
    return payload;
  }

  // Modo flat: campos no nível raiz → converte para nested
  const flatFields = ['nome', 'email', 'telefone', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'score', 'stage', 'pipedrive_deal_id'];
  const hasFlatFields = flatFields.some(f => f in payload);
  
  if (hasFlatFields) {
    console.log('[SGT Webhook] Payload em formato flat detectado, convertendo...');
    const dadosLead: Record<string, unknown> = {};
    flatFields.forEach(field => {
      if (payload[field] !== undefined) {
        dadosLead[field] = payload[field];
      }
    });
    
    // Garantir timestamp se não existir
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

// Validação do payload
function validatePayload(payload: unknown): { valid: boolean; error?: string; normalized?: Record<string, unknown> } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload inválido' };
  }

  // Normaliza para aceitar formato flat
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

// Gera chave de idempotência
function generateIdempotencyKey(payload: SGTPayload): string {
  return `${payload.lead_id}_${payload.evento}_${payload.timestamp}`;
}

// ========================================
// PATCH 3 - Classificação de Leads
// ========================================
function classificarTokeniza(lead: LeadNormalizado): { icp: IcpTokeniza; persona: PersonaTokeniza | null } {
  const dados = lead.dados_empresa as DadosTokeniza | null;
  const valorInvestido = dados?.valor_investido ?? 0;
  const qtdInvestimentos = dados?.qtd_investimentos ?? 0;
  const qtdProjetos = dados?.qtd_projetos ?? 0;

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
      (qtdInvestimentos >= 5 && qtdInvestimentos < 15)) {
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

  // BLUE_ALTO_TICKET_IR
  if (ticketMedio >= 4000 || 
      (scoreMautic >= 30 && (stage === 'Negociação' || stage === 'Cliente'))) {
    return { icp: 'BLUE_ALTO_TICKET_IR', persona: 'CRIPTO_CONTRIBUINTE_URGENTE' };
  }

  // BLUE_RECURRENTE
  if (qtdComprasIr >= 2) {
    return { icp: 'BLUE_RECURRENTE', persona: 'CLIENTE_FIEL_RENOVADOR' };
  }

  // BLUE_PERDIDO_RECUPERAVEL
  if (stage === 'Perdido' && scoreMautic >= 20) {
    return { icp: 'BLUE_PERDIDO_RECUPERAVEL', persona: 'LEAD_PERDIDO_RECUPERAVEL' };
  }

  return { icp: 'BLUE_NAO_CLASSIFICADO', persona: null };
}

function calcularTemperatura(lead: LeadNormalizado, icp: ICP): Temperatura {
  const evento = lead.evento;
  const stage = lead.stage;

  // Eventos quentes sempre aumentam temperatura
  if (EVENTOS_QUENTES.includes(evento)) {
    return 'QUENTE';
  }

  // Stage de negociação/cliente indica alta intenção
  if (stage === 'Negociação' || stage === 'Cliente') {
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

  // Default para leads novos ou emergentes
  if (evento === 'LEAD_NOVO' || evento === 'ATUALIZACAO') {
    return icp.includes('NAO_CLASSIFICADO') ? 'FRIO' : 'MORNO';
  }

  return 'FRIO';
}

function calcularPrioridade(icp: ICP, temperatura: Temperatura): Prioridade {
  // Prioridade 1: ICPs de alto valor + temperatura quente
  if (temperatura === 'QUENTE' && 
      (icp === 'TOKENIZA_SERIAL' || icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL' || icp === 'BLUE_ALTO_TICKET_IR')) {
    return 1;
  }

  // Prioridade 2: ICPs médios ou temperatura morna com bom ICP
  if ((icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE') ||
      (temperatura === 'QUENTE' && !icp.includes('NAO_CLASSIFICADO'))) {
    return 2;
  }

  // Prioridade 3: Emergentes, perdidos recuperáveis, não classificados
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

  // Classificar por empresa
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

  // Calcular temperatura e prioridade
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

  // Upsert na tabela lead_classifications
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

  // Log de sucesso
  await supabase.from('sgt_event_logs').insert({
    event_id: eventId,
    status: 'PROCESSADO',
    mensagem: `Lead classificado: ICP=${icp}, Temperatura=${temperatura}, Prioridade=${prioridade}`,
  } as Record<string, unknown>);

  return classification;
}

// ========================================
// PATCH 4 - Motor de Cadências
// ========================================
function decidirCadenciaParaLead(
  classification: LeadClassificationResult,
  evento: SGTEventoTipo
): CadenceCodigo | null {
  const { empresa, icp, temperatura } = classification;

  console.log('[Cadência] Decidindo cadência:', { empresa, icp, temperatura, evento });

  if (empresa === 'TOKENIZA') {
    // MQL ou Carrinho Abandonado + Quente → Cadência urgente
    if ((evento === 'MQL' || evento === 'CARRINHO_ABANDONADO') && temperatura === 'QUENTE') {
      return 'TOKENIZA_MQL_QUENTE';
    }
    // Lead novo → Cadência inbound padrão
    if (evento === 'LEAD_NOVO') {
      return 'TOKENIZA_INBOUND_LEAD_NOVO';
    }
  }

  if (empresa === 'BLUE') {
    // Alto ticket IR ou recorrente com MQL → Cadência urgente IR
    if (icp === 'BLUE_ALTO_TICKET_IR' || 
        (icp === 'BLUE_RECURRENTE' && evento === 'MQL')) {
      return 'BLUE_IR_URGENTE';
    }
    // Lead novo → Cadência inbound padrão
    if (evento === 'LEAD_NOVO') {
      return 'BLUE_INBOUND_LEAD_NOVO';
    }
  }

  // Sem cadência para outros eventos
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

  // 1. Buscar cadência pelo código
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

  // 2. Verificar se já existe run ativa para este lead+empresa
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

  // 3. Buscar primeiro step da cadência
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

  // 4. Calcular next_run_at
  const now = new Date();
  const nextRunAt = new Date(now.getTime() + firstStep.offset_minutos * 60 * 1000);

  // 5. Criar run
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

  // 6. Criar evento de agendamento
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
// Handler Principal
// ========================================
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Apenas POST
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
    // Obtém header de autorização
    const authHeader = req.headers.get('authorization');
    
    // Lê o body
    const bodyText = await req.text();
    
    console.log('[SGT Webhook] Requisição recebida:', {
      hasAuth: !!authHeader,
      bodyLength: bodyText.length,
    });

    // Valida Bearer Token
    const isValidToken = validateBearerToken(authHeader);
    if (!isValidToken) {
      console.error('[SGT Webhook] Token inválido ou ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse do payload
    let payload: SGTPayload;
    try {
      const rawPayload = JSON.parse(bodyText);
      // Valida estrutura do payload (com normalização de formato)
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

    // Gera chave de idempotência
    const idempotencyKey = generateIdempotencyKey(payload);
    
    // Verifica idempotência
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

    // Insere evento
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

    // Registra log de recebimento
    await supabase.from('sgt_event_logs').insert({
      event_id: newEvent.id,
      status: 'RECEBIDO',
      mensagem: `Evento ${payload.evento} recebido para lead ${payload.lead_id}`,
    } as Record<string, unknown>);

    // Normaliza dados
    const leadNormalizado = normalizeSGTEvent(payload);
    console.log('[SGT Webhook] Lead normalizado:', leadNormalizado);

    // PATCH 5A + Pipedrive: Upsert em lead_contacts para garantir dados de contato
    const primeiroNome = leadNormalizado.nome.split(' ')[0] || leadNormalizado.nome;
    
    // Extrai pipedrive_deal_id do payload (root ou dentro de dados_lead)
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

    // Variáveis para resposta
    let classification: LeadClassificationResult | null = null;
    let cadenceResult: { cadenceCodigo: string | null; runId?: string; skipped?: boolean } = { cadenceCodigo: null };

    // Pipeline: Classificação + Cadência
    try {
      // PATCH 3: Classificar lead
      classification = await classificarLead(supabase, newEvent.id, leadNormalizado);
      
      // PATCH 4: Decidir e iniciar cadência
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

      // Atualiza evento como processado
      await supabase
        .from('sgt_events')
        .update({ processado_em: new Date().toISOString() })
        .eq('id', newEvent.id);

    } catch (pipelineError) {
      console.error('[SGT Webhook] Erro no pipeline:', pipelineError);
      
      // Registra erro
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
