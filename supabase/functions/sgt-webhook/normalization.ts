// ========================================
// sgt-webhook/normalization.ts — Normalização e sanitização
// Extraído do index.ts (Fase D)
// ========================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhoneE164 } from "../_shared/phone-utils.ts";
import { isPlaceholderEmailForDedup as isPlaceholderEmail } from "../_shared/phone-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { cleanContactName } from "../_shared/name-sanitizer.ts";
import type {
  EmpresaTipo, LeadStage, SGTPayload, LeadNormalizado,
  DadosTokeniza, DadosBlue, DadosMautic, DadosChatwoot, DadosNotion,
  SanitizationResult, ContactIssue,
} from "./types.ts";
import { LEAD_STAGES_VALIDOS } from "./types.ts";

const log = createLogger('sgt-webhook/normalization');

// ========================================
// NORMALIZAÇÃO DE STAGE
// ========================================
export function normalizeStage(stage: string | undefined): LeadStage | null {
  if (!stage) return null;
  const trimmed = stage.trim();
  
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
  
  if (LEAD_STAGES_VALIDOS.includes(trimmed)) {
    return trimmed as LeadStage;
  }
  
  return null;
}

// ========================================
// SANITIZAÇÃO DE E-MAIL
// ========================================
function isPlaceholderEmailLocal(email: string | null): boolean {
  if (!email) return false;
  const lowered = email.trim().toLowerCase();
  
  const placeholders = [
    'sememail@', 'sem-email@', 'noemail@', 'sem@', 'nao-informado@',
    'teste@teste', 'email@email', 'x@x', 'a@a',
    'placeholder', '@exemplo.', '@example.', 'test@test'
  ];
  
  return placeholders.some(p => lowered.includes(p));
}

function isValidEmailFormat(email: string | null): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return re.test(trimmed);
}

// ========================================
// SANITIZAÇÃO DE CONTATO
// ========================================
export function sanitizeLeadContact(input: {
  telefone?: string | null;
  email?: string | null;
  empresa: EmpresaTipo;
}): SanitizationResult {
  const { telefone, email } = input;
  const issues: ContactIssue[] = [];
  let descartarLead = false;
  
  const phoneInfo = normalizePhoneE164(telefone || null);
  const emailPlaceholder = isPlaceholderEmailLocal(email || null);
  const emailValid = isValidEmailFormat(email || null);
  
  const temTelefoneInformado = telefone && telefone.trim() !== '';
  
  if (!phoneInfo && !email) {
    descartarLead = true;
    issues.push({ tipo: 'SEM_CANAL_CONTATO', severidade: 'ALTA', mensagem: 'Lead sem telefone e sem e-mail. Não é possível contatar.' });
    return { descartarLead, issues, phoneInfo: null, emailPlaceholder: false };
  }
  
  if (!phoneInfo && !temTelefoneInformado && emailPlaceholder) {
    descartarLead = true;
    issues.push({ tipo: 'SEM_CANAL_CONTATO', severidade: 'ALTA', mensagem: 'Lead sem telefone e com e-mail placeholder. Não é possível contatar.' });
    return { descartarLead, issues, phoneInfo: null, emailPlaceholder: true };
  }
  
  if (!phoneInfo && temTelefoneInformado && (!email || emailPlaceholder)) {
    descartarLead = true;
    issues.push({ tipo: 'TELEFONE_LIXO', severidade: 'ALTA', mensagem: 'Telefone inválido/lixo e e-mail ausente ou placeholder.' });
    if (emailPlaceholder) {
      issues.push({ tipo: 'EMAIL_PLACEHOLDER', severidade: 'MEDIA', mensagem: 'E-mail identificado como placeholder.' });
    }
    return { descartarLead, issues, phoneInfo: null, emailPlaceholder };
  }
  
  if (emailPlaceholder && phoneInfo) {
    issues.push({ tipo: 'EMAIL_PLACEHOLDER', severidade: 'MEDIA', mensagem: 'E-mail identificado como placeholder. Usar telefone como canal principal.' });
  }
  
  if (email && !emailPlaceholder && !emailValid) {
    issues.push({ tipo: 'EMAIL_INVALIDO', severidade: 'BAIXA', mensagem: 'Formato de e-mail parece inválido. Revisar manualmente.' });
  }
  
  if (temTelefoneInformado && !phoneInfo && telefone!.replace(/\D/g, '').length >= 10) {
    issues.push({ tipo: 'DADO_SUSPEITO', severidade: 'BAIXA', mensagem: 'Telefone com DDI não reconhecido. Verificar manualmente.' });
  }
  
  return { descartarLead, issues, phoneInfo, emailPlaceholder };
}

// ========================================
// EXTRAÇÃO DE TELEFONE (PESSOA GLOBAL)
// ========================================
interface PhoneBaseResult {
  base: string | null;
  ddd: string | null;
  e164: string | null;
}

export function extractPhoneBase(phone: string | null): PhoneBaseResult {
  if (!phone) return { base: null, ddd: null, e164: null };
  
  let digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  if (digits.length < 10) {
    log.info('Telefone muito curto', { phone, digits });
    return { base: null, ddd: null, e164: null };
  }
  
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  
  if (number.length === 9 && number.startsWith('9')) {
    const base = number.slice(1);
    return { base, ddd, e164: `+55${ddd}${number}` };
  }
  
  if (number.length === 8) {
    return { base: number, ddd, e164: `+55${ddd}9${number}` };
  }
  
  log.info('Formato inesperado', { phone, ddd, number });
  return { base: null, ddd: null, e164: null };
}

