import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// SGT Webhook - Patches 2, 3 e 4
// Atualizado conforme documentação oficial SGT v1.0
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sgt-signature, x-sgt-timestamp, x-webhook-secret',
};

// ========================================
// TIPOS - Alinhados com documentação SGT
// ========================================
type SGTEventoTipo = 'LEAD_NOVO' | 'ATUALIZACAO' | 'CARRINHO_ABANDONADO' | 'MQL' | 'SCORE_ATUALIZADO' | 'CLIQUE_OFERTA' | 'FUNIL_ATUALIZADO';
type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type PrioridadeMarketing = 'URGENTE' | 'QUENTE' | 'MORNO' | 'FRIO';
type LeadStage = 'Lead' | 'Contato Iniciado' | 'Negociação' | 'Perdido' | 'Cliente';
type OrigemTipo = 'INBOUND' | 'OUTBOUND' | 'REFERRAL' | 'PARTNER';
type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE';
type TipoLead = 'INVESTIDOR' | 'CAPTADOR';
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
  tipo_lead?: 'INVESTIDOR' | 'CAPTADOR';
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
  contact_id?: number | string;
  score?: number;
  page_hits?: number;
  email_opens?: number;
  email_clicks?: number;
  last_active?: string;
  first_visit?: string;
  tags?: unknown;
  segments?: unknown;
  cidade?: string;
  estado?: string;
}

interface DadosChatwoot {
  contact_id?: number;
  mensagens_total?: number;
  conversas_total?: number;
  ultima_mensagem_em?: string;
  ultima_conversa?: string;
  status_conversa?: string;
  status_atendimento?: string;
  tempo_resposta_medio?: number;
  agente_atual?: string;
  inbox?: string;
  canal?: string;
}

interface DadosLinkedin {
  url?: string;
  cargo?: string;
  empresa?: string;
  setor?: string;
  senioridade?: string;
  conexoes?: number;
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
  score_temperatura?: number;
  prioridade?: PrioridadeMarketing;
  dados_lead: DadosLead;
  dados_linkedin?: DadosLinkedin;
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
// PATCH 5H-PLUS: TIPOS DE SANITIZAÇÃO
// ========================================
type LeadContactIssueTipo = 
  | 'SEM_CANAL_CONTATO'
  | 'EMAIL_PLACEHOLDER'
  | 'EMAIL_INVALIDO'
  | 'TELEFONE_LIXO'
  | 'TELEFONE_SEM_WHATSAPP'
  | 'DADO_SUSPEITO';

interface ContactIssue {
  tipo: LeadContactIssueTipo;
  severidade: 'ALTA' | 'MEDIA' | 'BAIXA';
  mensagem: string;
}

interface PhoneNormalized {
  e164: string;
  ddi: string;
  nacional: string;
  internacional: boolean;
}

interface SanitizationResult {
  descartarLead: boolean;
  issues: ContactIssue[];
  phoneInfo: PhoneNormalized | null;
  emailPlaceholder: boolean;
}

// DDIs conhecidos para validação
const DDI_CONHECIDOS = ['55', '1', '34', '351', '33', '49', '44', '39', '81', '86'];

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
// ROTEAMENTO INTELIGENTE DE LEADS
// ========================================
const PLACEHOLDER_EMAILS_DEDUP = ['sememail@', 'sem-email@', 'noemail@', 'sem@', 'nao-informado@', 'teste@teste', 'email@email', 'x@x', 'a@a', 'placeholder', '@exemplo.', '@example.', 'test@test', 'nao@tem'];

function isPlaceholderEmailForDedup(email: string | null): boolean {
  if (!email) return true;
  const lowered = email.trim().toLowerCase();
  return PLACEHOLDER_EMAILS_DEDUP.some(p => lowered.includes(p));
}

function generatePhoneVariationsForSearch(phone: string | null): string[] {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return [];
  const variations: string[] = [`+${digits}`];
  const withoutDDI = digits.startsWith('55') ? digits.slice(2) : digits;
  const ddd = withoutDDI.slice(0, 2);
  const number = withoutDDI.slice(2);
  variations.push(`+55${withoutDDI}`);
  if (number.length === 8) {
    variations.push(`+55${ddd}9${number}`);
  }
  if (number.length === 9 && number.startsWith('9')) {
    variations.push(`+55${ddd}${number.slice(1)}`);
  }
  return [...new Set(variations.filter(v => v.length >= 10))];
}

function resolveTargetPipeline(
  empresa: EmpresaTipo,
  tipoLead: TipoLead,
  temperatura: Temperatura,
  isPriority: boolean
): { pipelineId: string; stageId: string } {
  if (empresa === 'BLUE') {
    const pipelineId = '21e577cc-32eb-4f1c-895e-b11bfc056e99';
    const stageMap: Record<Temperatura, string> = {
      'FRIO': '7e6ee75a-8efd-4cc4-8264-534bf77993c7',
      'MORNO': 'bb39da09-d2cb-4111-a662-85c69e057077',
      'QUENTE': 'e7cca7b0-941a-4522-9543-fc0d975b9dac',
    };
    return { pipelineId, stageId: isPriority ? stageMap['QUENTE'] : (stageMap[temperatura] || stageMap['FRIO']) };
  }
  if (tipoLead === 'CAPTADOR') {
    const pipelineId = 'a74d511a-f8b4-4d14-9f5c-0c13da61cb15';
    const stageMap: Record<Temperatura, string> = {
      'FRIO': 'f45b020e-1247-42a1-89e7-bd0caf614a7e',
      'MORNO': 'ece6bc09-c924-4b30-b064-e792f8e44c72',
      'QUENTE': '34aa1201-d14d-46d9-8ce6-108ac811e79f',
    };
    return { pipelineId, stageId: stageMap[temperatura] || stageMap['FRIO'] };
  }
  const pipelineId = '5bbac98b-5ae9-4b31-9b7f-896d7b732a2c';
  const stageMap: Record<Temperatura, string> = {
    'FRIO': 'da80e912-b462-401d-b367-1b6a9b2ec4da',
    'MORNO': '90b33102-0472-459e-8eef-a455b0d37acf',
    'QUENTE': 'c48dc6c2-c5dc-47c1-9f27-c058b01898c3',
  };
  return { pipelineId, stageId: isPriority ? stageMap['QUENTE'] : (stageMap[temperatura] || stageMap['FRIO']) };
}

async function findExistingDealForPerson(
  supabase: SupabaseClient,
  empresa: EmpresaTipo,
  dados: { telefone_e164?: string | null; telefone?: string | null; email?: string | null; cpf?: string | null }
): Promise<{ contactId: string; dealId: string } | null> {
  const extractDeal = (row: Record<string, unknown>): { contactId: string; dealId: string } | null => {
    const deals = row.deals as unknown;
    const dealId = Array.isArray(deals) ? (deals[0] as Record<string, string>)?.id : (deals as Record<string, string>)?.id;
    return dealId ? { contactId: row.id as string, dealId } : null;
  };

  // 1. CPF exato
  if (dados.cpf) {
    const cleaned = dados.cpf.replace(/\D/g, '');
    if (cleaned.length >= 11) {
      const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
        .eq('empresa', empresa).eq('cpf', cleaned).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
      if (data) { const m = extractDeal(data as Record<string, unknown>); if (m) { console.log('[Dedup] Match CPF:', m); return m; } }
    }
  }

  // 2. telefone_e164 exato
  if (dados.telefone_e164) {
    const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
      .eq('empresa', empresa).eq('telefone_e164', dados.telefone_e164).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
    if (data) { const m = extractDeal(data as Record<string, unknown>); if (m) { console.log('[Dedup] Match telefone_e164:', m); return m; } }
  }

  // 3. Variações de telefone
  const phoneVars = generatePhoneVariationsForSearch(dados.telefone || dados.telefone_e164);
  if (phoneVars.length > 0) {
    const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
      .eq('empresa', empresa).in('telefone_e164', phoneVars).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
    if (data) { const m = extractDeal(data as Record<string, unknown>); if (m) { console.log('[Dedup] Match variação tel:', m); return m; } }
  }

  // 4. Email exato (excluindo placeholders)
  if (dados.email && !isPlaceholderEmailForDedup(dados.email)) {
    const { data } = await supabase.from('contacts').select('id, deals!inner(id)')
      .eq('empresa', empresa).eq('email', dados.email.trim().toLowerCase()).eq('deals.status', 'ABERTO').limit(1).maybeSingle();
    if (data) { const m = extractDeal(data as Record<string, unknown>); if (m) { console.log('[Dedup] Match email:', m); return m; } }
  }

  console.log('[Dedup] Nenhuma duplicata encontrada');
  return null;
}


// ========================================
// HORÁRIO COMERCIAL - 09h-18h seg-sex (America/Sao_Paulo)
// ========================================
function getHorarioBrasilia(): Date {
  const now = new Date();
  // Converter para horário de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60; // minutos
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + brasiliaOffset * 60 * 1000);
}

