// ========================================
// _shared/contact-dedup.ts — Módulo de deduplicação centralizado
// Usado por sgt-sync e sgt-webhook
// ========================================

import { createLogger } from './logger.ts';
import { cleanContactName } from './name-sanitizer.ts';

const log = createLogger('contact-dedup');

export interface FindOrCreateResult {
  contactId: string;
  isNew: boolean;
  wasUpdated: boolean;
}

// ========================================
// findOrCreateContact — Hierarquia de dedup
// 1. legacy_lead_id
// 2. email + empresa
// 3. telefone + empresa
// Se encontrado por email/telefone, atualiza legacy_lead_id
// ========================================
export async function findOrCreateContact(
  supabase: any,
  params: {
    leadId: string;
    empresa: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    linkedinCargo?: string | null;
    linkedinEmpresa?: string | null;
    linkedinSetor?: string | null;
    linkedinSenioridade?: string | null;
    linkedinUrl?: string | null;
    scoreMarketing?: number | null;
  }
): Promise<FindOrCreateResult> {
  const now = new Date().toISOString();
  const { leadId, empresa, email, telefone } = params;
  const { name: nomeLimpo } = cleanContactName(params.nome || `Lead ${leadId}`);

  // 1. Busca por legacy_lead_id
  const { data: byLeadId } = await supabase
    .from('contacts')
    .select('id')
    .eq('legacy_lead_id', leadId)
    .maybeSingle();

  if (byLeadId) {
    return { contactId: byLeadId.id, isNew: false, wasUpdated: false };
  }

  // 2. Busca por email + empresa
  if (email) {
    const { data: byEmail } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .eq('empresa', empresa)
      .maybeSingle();

    if (byEmail) {
      await supabase
        .from('contacts')
        .update({ legacy_lead_id: leadId, updated_at: now })
        .eq('id', byEmail.id);
      return { contactId: byEmail.id, isNew: false, wasUpdated: true };
    }
  }

  // 3. Busca por telefone + empresa
  if (telefone) {
    const { data: byPhone } = await supabase
      .from('contacts')
      .select('id')
      .eq('telefone', telefone)
      .eq('empresa', empresa)
      .maybeSingle();

    if (byPhone) {
      await supabase
        .from('contacts')
        .update({
          legacy_lead_id: leadId,
          ...(email ? { email } : {}),
          updated_at: now,
        })
        .eq('id', byPhone.id);
      return { contactId: byPhone.id, isNew: false, wasUpdated: true };
    }
  }

  // 4. Criar novo contact
  const { data: newContact, error: insertErr } = await supabase
    .from('contacts')
    .insert({
      legacy_lead_id: leadId,
      empresa,
      nome: nomeLimpo,
      email,
      telefone,
      is_active: true,
      is_cliente: true,
      canal_origem: 'SGT',
      tipo: 'CLIENTE',
      linkedin_cargo: params.linkedinCargo || null,
      linkedin_empresa: params.linkedinEmpresa || null,
      linkedin_setor: params.linkedinSetor || null,
      linkedin_senioridade: params.linkedinSenioridade || null,
      linkedin_url: params.linkedinUrl || null,
      score_marketing: params.scoreMarketing || null,
    })
    .select('id')
    .single();

  if (insertErr) {
    log.warn(`Erro ao inserir contato lead ${leadId}`, { error: insertErr.message });
    throw new Error(`Insert contact failed: ${insertErr.message}`);
  }

  return { contactId: newContact.id, isNew: true, wasUpdated: false };
}

// ========================================
// enrichContact — Atualiza campos no contact existente
// ========================================
export async function enrichContact(
  supabase: any,
  contactId: string,
  lead: any
): Promise<void> {
  const updates: Record<string, any> = { is_cliente: true, updated_at: new Date().toISOString() };
  if (lead.linkedin_cargo) updates.linkedin_cargo = lead.linkedin_cargo;
  if (lead.linkedin_empresa) updates.linkedin_empresa = lead.linkedin_empresa;
  if (lead.linkedin_setor) updates.linkedin_setor = lead.linkedin_setor;
  if (lead.linkedin_senioridade) updates.linkedin_senioridade = lead.linkedin_senioridade;
  if (lead.linkedin_url) updates.linkedin_url = lead.linkedin_url;
  if (lead.score_temperatura != null) updates.score_marketing = lead.score_temperatura;
  await supabase.from('contacts').update(updates).eq('id', contactId);
}