// ========================================
// UPSERT PESSOA GLOBAL
// ========================================
export async function upsertPessoaFromContact(
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
  const isEmailPlaceholderVal = isPlaceholderEmail(emailNormalized);
  
  log.info('Tentando match para pessoa', {
    nome: contact.nome,
    telefone_e164: contact.telefone_e164,
    phoneBase: phoneData.base,
    ddd: phoneData.ddd,
    email: emailNormalized,
    isPlaceholder: isEmailPlaceholderVal
  });
  
  // 1. Match por telefone_base + ddd
  if (phoneData.base && phoneData.ddd) {
    const { data: phoneMatch, error: phoneError } = await supabase
      .from('pessoas')
      .select('id, nome')
      .eq('telefone_base', phoneData.base)
      .eq('ddd', phoneData.ddd)
      .maybeSingle();
      
    if (phoneError) {
      log.error('Erro ao buscar por telefone', { error: phoneError.message });
    }
    
    if (phoneMatch) {
      log.info('Match por telefone_base', { pessoaId: phoneMatch.id, nome: phoneMatch.nome });
      return phoneMatch.id;
    }
  }
  
  // 2. Match por email
  if (emailNormalized && !isEmailPlaceholderVal) {
    const { data: emailMatch, error: emailError } = await supabase
      .from('pessoas')
      .select('id, nome')
      .eq('email_principal', emailNormalized)
      .maybeSingle();
      
    if (emailError) {
      log.error('Erro ao buscar por email', { error: emailError.message });
    }
    
    if (emailMatch) {
      log.info('Match por email', { pessoaId: emailMatch.id, nome: emailMatch.nome });
      
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
        log.info('Telefone atualizado para pessoa existente', { pessoaId: emailMatch.id });
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
  
  if (emailNormalized && !isEmailPlaceholderVal) {
    insertData.email_principal = emailNormalized;
  }
  
  const { data: newPessoa, error: insertError } = await supabase
    .from('pessoas')
    .insert(insertData)
    .select('id')
    .single();
    
  if (insertError) {
    log.error('Erro ao criar pessoa (pode ser race condition)', { error: insertError.message });
    
    if (phoneData.base && phoneData.ddd) {
      const { data: retryMatch } = await supabase
        .from('pessoas')
        .select('id')
        .eq('telefone_base', phoneData.base)
        .eq('ddd', phoneData.ddd)
        .maybeSingle();
      if (retryMatch) return retryMatch.id;
    }
    
    if (emailNormalized && !isEmailPlaceholderVal) {
      const { data: retryMatch } = await supabase
        .from('pessoas')
        .select('id')
        .eq('email_principal', emailNormalized)
        .maybeSingle();
      if (retryMatch) return retryMatch.id;
    }
    
    return null;
  }
  
  log.info('Nova pessoa criada', { pessoaId: newPessoa.id, nome: nomeNormalizado });
  return newPessoa.id;
}

// ========================================
// NORMALIZAÇÃO DO EVENTO SGT
// ========================================
export function normalizeSGTEvent(payload: SGTPayload): LeadNormalizado {
  const { lead_id, evento, empresa, timestamp, dados_lead, dados_tokeniza, dados_blue, dados_mautic, dados_chatwoot, dados_notion, event_metadata } = payload;
  
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
      investimentos: dados_tokeniza.investimentos ?? [],
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

  const dadosChatwootNormalized: DadosChatwoot | null = dados_chatwoot ? {
    contact_id: dados_chatwoot.contact_id,
    mensagens_total: dados_chatwoot.mensagens_total ?? 0,
    ultima_mensagem_em: dados_chatwoot.ultima_mensagem_em ?? undefined,
    status_conversa: dados_chatwoot.status_conversa ?? undefined,
    canal: dados_chatwoot.canal ?? undefined,
  } : null;

  const dadosNotionNormalized: DadosNotion | null = dados_notion ? {
    page_id: dados_notion.page_id ?? undefined,
    cliente_status: dados_notion.cliente_status ?? undefined,
    conta_ativa: dados_notion.conta_ativa ?? false,
    ultimo_servico: dados_notion.ultimo_servico ?? undefined,
    notas: dados_notion.notas ?? undefined,
  } : null;

  const parseDateSafe = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Limpar nome com tags de campanha
  const rawNome = dados_lead.nome?.trim() || 'Sem nome';
  const { name: nomeLimpo, campaigns: campanhasOrigem } = cleanContactName(rawNome);

  return {
    lead_id,
    empresa,
    evento,
    timestamp: new Date(timestamp),
    nome: nomeLimpo,
    nome_original: rawNome,
    campanhas_origem: campanhasOrigem,
    email: dados_lead.email?.trim().toLowerCase() || '',
    telefone: dados_lead.telefone?.replace(/\D/g, '') || null,
    organizacao: dados_lead.organizacao?.trim() || null,
    utm_source: dados_lead.utm_source || null,
    utm_medium: dados_lead.utm_medium || null,
    utm_campaign: dados_lead.utm_campaign || null,
    utm_term: dados_lead.utm_term || null,
    utm_content: dados_lead.utm_content || null,
    score: dados_lead.score ?? 0,
    stage: normalizeStage(dados_lead.stage as string),
    origem_tipo: dados_lead.origem_tipo || null,
    lead_pago: dados_lead.lead_pago ?? false,
    data_mql: parseDateSafe(dados_lead.data_mql),
    data_venda: parseDateSafe(dados_lead.data_venda),
    valor_venda: dados_lead.valor_venda ?? null,
    dados_empresa: dadosEmpresa,
    dados_mautic: dadosMauticNormalized,
    dados_chatwoot: dadosChatwootNormalized,
    dados_notion: dadosNotionNormalized,
    metadata: event_metadata || null,
    pipedrive_deal_id: dados_lead.pipedrive_deal_id || null,
    url_pipedrive: dados_lead.url_pipedrive || null,
  };
}