function isHorarioComercial(): boolean {
  const brasilia = getHorarioBrasilia();
  const dia = brasilia.getDay(); // 0=dom, 1=seg, ..., 5=sex, 6=sab
  const hora = brasilia.getHours();
  
  // Seg-Sex (1-5), 09h-18h
  return dia >= 1 && dia <= 5 && hora >= 9 && hora < 18;
}

function proximoHorarioComercial(): Date {
  const brasilia = getHorarioBrasilia();
  const dia = brasilia.getDay();
  const hora = brasilia.getHours();
  
  let diasParaAdicionar = 0;
  
  if (dia >= 1 && dia <= 5 && hora < 9) {
    // Dia útil antes das 9h → hoje às 09:00
    diasParaAdicionar = 0;
  } else if (dia === 5 && hora >= 18) {
    // Sexta após 18h → segunda
    diasParaAdicionar = 3;
  } else if (dia === 6) {
    // Sábado → segunda
    diasParaAdicionar = 2;
  } else if (dia === 0) {
    // Domingo → segunda
    diasParaAdicionar = 1;
  } else if (dia >= 1 && dia <= 4 && hora >= 18) {
    // Seg-Qui após 18h → amanhã
    diasParaAdicionar = 1;
  }
  
  // Construir data em UTC que corresponda a 09:00 Brasília (= 12:00 UTC)
  const resultado = new Date(brasilia);
  resultado.setDate(resultado.getDate() + diasParaAdicionar);
  resultado.setHours(9, 0, 0, 0);
  
  // Converter de volta para UTC: 09:00 BRT = 12:00 UTC
  const utcMs = resultado.getTime() - (-3 * 60) * 60 * 1000;
  return new Date(utcMs);
}

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

// ========================================
// PATCH 5H-PLUS: FUNÇÕES DE SANITIZAÇÃO
// ========================================

/**
 * Normaliza telefone para formato E.164
 */
function normalizePhoneE164(raw: string | null): PhoneNormalized | null {
  if (!raw) return null;
  
  let digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 7) return null;
  
  // Detectar sequências lixo (000000, 111111, 98989898, etc.)
  const uniqueDigits = new Set(digits.split(''));
  if (uniqueDigits.size <= 2) {
    console.log('[Sanitization] Telefone lixo detectado:', raw);
    return null;
  }
  
  // Remove 00 do início se presente (formato internacional antigo)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  
  // Processar DDI brasileiro
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return {
      e164: `+${digits}`,
      ddi: '55',
      nacional: digits.slice(2),
      internacional: false
    };
  }
  
  // Assumir BR se 10-11 dígitos (DDD + número)
  if (digits.length === 10 || digits.length === 11) {
    return {
      e164: `+55${digits}`,
      ddi: '55',
      nacional: digits,
      internacional: false
    };
  }
  
  // Verificar DDIs conhecidos
  for (const ddi of DDI_CONHECIDOS) {
    if (digits.startsWith(ddi) && digits.length > ddi.length + 6) {
      return {
        e164: `+${digits}`,
        ddi,
        nacional: digits.slice(ddi.length),
        internacional: ddi !== '55'
      };
    }
  }
  
  // Se ainda tem tamanho razoável, marca como internacional desconhecido
  if (digits.length >= 10) {
    console.log('[Sanitization] DDI não reconhecido, marcando como suspeito:', raw);
    return null; // Será marcado como DADO_SUSPEITO
  }
  
  return null;
}

/**
 * Detecta se o e-mail é um placeholder
 */
function isPlaceholderEmail(email: string | null): boolean {
  if (!email) return false;
  const lowered = email.trim().toLowerCase();
  
  const placeholders = [
    'sememail@', 'sem-email@', 'noemail@', 'sem@', 'nao-informado@',
    'teste@teste', 'email@email', 'x@x', 'a@a',
    'placeholder', '@exemplo.', '@example.', 'test@test'
  ];
  
  return placeholders.some(p => lowered.includes(p));
}

/**
 * Valida formato básico de e-mail
 */
function isValidEmailFormat(email: string | null): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(trimmed);
}

/**
 * Sanitiza dados de contato do lead
 * 
 * REGRAS DE DESCARTE:
 * - Caso 1: Sem telefone E sem email → DESCARTA
 * - Caso 2: Sem telefone (ou vazio) E email placeholder → DESCARTA
 * - Caso 3: Telefone lixo (presente mas inválido) E email ausente/placeholder → DESCARTA
 * 
 * ISSUES INFORMATIVOS (não descarta):
 * - Email placeholder com telefone válido → MEDIA
 * - Email formato inválido → BAIXA
 * - Telefone com DDI suspeito → BAIXA
 */