// ========================================
// isClienteElegivel — Lógica de qualificação
// ========================================
export function isClienteElegivel(lead: any, empresa: string): boolean {
  if (empresa === 'BLUE') {
    if (lead.plano_ativo === true) return true;
    if (lead.venda_realizada === true) return true;
    const stage = (lead.stage_atual || '').toLowerCase();
    const stagesCliente = ['vendido', 'cliente', 'implantação', 'implantacao', 'ativo', 'whatsapp'];
    if (stagesCliente.some(s => stage.includes(s))) return true;
    const status = (lead.cliente_status || '').toLowerCase();
    if (status === 'cliente' || status.includes('ativo')) return true;
    return false;
  }
  if (empresa === 'TOKENIZA') {
    if (lead.tokeniza_investidor === true) return true;
    if (lead.is_investidor === true) return true;
    if (lead.dados_tokeniza?.investidor === true) return true;
    const qtd = lead.dados_tokeniza?.qtd_investimentos ?? 0;
    const valor = lead.dados_tokeniza?.valor_investido ?? 0;
    if (qtd > 0 || valor > 0) return true;
    const investimentos = lead.dados_tokeniza?.investimentos || lead.investimentos || [];
    if (Array.isArray(investimentos) && investimentos.length > 0) {
      return investimentos.some((inv: any) => {
        const s = (inv.status || '').toUpperCase();
        return s === 'PAID' || s === 'FINISHED';
      });
    }
    return false;
  }
  return false;
}

// ========================================
// buildSgtExtras — Dados extras para cs_customers.sgt_dados_extras
// ========================================
export function buildSgtExtras(lead: any): Record<string, any> {
  const extras: Record<string, any> = {};
  if (lead.tokeniza_valor_investido != null) extras.tokeniza_valor_investido = lead.tokeniza_valor_investido;
  if (lead.tokeniza_qtd_investimentos != null) extras.tokeniza_qtd_investimentos = lead.tokeniza_qtd_investimentos;
  if (lead.tokeniza_projetos) extras.tokeniza_projetos = lead.tokeniza_projetos;
  if (lead.irpf_renda_anual != null) extras.irpf_renda_anual = lead.irpf_renda_anual;
  if (lead.irpf_patrimonio_liquido != null) extras.irpf_patrimonio_liquido = lead.irpf_patrimonio_liquido;
  if (lead.irpf_perfil_investidor) extras.irpf_perfil_investidor = lead.irpf_perfil_investidor;
  if (lead.ga4_engajamento_score != null) extras.ga4_engajamento_score = lead.ga4_engajamento_score;
  if (lead.stape_paginas_visitadas != null) extras.stape_paginas_visitadas = lead.stape_paginas_visitadas;
  if (lead.mautic_score != null) extras.mautic_score = lead.mautic_score;
  if (lead.mautic_tags) extras.mautic_tags = lead.mautic_tags;
  if (lead.cliente_status) extras.cliente_status = lead.cliente_status;
  if (lead.plano_atual) extras.plano_atual = lead.plano_atual;
  if (lead.plano_ativo != null) extras.plano_ativo = lead.plano_ativo;
  if (lead.stage_atual) extras.stage_atual = lead.stage_atual;
  // Dados agregados do listar-clientes-api
  if (lead.dados_tokeniza) {
    const dt = lead.dados_tokeniza;
    if (dt.valor_investido != null) extras.tokeniza_valor_investido = dt.valor_investido;
    if (dt.qtd_investimentos != null) extras.tokeniza_qtd_investimentos = dt.qtd_investimentos;
    if (dt.projetos) extras.tokeniza_projetos = dt.projetos;
    if (dt.ultimo_investimento_em) extras.tokeniza_ultimo_investimento_em = dt.ultimo_investimento_em;
    if (dt.carrinho_abandonado != null) extras.tokeniza_carrinho_abandonado = dt.carrinho_abandonado;
    if (dt.valor_carrinho != null) extras.tokeniza_valor_carrinho = dt.valor_carrinho;
  }
  return extras;
}