function sanitizeLeadContact(input: {
  telefone?: string | null;
  email?: string | null;
  empresa: EmpresaTipo;
}): SanitizationResult {
  const { telefone, email } = input;
  const issues: ContactIssue[] = [];
  let descartarLead = false;
  
  const phoneInfo = normalizePhoneE164(telefone || null);
  const emailPlaceholder = isPlaceholderEmail(email || null);
  const emailValid = isValidEmailFormat(email || null);
  
  // Determina se tem telefone informado (mesmo que lixo)
  const temTelefoneInformado = telefone && telefone.trim() !== '';
  
  // Caso 1: Sem telefone E sem email
  if (!phoneInfo && !email) {
    descartarLead = true;
    issues.push({
      tipo: 'SEM_CANAL_CONTATO',
      severidade: 'ALTA',
      mensagem: 'Lead sem telefone e sem e-mail. Não é possível contatar.'
    });
    return { descartarLead, issues, phoneInfo: null, emailPlaceholder: false };
  }
  
  // Caso 2: Sem telefone (nulo ou vazio) E email placeholder
  // Este é o caso que estava falhando antes!
  if (!phoneInfo && !temTelefoneInformado && emailPlaceholder) {
    descartarLead = true;
    issues.push({
      tipo: 'SEM_CANAL_CONTATO',
      severidade: 'ALTA',
      mensagem: 'Lead sem telefone e com e-mail placeholder. Não é possível contatar.'
    });
    return { descartarLead, issues, phoneInfo: null, emailPlaceholder: true };
  }
  
  // Caso 3: Telefone lixo (informado mas inválido) E email placeholder/inexistente
  if (!phoneInfo && temTelefoneInformado && (!email || emailPlaceholder)) {
    descartarLead = true;
    issues.push({
      tipo: 'TELEFONE_LIXO',
      severidade: 'ALTA',
      mensagem: 'Telefone inválido/lixo e e-mail ausente ou placeholder.'
    });
    if (emailPlaceholder) {
      issues.push({
        tipo: 'EMAIL_PLACEHOLDER',
        severidade: 'MEDIA',
        mensagem: 'E-mail identificado como placeholder.'
      });
    }
    return { descartarLead, issues, phoneInfo: null, emailPlaceholder };
  }
  
  // Caso 4: Email placeholder mas telefone ok (não descarta, apenas registra issue)
  if (emailPlaceholder && phoneInfo) {
    issues.push({
      tipo: 'EMAIL_PLACEHOLDER',
      severidade: 'MEDIA',
      mensagem: 'E-mail identificado como placeholder. Usar telefone como canal principal.'
    });
  }
  
  // Caso 5: Email com formato inválido (mas não é placeholder)
  if (email && !emailPlaceholder && !emailValid) {
    issues.push({
      tipo: 'EMAIL_INVALIDO',
      severidade: 'BAIXA',
      mensagem: 'Formato de e-mail parece inválido. Revisar manualmente.'
    });
  }
  
  // Caso 6: Telefone suspeito (DDI não reconhecido)
  if (temTelefoneInformado && !phoneInfo && telefone!.replace(/\D/g, '').length >= 10) {
    issues.push({
      tipo: 'DADO_SUSPEITO',
      severidade: 'BAIXA',
      mensagem: 'Telefone com DDI não reconhecido. Verificar manualmente.'
    });
  }
  
  return {
    descartarLead,
    issues,
    phoneInfo,
    emailPlaceholder
  };
}

// ========================================
// PATCH 6: PESSOA GLOBAL - FUNÇÕES DE MATCHING
// ========================================

interface PhoneBaseResult {
  base: string | null;      // Últimos 8 dígitos (sem o 9º dígito)
  ddd: string | null;       // DDD (61, 11, etc.)
  e164: string | null;      // Formato E.164 completo
}

/**
 * Extrai os componentes do telefone brasileiro
 * Lida com variações do 9º dígito (celulares brasileiros)
 * 
 * Exemplos:
 * - +5561998317422 → { base: '98317422', ddd: '61', e164: '+5561998317422' }
 * - +556198317422  → { base: '98317422', ddd: '61', e164: '+5561998317422' }
 * - 61998317422    → { base: '98317422', ddd: '61', e164: '+5561998317422' }
 * - 6198317422     → { base: '98317422', ddd: '61', e164: '+5561998317422' }
 */
function extractPhoneBase(phone: string | null): PhoneBaseResult {
  if (!phone) return { base: null, ddd: null, e164: null };
  
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  
  // Remove DDI 55 se presente no início
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  // Precisamos de pelo menos 10 dígitos (DDD + 8 dígitos)
  if (digits.length < 10) {
    console.log('[extractPhoneBase] Telefone muito curto:', phone, '→', digits);
    return { base: null, ddd: null, e164: null };
  }
  
  const ddd = digits.slice(0, 2);
  let number = digits.slice(2);
  
  // Se tem 9 dígitos e começa com 9, remove o 9º dígito para obter a base
  if (number.length === 9 && number.startsWith('9')) {
    const base = number.slice(1); // Remove o 9 do início
    return {
      base,
      ddd,
      e164: `+55${ddd}${number}` // Mantém formato completo com o 9
    };
  }
  
  // Se tem 8 dígitos, usa como base diretamente
  if (number.length === 8) {
    return {
      base: number,
      ddd,
      e164: `+55${ddd}9${number}` // Adiciona o 9 no E.164
    };
  }
  
  console.log('[extractPhoneBase] Formato inesperado:', phone, '→ ddd:', ddd, 'number:', number);
  return { base: null, ddd: null, e164: null };
}

/**
 * Cria ou encontra pessoa global a partir de um lead_contact
 * Usa telefone_base + ddd para matching flexível (ignora 9º dígito)
 * 
 * Ordem de matching:
 * 1. telefone_base + ddd (mais confiável para BR)
 * 2. email (se não for placeholder)
 * 3. Cria nova pessoa se não encontrar
 */
async function upsertPessoaFromContact(
  supabase: SupabaseClient,
  contact: {
    nome?: string | null;
    email?: string | null;
    telefone?: string | null;
    telefone_e164?: string | null;
  }
): Promise<string | null> {
  const phoneData = extractPhoneBase(contact.telefone_e164 ?? contact.telefone ?? null);
  const emailNormalized = contact.email?.toLowerCase().trim() || null;
  const isEmailPlaceholder = isPlaceholderEmail(emailNormalized);
  
  console.log('[Pessoa] Tentando match para:', {
    nome: contact.nome,
    telefone_e164: contact.telefone_e164,
    phoneBase: phoneData.base,
    ddd: phoneData.ddd,
    email: emailNormalized,
    isPlaceholder: isEmailPlaceholder
  });
  
  // 1. Tentar match por telefone_base + ddd (mais confiável)
  if (phoneData.base && phoneData.ddd) {
    const { data: phoneMatch, error: phoneError } = await supabase
      .from('pessoas')
      .select('id, nome')
      .eq('telefone_base', phoneData.base)
      .eq('ddd', phoneData.ddd)
      .maybeSingle();
      
    if (phoneError) {
      console.error('[Pessoa] Erro ao buscar por telefone:', phoneError);
    }
    
    if (phoneMatch) {
      console.log('[Pessoa] Match por telefone_base:', phoneMatch.id, phoneMatch.nome);
      return phoneMatch.id;
    }
  }
  
  // 2. Tentar match por email (se não for placeholder)
  if (emailNormalized && !isEmailPlaceholder) {
    const { data: emailMatch, error: emailError } = await supabase
      .from('pessoas')
      .select('id, nome')
      .eq('email_principal', emailNormalized)
      .maybeSingle();
      
    if (emailError) {
      console.error('[Pessoa] Erro ao buscar por email:', emailError);
    }
    
    if (emailMatch) {
      console.log('[Pessoa] Match por email:', emailMatch.id, emailMatch.nome);
      
      // Se encontrou por email mas não tinha telefone, atualiza o telefone
      if (phoneData.base && phoneData.ddd) {
        await supabase
          .from('pessoas')
          .update({
            telefone_e164: phoneData.e164,
            telefone_base: phoneData.base,
            ddd: phoneData.ddd,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailMatch.id);
        console.log('[Pessoa] Telefone atualizado para pessoa existente:', emailMatch.id);
      }
      
      return emailMatch.id;
    }
  }
  
  // 3. Criar nova pessoa
  const nomeNormalizado = contact.nome?.trim() || 'Desconhecido';
  
  const insertData: Record<string, unknown> = {
    nome: nomeNormalizado,
    idioma_preferido: 'PT'
  };
  
  if (phoneData.base && phoneData.ddd) {
    insertData.telefone_e164 = phoneData.e164;
    insertData.telefone_base = phoneData.base;
    insertData.ddd = phoneData.ddd;
  }
  
  if (emailNormalized && !isEmailPlaceholder) {
    insertData.email_principal = emailNormalized;
  }
  
  const { data: newPessoa, error: insertError } = await supabase
    .from('pessoas')
    .insert(insertData)
    .select('id')
    .single();
    
  if (insertError) {
    // Pode ser conflito de unique constraint - tenta buscar novamente
    console.error('[Pessoa] Erro ao criar (pode ser race condition):', insertError);
    
    // Retry: busca novamente por telefone ou email
    if (phoneData.base && phoneData.ddd) {
      const { data: retryMatch } = await supabase
        .from('pessoas')
        .select('id')
        .eq('telefone_base', phoneData.base)
        .eq('ddd', phoneData.ddd)
        .maybeSingle();
      if (retryMatch) return retryMatch.id;
    }
    
    if (emailNormalized && !isEmailPlaceholder) {
      const { data: retryMatch } = await supabase
        .from('pessoas')
        .select('id')
        .eq('email_principal', emailNormalized)
        .maybeSingle();
      if (retryMatch) return retryMatch.id;
    }
    
    return null;
  }
  
  console.log('[Pessoa] Nova pessoa criada:', newPessoa.id, nomeNormalizado);
  return newPessoa.id;
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
function validateWebhookToken(req: Request): boolean {
  const secret = Deno.env.get('SGT_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[SGT Webhook] SGT_WEBHOOK_SECRET não configurado');
    return false;
  }

  // 1. Prioridade: x-webhook-secret (não é interceptado pelo platform)
  const webhookSecret = req.headers.get('x-webhook-secret');
  if (webhookSecret) {
    console.log('[SGT Webhook] Autenticando via x-webhook-secret');
    return webhookSecret === secret;
  }

  // 2. Fallback: Authorization Bearer (pode ser interceptado pelo Lovable Cloud)
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      console.log('[SGT Webhook] Autenticando via Authorization Bearer (fallback)');
      return match[1] === secret;
    }
  }

  console.error('[SGT Webhook] Nenhum token de autenticação encontrado (x-webhook-secret ou Authorization)');
  return false;
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
function classificarTokeniza(lead: LeadNormalizado): { icp: IcpTokeniza; persona: PersonaTokeniza | null; razao: string } {
  const dados = lead.dados_empresa as DadosTokeniza | null;
  const valorInvestido = dados?.valor_investido ?? 0;
  const qtdInvestimentos = dados?.qtd_investimentos ?? 0;
  const qtdProjetos = dados?.qtd_projetos ?? 0;
  const carrinhoAbandonado = dados?.carrinho_abandonado ?? false;
  const valorCarrinho = dados?.valor_carrinho ?? 0;

  // Carrinho abandonado com valor alto → Prioridade máxima
  if (carrinhoAbandonado && valorCarrinho >= 5000) {
    return { 
      icp: 'TOKENIZA_SERIAL', 
      persona: 'CONSTRUTOR_PATRIMONIO',
      razao: `Carrinho abandonado com valor alto (R$ ${valorCarrinho.toLocaleString('pt-BR')}). Lead prioritário para recuperação.`
    };
  }

  // TOKENIZA_SERIAL
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

  // TOKENIZA_ALTO_VOLUME_DIGITAL
  if (lead.metadata?.tipo_compra && valorInvestido >= 10000) {
    return { 
      icp: 'TOKENIZA_ALTO_VOLUME_DIGITAL', 
      persona: 'COLECIONADOR_DIGITAL',
      razao: `Perfil de compra digital identificado com R$ ${valorInvestido.toLocaleString('pt-BR')} investidos.`
    };
  }

  // TOKENIZA_MEDIO_PRAZO
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

  // TOKENIZA_EMERGENTE
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

function classificarBlue(lead: LeadNormalizado): { icp: IcpBlue; persona: PersonaBlue | null; razao: string } {
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
    const motivos: string[] = [];
    if (ticketMedio >= 4000) motivos.push(`ticket médio de R$ ${ticketMedio.toLocaleString('pt-BR')} (≥ R$ 4.000)`);
    if (mauticScore >= 30 && (stage === 'Negociação' || stage === 'Cliente')) motivos.push(`score ${mauticScore} no Mautic em stage ${stage}`);
    if (pageHits >= 20 && emailClicks >= 5) motivos.push(`alto engajamento (${pageHits} page hits, ${emailClicks} cliques em email)`);
    return { 
      icp: 'BLUE_ALTO_TICKET_IR', 
      persona: 'CRIPTO_CONTRIBUINTE_URGENTE',
      razao: `Cliente de alto valor para IR: ${motivos.join(', ')}.`
    };
  }

  // BLUE_RECURRENTE
  if (qtdComprasIr >= 2) {
    return { 
      icp: 'BLUE_RECURRENTE', 
      persona: 'CLIENTE_FIEL_RENOVADOR',
      razao: `Cliente recorrente com ${qtdComprasIr} compras de serviço IR.`
    };
  }

  // BLUE_PERDIDO_RECUPERAVEL - Considera engajamento recente
  if (stage === 'Perdido' && (mauticScore >= 20 || pageHits >= 5)) {
    const motivos: string[] = [`stage ${stage}`];
    if (mauticScore >= 20) motivos.push(`score ${mauticScore} no Mautic`);
    if (pageHits >= 5) motivos.push(`${pageHits} page hits recentes`);
    return { 
      icp: 'BLUE_PERDIDO_RECUPERAVEL', 
      persona: 'LEAD_PERDIDO_RECUPERAVEL',
      razao: `Lead perdido com sinais de reengajamento: ${motivos.join(', ')}.`
    };
  }

  return { 
    icp: 'BLUE_NAO_CLASSIFICADO', 
    persona: null,
    razao: 'Dados insuficientes para classificação. Lead precisa de mais interações ou dados de compra.'
  };
}