// ========================================
// buildClienteTags — Tags para cs_customers
// ========================================
export function buildClienteTags(lead: any, empresa: string): string[] {
  const tags: string[] = ['sgt-cliente', 'sgt-sync'];
  if (empresa === 'TOKENIZA') {
    tags.push('tokeniza-investidor');
    const projetos = lead.dados_tokeniza?.projetos || lead.tokeniza_projetos || [];
    if (Array.isArray(projetos)) {
      projetos.forEach((p: string) => tags.push(`projeto:${p}`));
    }
    const qtd = lead.dados_tokeniza?.qtd_investimentos || lead.tokeniza_qtd_investimentos;
    if (qtd) tags.push(`investimentos:${qtd}`);
  }
  if (empresa === 'BLUE') {
    tags.push('blue-cliente');
    if (lead.plano_ativo) tags.push('plano-ativo');
    if (lead.irpf_perfil_investidor) tags.push(`perfil:${lead.irpf_perfil_investidor}`);
  }
  return tags;
}

// ========================================
// upsertCsCustomer — Cria/atualiza registro em cs_customers
// ========================================
export async function upsertCsCustomer(
  supabase: any,
  params: {
    contactId: string;
    empresa: string;
    lead: any;
  }
): Promise<{ csCustomerId: string; isNew: boolean }> {
  const { contactId, empresa, lead } = params;
  const now = new Date().toISOString();

  const sgtExtras = buildSgtExtras(lead);
  const tags = buildClienteTags(lead, empresa);

  const valorMrr = lead.valor_venda
    || (empresa === 'TOKENIZA' ? (lead.dados_tokeniza?.valor_investido || lead.tokeniza_valor_investido || null) : null)
    || 0;
  const dataPrimeiroGanho = lead.data_venda || lead.data_primeiro_investimento || now;

  const { data: existing } = await supabase
    .from('cs_customers')
    .select('id')
    .eq('contact_id', contactId)
    .eq('empresa', empresa)
    .maybeSingle();

  const { data: csCustomer } = await supabase.from('cs_customers').upsert(
    {
      contact_id: contactId,
      empresa,
      is_active: true,
      valor_mrr: valorMrr,
      data_primeiro_ganho: dataPrimeiroGanho,
      tags,
      sgt_dados_extras: sgtExtras,
      sgt_last_sync_at: now,
    },
    { onConflict: 'contact_id,empresa' }
  ).select('id').single();

  return { csCustomerId: csCustomer.id, isNew: !existing };
}

// ========================================
// upsertTokenizaContracts — Upsert investimentos individuais em cs_contracts
// ========================================
export async function upsertTokenizaContracts(
  supabase: any,
  csCustomerId: string,
  investimentos: any[]
): Promise<number> {
  if (!Array.isArray(investimentos) || investimentos.length === 0) return 0;

  const statusMap: Record<string, string> = {
    FINISHED: 'ATIVO',
    PAID: 'ATIVO',
    PENDING: 'PENDENTE',
    CANCELLED: 'CANCELADO',
  };

  let count = 0;
  for (const inv of investimentos) {
    const invStatus = (inv.status || '').toUpperCase();
    if (invStatus !== 'PAID' && invStatus !== 'FINISHED') continue;

    const invDate = new Date(inv.data || inv.data_investimento || '');
    const anoFiscal = isNaN(invDate.getTime()) ? new Date().getFullYear() : invDate.getFullYear();

    const { error } = await supabase.from('cs_contracts').upsert(
      {
        customer_id: csCustomerId,
        empresa: 'TOKENIZA',
        ano_fiscal: anoFiscal,
        plano: inv.oferta_nome || 'Investimento',
        oferta_id: inv.oferta_id || inv.id || null,
        oferta_nome: inv.oferta_nome || null,
        tipo: (inv.tipo && inv.tipo.trim()) ? inv.tipo.trim().toLowerCase() : 'crowdfunding',
        valor: inv.valor || 0,
        data_contratacao: inv.data || inv.data_investimento || null,
        status: statusMap[invStatus] || 'ATIVO',
        notas: 'Importado via sgt-sync',
      },
      { onConflict: 'customer_id,ano_fiscal,oferta_id' }
    );

    if (!error) count++;
  }
  return count;
}