function calcularTemperatura(lead: LeadNormalizado, icp: ICP): { temperatura: Temperatura; razao: string } {
  const evento = lead.evento;
  const stage = lead.stage;
  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const carrinhoAbandonado = (lead.dados_empresa as DadosTokeniza)?.carrinho_abandonado ?? false;

  // Carrinho abandonado = QUENTE
  if (carrinhoAbandonado) {
    return { temperatura: 'QUENTE', razao: 'Carrinho abandonado indica alta intenção de compra.' };
  }

  // Eventos quentes sempre aumentam temperatura
  if (EVENTOS_QUENTES.includes(evento)) {
    return { temperatura: 'QUENTE', razao: `Evento ${evento} indica lead com alta intenção.` };
  }

  // Stage de negociação/cliente indica alta intenção
  if (stage === 'Negociação' || stage === 'Cliente') {
    return { temperatura: 'QUENTE', razao: `Stage "${stage}" indica lead em fase avançada do funil.` };
  }

  // Alto engajamento no Mautic
  if (pageHits >= 15) {
    return { temperatura: 'QUENTE', razao: `Alto engajamento com ${pageHits} page hits no site.` };
  }

  // ICPs de alto valor tendem a ser mais quentes
  if (icp === 'TOKENIZA_SERIAL' || icp === 'BLUE_ALTO_TICKET_IR') {
    if (evento === 'LEAD_NOVO') {
      return { temperatura: 'MORNO', razao: `ICP de alto valor (${icp}) com evento de entrada.` };
    }
    return { temperatura: 'QUENTE', razao: `ICP de alto valor (${icp}) com engajamento adicional.` };
  }

  // Leads perdidos são mornos se tiverem engajamento
  if (icp === 'BLUE_PERDIDO_RECUPERAVEL') {
    return { temperatura: 'MORNO', razao: 'Lead perdido demonstrando sinais de reengajamento.' };
  }

  // ICPs médios
  if (icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE' || icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL') {
    return { temperatura: 'MORNO', razao: `ICP de médio valor (${icp}).` };
  }

  // Engajamento moderado no Mautic
  if (pageHits >= 5) {
    return { temperatura: 'MORNO', razao: `Engajamento moderado com ${pageHits} page hits.` };
  }

  // Default para leads novos ou emergentes
  if (evento === 'LEAD_NOVO' || evento === 'ATUALIZACAO') {
    if (icp.includes('NAO_CLASSIFICADO')) {
      return { temperatura: 'FRIO', razao: 'Lead novo sem classificação definida. Aguardando mais dados.' };
    }
    return { temperatura: 'MORNO', razao: `Lead ${evento === 'LEAD_NOVO' ? 'novo' : 'atualizado'} com ICP definido.` };
  }

  return { temperatura: 'FRIO', razao: 'Sem sinais claros de engajamento ou intenção.' };
}

function calcularPrioridade(icp: ICP, temperatura: Temperatura): { prioridade: Prioridade; razao: string } {
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

interface ScoreBreakdown {
  base_temperatura: number;
  bonus_icp: number;
  bonus_evento: number;
  bonus_score_externo: number;
  bonus_mautic: number;
  bonus_chatwoot: number;
  bonus_carrinho: number;
  bonus_lead_pago: number;
  ajuste_prioridade: number;
  total: number;
}

function calcularScoreInterno(lead: LeadNormalizado, icp: ICP, temperatura: Temperatura, prioridade: Prioridade): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    base_temperatura: 0,
    bonus_icp: 0,
    bonus_evento: 0,
    bonus_score_externo: 0,
    bonus_mautic: 0,
    bonus_chatwoot: 0,
    bonus_carrinho: 0,
    bonus_lead_pago: 0,
    ajuste_prioridade: 0,
    total: 0,
  };

  // Base por temperatura
  if (temperatura === 'QUENTE') breakdown.base_temperatura = 40;
  else if (temperatura === 'MORNO') breakdown.base_temperatura = 25;
  else breakdown.base_temperatura = 10;

  // Bonus por ICP
  if (icp === 'TOKENIZA_SERIAL' || icp === 'BLUE_ALTO_TICKET_IR') breakdown.bonus_icp = 30;
  else if (icp === 'TOKENIZA_MEDIO_PRAZO' || icp === 'BLUE_RECURRENTE') breakdown.bonus_icp = 20;
  else if (icp === 'TOKENIZA_ALTO_VOLUME_DIGITAL') breakdown.bonus_icp = 25;
  else if (!icp.includes('NAO_CLASSIFICADO')) breakdown.bonus_icp = 10;

  // Bonus por evento
  if (EVENTOS_QUENTES.includes(lead.evento)) breakdown.bonus_evento = 15;

  // Bonus por score externo
  breakdown.bonus_score_externo = Math.min(Math.round(lead.score * 0.1), 10);

  // Bonus por engajamento Mautic
  const pageHits = lead.dados_mautic?.page_hits ?? 0;
  const emailClicks = lead.dados_mautic?.email_clicks ?? 0;
  breakdown.bonus_mautic = Math.min(Math.round(pageHits * 0.5) + Math.min(emailClicks, 5), 15);

  // Bonus por conversas Chatwoot
  const mensagensTotal = lead.dados_chatwoot?.mensagens_total ?? 0;
  breakdown.bonus_chatwoot = Math.min(Math.round(mensagensTotal * 0.5), 5);

  // Bonus por carrinho abandonado
  const carrinhoAbandonado = (lead.dados_empresa as DadosTokeniza)?.carrinho_abandonado ?? false;
  if (carrinhoAbandonado) breakdown.bonus_carrinho = 15;

  // Bonus por lead pago
  if (lead.lead_pago) breakdown.bonus_lead_pago = 5;

  // Ajuste por prioridade (inverso)
  breakdown.ajuste_prioridade = (4 - prioridade) * 5;

  // Calcular total
  breakdown.total = Math.min(
    breakdown.base_temperatura +
    breakdown.bonus_icp +
    breakdown.bonus_evento +
    breakdown.bonus_score_externo +
    breakdown.bonus_mautic +
    breakdown.bonus_chatwoot +
    breakdown.bonus_carrinho +
    breakdown.bonus_lead_pago +
    breakdown.ajuste_prioridade,
    100
  );

  return breakdown;
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
  let icpRazao: string;

  if (lead.empresa === 'TOKENIZA') {
    const result = classificarTokeniza(lead);
    icp = result.icp;
    persona = result.persona;
    icpRazao = result.razao;
  } else {
    const result = classificarBlue(lead);
    icp = result.icp;
    persona = result.persona;
    icpRazao = result.razao;
  }

  const temperaturaResult = calcularTemperatura(lead, icp);
  const prioridadeResult = calcularPrioridade(icp, temperaturaResult.temperatura);
  const scoreBreakdown = calcularScoreInterno(lead, icp, temperaturaResult.temperatura, prioridadeResult.prioridade);

  // Construir dados utilizados para justificativa
  const dadosTokeniza = lead.dados_empresa as DadosTokeniza | null;
  const dadosBlue = lead.dados_empresa as DadosBlue | null;
  
  const dadosUtilizados = {
    evento: lead.evento,
    stage: lead.stage,
    score_externo: lead.score,
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
    leadId: lead.lead_id,
    empresa: lead.empresa,
    icp,
    persona,
    temperatura: temperaturaResult.temperatura,
    prioridade: prioridadeResult.prioridade,
    scoreInterno: scoreBreakdown.total,
  };

  console.log('[Classificação] Resultado:', classification);

  // Calcular score_composto: (score_interno * 0.6) + (min(score_marketing, 100) * 0.4)
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
      lead_id: lead.lead_id,
      empresa: lead.empresa,
      icp: icp,
      persona: persona,
      temperatura: temperaturaResult.temperatura,
      prioridade: prioridadeResult.prioridade,
      score_interno: scoreBreakdown.total,
      score_composto: scoreComposto,
      fonte_evento_id: eventId,
      fonte_evento_tipo: lead.evento,
      classificado_em: new Date().toISOString(),
      justificativa: justificativa,
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
    mensagem: `Lead classificado: ICP=${icp}, Temperatura=${temperaturaResult.temperatura}, Prioridade=${prioridadeResult.prioridade}`,
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

  // VALIDAÇÃO EXTRA: Verificar se o lead tem canal de contato válido antes de iniciar
  const { data: leadContact, error: contactError } = await supabase
    .from('lead_contacts')
    .select('telefone, telefone_valido, telefone_e164, email, email_placeholder')
    .eq('lead_id', leadId)
    .eq('empresa', empresa)
    .maybeSingle();

  if (contactError) {
    console.error('[Cadência] Erro ao buscar lead_contact:', contactError);
  }

  if (leadContact) {
    const temTelefoneValido = leadContact.telefone_valido && leadContact.telefone_e164;
    const temEmailValido = leadContact.email && !leadContact.email_placeholder;
    
    if (!temTelefoneValido && !temEmailValido) {
      console.log('[Cadência] Lead sem canal de contato válido, não iniciando cadência:', {
        leadId,
        telefone: leadContact.telefone,
        telefone_valido: leadContact.telefone_valido,
        email: leadContact.email,
        email_placeholder: leadContact.email_placeholder
      });
      return { 
        success: false, 
        skipped: true, 
        reason: 'Lead sem canal de contato válido (telefone inválido e email placeholder/ausente)' 
      };
    }
  }

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
  let nextRunAt = new Date(now.getTime() + firstStep.offset_minutos * 60 * 1000);
  
  // Verificar horário comercial: se fora de horário, agendar para próximo horário válido
  if (!isHorarioComercial()) {
    const proximoHorario = proximoHorarioComercial();
    // Usar o maior entre offset calculado e próximo horário comercial
    if (proximoHorario.getTime() > nextRunAt.getTime()) {
      nextRunAt = proximoHorario;
    }
    console.log('[Cadência] Fora de horário comercial, agendando para:', nextRunAt.toISOString());
  }

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
    const bodyText = await req.text();
    
    console.log('[SGT Webhook] Requisição recebida:', {
      hasWebhookSecret: !!req.headers.get('x-webhook-secret'),
      hasAuth: !!req.headers.get('authorization'),
      bodyLength: bodyText.length,
    });

    const isValidToken = validateWebhookToken(req);
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
    
    // Build upsert data with new fields (score_marketing, prioridade_marketing, LinkedIn, Mautic extras, Chatwoot extras)
    const leadContactUpsert: Record<string, unknown> = {
      lead_id: payload.lead_id,
      empresa: payload.empresa,
      nome: leadNormalizado.nome,
      email: leadNormalizado.email,
      telefone: leadNormalizado.telefone,
      primeiro_nome: primeiroNome,
      pipedrive_deal_id: pipedriveDealeId,
    };

    // Score de marketing do SGT
    if (payload.score_temperatura !== undefined) {
      leadContactUpsert.score_marketing = payload.score_temperatura;
    }
    if (payload.prioridade) {
      leadContactUpsert.prioridade_marketing = payload.prioridade;
    }

    // LinkedIn
    if (payload.dados_linkedin) {
      if (payload.dados_linkedin.url) leadContactUpsert.linkedin_url = payload.dados_linkedin.url;
      if (payload.dados_linkedin.cargo) leadContactUpsert.linkedin_cargo = payload.dados_linkedin.cargo;
      if (payload.dados_linkedin.empresa) leadContactUpsert.linkedin_empresa = payload.dados_linkedin.empresa;
      if (payload.dados_linkedin.setor) leadContactUpsert.linkedin_setor = payload.dados_linkedin.setor;
      if (payload.dados_linkedin.senioridade) leadContactUpsert.linkedin_senioridade = payload.dados_linkedin.senioridade;
      if (payload.dados_linkedin.conexoes !== undefined) leadContactUpsert.linkedin_conexoes = payload.dados_linkedin.conexoes;
    }

    // Mautic extras
    if (payload.dados_mautic) {
      if (payload.dados_mautic.first_visit) leadContactUpsert.mautic_first_visit = payload.dados_mautic.first_visit;
      if (payload.dados_mautic.cidade) leadContactUpsert.mautic_cidade = payload.dados_mautic.cidade;
      if (payload.dados_mautic.estado) leadContactUpsert.mautic_estado = payload.dados_mautic.estado;
    }

    // Chatwoot extras
    if (payload.dados_chatwoot) {
      if (payload.dados_chatwoot.conversas_total !== undefined) leadContactUpsert.chatwoot_conversas_total = payload.dados_chatwoot.conversas_total;
      if (payload.dados_chatwoot.tempo_resposta_medio !== undefined) leadContactUpsert.chatwoot_tempo_resposta_medio = payload.dados_chatwoot.tempo_resposta_medio;
      if (payload.dados_chatwoot.agente_atual) leadContactUpsert.chatwoot_agente_atual = payload.dados_chatwoot.agente_atual;
      if (payload.dados_chatwoot.inbox) leadContactUpsert.chatwoot_inbox = payload.dados_chatwoot.inbox;
      if (payload.dados_chatwoot.status_atendimento) leadContactUpsert.chatwoot_status_atendimento = payload.dados_chatwoot.status_atendimento;
    }

    await supabase.from('lead_contacts').upsert(leadContactUpsert, {
      onConflict: 'lead_id,empresa',
    });
    console.log('[SGT Webhook] Lead contact upserted com dados enriquecidos:', payload.lead_id);

    // PATCH 5H-PLUS: Sanitização de dados de contato
    const sanitization = sanitizeLeadContact({
      telefone: leadNormalizado.telefone,
      email: leadNormalizado.email,
      empresa: payload.empresa
    });
    console.log('[SGT Webhook] Sanitização:', {
      leadId: payload.lead_id,
      phoneInfo: sanitization.phoneInfo,
      emailPlaceholder: sanitization.emailPlaceholder,
      issuesCount: sanitization.issues.length,
      descartarLead: sanitization.descartarLead
    });

    // Atualizar lead_contacts com dados normalizados
    const updateData: Record<string, unknown> = {
      telefone_valido: !!sanitization.phoneInfo,
      telefone_validado_em: new Date().toISOString(),
      email_placeholder: sanitization.emailPlaceholder
    };
    
    if (sanitization.phoneInfo) {
      updateData.telefone_e164 = sanitization.phoneInfo.e164;
      updateData.ddi = sanitization.phoneInfo.ddi;
      updateData.numero_nacional = sanitization.phoneInfo.nacional;
      updateData.contato_internacional = sanitization.phoneInfo.internacional;
      updateData.origem_telefone = 'SGT';
    }

    // PATCH 6: Upsert pessoa global e vincular ao lead_contact
    const pessoaId = await upsertPessoaFromContact(supabase, {
      nome: leadNormalizado.nome,
      email: leadNormalizado.email,
      telefone: leadNormalizado.telefone,
      telefone_e164: sanitization.phoneInfo?.e164
    });
    
    if (pessoaId) {
      updateData.pessoa_id = pessoaId;
      console.log('[SGT Webhook] Lead vinculado à pessoa global:', pessoaId);
    }
    
    await supabase
      .from('lead_contacts')
      .update(updateData)
      .eq('lead_id', payload.lead_id)
      .eq('empresa', payload.empresa);

    // ========================================
    // AUTO-CRIAÇÃO / MERGE DE CONTATO CRM
    // ========================================
    if (pessoaId) {
      try {
        // Verificar se já existe contact para essa pessoa + empresa
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, nome, email, telefone')
          .eq('pessoa_id', pessoaId)
          .eq('empresa', payload.empresa)
          .maybeSingle();

        if (!existingContact) {
          // Criar novo contact CRM
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              pessoa_id: pessoaId,
              empresa: payload.empresa,
              nome: leadNormalizado.nome,
              primeiro_nome: primeiroNome,
              email: leadNormalizado.email || null,
              telefone: sanitization.phoneInfo?.e164 || leadNormalizado.telefone || null,
              canal_origem: 'SGT',
              tipo: 'LEAD',
              tags: ['sgt-inbound'],
              legacy_lead_id: payload.lead_id,
              is_active: true,
              is_cliente: false,
            })
            .select('id')
            .single();

          if (contactError) {
            console.error('[SGT Webhook] Erro ao criar contact CRM:', contactError);
          } else {
            console.log('[SGT Webhook] Contact CRM criado:', newContact.id);
          }
        } else {
          // Merge: atualizar campos nulos sem sobrescrever dados manuais
          const mergeData: Record<string, unknown> = {};
          if (!existingContact.email && leadNormalizado.email) {
            mergeData.email = leadNormalizado.email;
          }
          if (!existingContact.telefone && (sanitization.phoneInfo?.e164 || leadNormalizado.telefone)) {
            mergeData.telefone = sanitization.phoneInfo?.e164 || leadNormalizado.telefone;
          }

          if (Object.keys(mergeData).length > 0) {
            mergeData.updated_at = new Date().toISOString();
            await supabase
              .from('contacts')
              .update(mergeData)
              .eq('id', existingContact.id);
            console.log('[SGT Webhook] Contact CRM atualizado (merge):', existingContact.id, Object.keys(mergeData));
          } else {
            console.log('[SGT Webhook] Contact CRM já existe, sem campos para merge:', existingContact.id);
          }
        }
      } catch (contactErr) {
        console.error('[SGT Webhook] Erro no fluxo de contacts:', contactErr);
        // Não interrompe o fluxo principal
      }
    }

    // Registrar issues de contato (evitar duplicatas)
    if (sanitization.issues.length > 0) {
      for (const issue of sanitization.issues) {
        // Verificar se já existe issue pendente do mesmo tipo
        const { data: existingIssue } = await supabase
          .from('lead_contact_issues')
          .select('id')
          .eq('lead_id', payload.lead_id)
          .eq('empresa', payload.empresa)
          .eq('issue_tipo', issue.tipo)
          .eq('resolvido', false)
          .maybeSingle();
        
        if (!existingIssue) {
          await supabase.from('lead_contact_issues').insert({
            lead_id: payload.lead_id,
            empresa: payload.empresa,
            issue_tipo: issue.tipo,
            severidade: issue.severidade,
            mensagem: issue.mensagem
          });
          console.log('[SGT Webhook] Issue de contato registrada:', issue.tipo);
        } else {
          console.log('[SGT Webhook] Issue já existe, ignorando duplicata:', issue.tipo);
        }
      }
    }

    // Se lead deve ser descartado, deletar dados e não prosseguir
    if (sanitization.descartarLead) {
      console.log('[SGT Webhook] Lead descartado - deletando dados:', payload.lead_id);
      
      // Deletar dados relacionados ao lead (cascade)
      await supabase.from('lead_message_intents').delete().eq('lead_id', payload.lead_id);
      await supabase.from('lead_messages').delete().eq('lead_id', payload.lead_id);
      await supabase.from('lead_conversation_state').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      await supabase.from('lead_classifications').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      await supabase.from('lead_cadence_events').delete().in('lead_cadence_run_id', 
        (await supabase.from('lead_cadence_runs').select('id').eq('lead_id', payload.lead_id).eq('empresa', payload.empresa)).data?.map(r => r.id) || []
      );
      await supabase.from('lead_cadence_runs').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      
      // Manter lead_contact_issues para auditoria, mas deletar o lead_contact
      await supabase.from('lead_contacts').delete().eq('lead_id', payload.lead_id).eq('empresa', payload.empresa);
      
      await supabase
        .from('sgt_events')
        .update({ processado_em: new Date().toISOString() })
        .eq('id', newEvent.id);
      
      console.log('[SGT Webhook] Lead e dados relacionados deletados:', payload.lead_id);
      
      return new Response(
        JSON.stringify({
          success: true,
          event_id: newEvent.id,
          lead_id: payload.lead_id,
          evento: payload.evento,
          empresa: payload.empresa,
          discarded: true,
          deleted: true,
          reason: 'LEAD_SEM_CANAL_CONTATO_VALIDO',
          issues: sanitization.issues.map(i => i.mensagem)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // VERIFICAR MODO DE ATENDIMENTO
    // ========================================
    const { data: convState } = await supabase
      .from('lead_conversation_state')
      .select('id, modo')
      .eq('lead_id', payload.lead_id)
      .eq('empresa', payload.empresa)
      .maybeSingle();

    if (convState?.modo === 'MANUAL') {
      console.log('[SGT Webhook] Lead em modo MANUAL, apenas enriquecendo dados');
      
      await supabase.from('sgt_event_logs').insert({
        event_id: newEvent.id,
        status: 'PROCESSADO',
        mensagem: 'Lead em atendimento manual - dados enriquecidos sem iniciar automação'
      } as Record<string, unknown>);
      
      await supabase
        .from('sgt_events')
        .update({ processado_em: new Date().toISOString() })
        .eq('id', newEvent.id);

      return new Response(
        JSON.stringify({
          success: true,
          event_id: newEvent.id,
          lead_id: payload.lead_id,
          evento: payload.evento,
          empresa: payload.empresa,
          enriched_only: true,
          reason: 'LEAD_EM_ATENDIMENTO_MANUAL',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar estado conversacional se não existe
    if (!convState) {
      console.log('[SGT Webhook] Criando conversation_state para lead:', payload.lead_id);
      const defaultFramework = payload.empresa === 'TOKENIZA' ? 'GPCT' : 'SPIN';
      
      await supabase.from('lead_conversation_state').insert({
        lead_id: payload.lead_id,
        empresa: payload.empresa,
        canal: 'WHATSAPP',
        estado_funil: 'SAUDACAO',
        framework_ativo: defaultFramework,
        modo: 'SDR_IA',
        idioma_preferido: 'PT',
        ultimo_contato_em: new Date().toISOString(),
      } as Record<string, unknown>);
    }

    let classification: LeadClassificationResult | null = null;
    let cadenceResult: { cadenceCodigo: string | null; runId?: string; skipped?: boolean } = { cadenceCodigo: null };

    try {
      classification = await classificarLead(supabase, newEvent.id, leadNormalizado);
      
      // ========================================
      // AUTO-CRIAÇÃO DE DEAL
      // ========================================
      try {
        // Buscar contact com dados completos para dedup
        const { data: contactForDeal } = await supabase
          .from('contacts')
          .select('id, telefone_e164, email, cpf')
          .eq('legacy_lead_id', payload.lead_id)
          .eq('empresa', payload.empresa)
          .maybeSingle();

        if (contactForDeal) {
          const tipoLead: TipoLead = (payload.dados_lead as Record<string, unknown>)?.tipo_lead as TipoLead || (payload as Record<string, unknown>).tipo_lead as TipoLead || 'INVESTIDOR';
          const temperatura = classification?.temperatura || 'FRIO';
          const isPriority = 
            payload.dados_lead.stage === 'Atacar agora!' ||
            !!payload.dados_lead.data_levantou_mao ||
            payload.prioridade === 'URGENTE';

          // Detecção de duplicatas multi-critério
          const duplicateMatch = await findExistingDealForPerson(supabase, payload.empresa, {
            telefone_e164: contactForDeal.telefone_e164,
            telefone: leadNormalizado.telefone,
            email: leadNormalizado.email,
            cpf: contactForDeal.cpf,
          });

          if (duplicateMatch) {
            console.log('[SGT Webhook] Duplicata detectada:', duplicateMatch);
            // Enriquecer contact existente
            const enrichUpdates: Record<string, unknown> = {};
            if (leadNormalizado.email && !contactForDeal.email) enrichUpdates.email = leadNormalizado.email;
            if (Object.keys(enrichUpdates).length > 0) {
              await supabase.from('contacts').update(enrichUpdates).eq('id', duplicateMatch.contactId);
              console.log('[SGT Webhook] Contact enriquecido:', enrichUpdates);
            }
            await supabase.from('sgt_event_logs').insert({
              event_id: newEvent.id,
              status: 'PROCESSADO',
              mensagem: `Duplicata detectada: deal ${duplicateMatch.dealId} já existe para contact ${duplicateMatch.contactId}`,
            } as Record<string, unknown>);
          } else {
            // Roteamento inteligente
            const routing = resolveTargetPipeline(payload.empresa, tipoLead, temperatura, isPriority);
            console.log('[SGT Webhook] Roteamento:', { ...routing, empresa: payload.empresa, tipoLead, temperatura, isPriority });

            const dealTitulo = `${leadNormalizado.nome} — Inbound SGT`;
            const { data: newDeal, error: dealError } = await supabase
              .from('deals')
              .insert({
                contact_id: contactForDeal.id,
                pipeline_id: routing.pipelineId,
                stage_id: routing.stageId,
                titulo: dealTitulo,
                valor: 0,
                moeda: 'BRL',
                temperatura,
                status: 'ABERTO',
                origem: 'SGT',
                utm_source: leadNormalizado.utm_source,
                utm_medium: leadNormalizado.utm_medium,
                utm_campaign: leadNormalizado.utm_campaign,
                utm_content: leadNormalizado.utm_content,
                utm_term: leadNormalizado.utm_term,
              } as Record<string, unknown>)
              .select('id')
              .single();

            if (dealError) {
              console.error('[SGT Webhook] Erro ao criar deal:', dealError);
            } else {
              console.log('[SGT Webhook] Deal criado:', newDeal.id, '| Pipeline:', routing.pipelineId, '| Temp:', temperatura);

              await supabase.from('deal_activities').insert({
                deal_id: newDeal.id,
                tipo: 'CRIACAO',
                descricao: `Deal criado via SGT (${isPriority ? 'PRIORIDADE' : temperatura}) → ${payload.empresa}${tipoLead !== 'INVESTIDOR' ? ` [${tipoLead}]` : ''}`,
                metadata: {
                  origem: 'SGT', temperatura, is_priority: isPriority,
                  lead_id: payload.lead_id, evento: payload.evento,
                  tipo_lead: tipoLead, pipeline_id: routing.pipelineId,
                },
              } as Record<string, unknown>);

              if (isPriority || temperatura === 'QUENTE') {
                // Find admins/closers to notify (BUG 5 fix: notifications need user_id)
                const { data: adminRoles } = await supabase
                  .from('user_roles')
                  .select('user_id')
                  .in('role', ['ADMIN', 'CLOSER'])
                  .limit(10);
                for (const admin of adminRoles ?? []) {
                  await supabase.from('notifications').insert({
                    user_id: admin.user_id,
                    tipo: 'DEAL_NOVO_PRIORITARIO',
                    titulo: isPriority ? '🔥 Lead pediu atendimento urgente!' : '🔥 Lead QUENTE entrou no pipeline!',
                    mensagem: `${leadNormalizado.nome} — ${payload.empresa}`,
                    empresa: payload.empresa,
                    link: `/pipeline?deal=${newDeal.id}`,
                    entity_id: newDeal.id,
                    entity_type: 'deal',
                    metadata: { deal_id: newDeal.id, temperatura, lead_id: payload.lead_id },
                  } as Record<string, unknown>);
                }
              }

              if (temperatura === 'FRIO' && convState?.modo !== 'MANUAL') {
                const warmingCode = payload.empresa === 'BLUE' 
                  ? 'WARMING_INBOUND_FRIO_BLUE' 
                  : 'WARMING_INBOUND_FRIO_TOKENIZA';
                const { data: warmingCadence } = await supabase
                  .from('cadences').select('id').eq('codigo', warmingCode).eq('ativo', true).maybeSingle();
                if (warmingCadence) {
                  const { data: warmingRun } = await supabase
                    .from('lead_cadence_runs')
                    .insert({
                      cadence_id: warmingCadence.id, lead_id: payload.lead_id,
                      empresa: payload.empresa, status: 'ATIVA',
                      last_step_ordem: 0, next_step_ordem: 1,
                      next_run_at: new Date().toISOString(),
                    } as Record<string, unknown>)
                    .select('id').single();
                  if (warmingRun) {
                    await supabase.from('deal_cadence_runs').insert({
                      deal_id: newDeal.id, cadence_run_id: warmingRun.id,
                      trigger_stage_id: routing.stageId, trigger_type: 'AUTO_WARMING', status: 'ACTIVE',
                    } as Record<string, unknown>);
                    console.log('[SGT Webhook] Cadência de aquecimento iniciada:', warmingRun.id);
                  }
                }
              }
            }
          }
        }
      } catch (dealErr) {
        console.error('[SGT Webhook] Erro no fluxo de auto-criação de deal:', dealErr);
      }

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
