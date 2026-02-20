import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/logger.ts';
import { cleanContactName } from '../_shared/name-sanitizer.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = createLogger('sgt-full-import');

// New bulk endpoint — returns up to 500 clients per call
const SGT_LIST_URL = 'https://unsznbmmqhihwctguvvr.supabase.co/functions/v1/listar-clientes-api';
const BATCH_SIZE_BLUE = 50;      // join com cliente_notion é mais lento + processamento com upserts
const BATCH_SIZE_TOKENIZA = 50;  // 50 registros para garantir processamento dentro do limite de 30s
const SETTINGS_CATEGORY = 'sgt-full-import';

// ========================================
// Client qualification logic
// ========================================
function isClienteElegivel(lead: any, empresa: string): boolean {
  if (empresa === 'BLUE') {
    // plano_ativo: cliente tem assinatura ativa
    if (lead.plano_ativo === true) return true;
    // venda_realizada: venda confirmada, mesmo sem plano ativo ainda
    if (lead.venda_realizada === true) return true;
    // stage_atual: estágios que indicam cliente convertido
    const stage = (lead.stage_atual || '').toLowerCase();
    const stagesCliente = ['vendido', 'cliente', 'implantação', 'implantacao', 'ativo', 'whatsapp'];
    if (stagesCliente.some(s => stage.includes(s))) return true;
    // cliente_status
    const status = (lead.cliente_status || '').toLowerCase();
    if (status === 'cliente' || status.includes('ativo')) return true;
    return false;
  }
  if (empresa === 'TOKENIZA') {
    // Check flag in multiple possible locations
    if (lead.tokeniza_investidor === true) return true;
    if (lead.is_investidor === true) return true;
    if (lead.dados_tokeniza?.investidor === true) return true;

    // O endpoint listar-clientes-api retorna dados_tokeniza com campos AGREGADOS (não array de investimentos)
    // O indicador real de investidor é qtd_investimentos > 0 ou valor_investido > 0
    const qtdInvestimentos = lead.dados_tokeniza?.qtd_investimentos ?? 0;
    const valorInvestido = lead.dados_tokeniza?.valor_investido ?? 0;
    if (qtdInvestimentos > 0) return true;
    if (valorInvestido > 0) return true;

    // Fallback: array de investimentos (formato buscar-lead-api individual)
    const investimentos =
      lead.dados_tokeniza?.investimentos ||
      lead.investimentos ||
      lead.dados_tokeniza?.aportes ||
      lead.aportes ||
      [];
    if (Array.isArray(investimentos) && investimentos.length > 0) {
      const temInvestimentoRealizado = investimentos.some((inv: any) => {
        const s = (inv.status || '').toUpperCase();
        return s === 'PAID' || s === 'FINISHED';
      });
      if (temInvestimentoRealizado) return true;
    }
    return false;
  }
  return false;
}

// ========================================
// Build SGT extras payload
// ========================================
function buildSgtExtras(lead: any): Record<string, any> {
  const extras: Record<string, any> = {};
  // Campos raiz legados
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
  // Campos agregados do listar-clientes-api (dados_tokeniza aninhado)
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
// Build customer tags
// ========================================
function buildClienteTags(lead: any, empresa: string): string[] {
  const tags: string[] = ['sgt-cliente', 'sgt-full-import'];
  if (empresa === 'TOKENIZA') {
    tags.push('tokeniza-investidor');
    // Projetos: pode estar em dados_tokeniza.projetos (listar) ou tokeniza_projetos (buscar)
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
// Save offset for this empresa
// ========================================
async function saveOffset(supabase: any, empresa: string, offset: number) {
  await supabase.from('system_settings').upsert(
    {
      category: SETTINGS_CATEGORY,
      key: empresa.toLowerCase(),
      value: { offset, updated_at: new Date().toISOString() },
      description: `Offset de importação completa SGT para ${empresa}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'category,key' }
  );
}

// ========================================
// Process a single lead into local DB
// ========================================
async function processLead(supabase: any, lead: any, empresa: string, now: string): Promise<{
  novoContato: boolean;
  novoCsCustomer: boolean;
  novosContratos: number;
  ignorado: boolean;
  erro: boolean;
}> {
  const result = { novoContato: false, novoCsCustomer: false, novosContratos: 0, ignorado: false, erro: false };

  try {
    const leadId = lead.lead_id || lead.id;
    if (!leadId) { result.ignorado = true; return result; }

    const email = lead.email || null;
    const telefone = lead.telefone || null;

    if (!email && !telefone) { result.ignorado = true; return result; }

    const { name: nomeLimpo } = cleanContactName(lead.nome || `Lead ${leadId}`);

    // ---- 1. Upsert lead_contacts ----
    await supabase.from('lead_contacts').upsert(
      {
        lead_id: leadId,
        empresa,
        nome: nomeLimpo,
        email,
        telefone,
        updated_at: now,
      },
      { onConflict: 'lead_id,empresa', ignoreDuplicates: false }
    );

    // ---- 2. Upsert contacts ----
    let contactId: string | null = null;

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, is_cliente')
      .eq('legacy_lead_id', leadId)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else if (email) {
      // Busca por email NA MESMA EMPRESA — evita criar duplicatas em imports repetidos
      // (o mesmo lead do SGT pode ter lead_ids diferentes entre runs, por isso não basta buscar por legacy_lead_id)
      const { data: emailContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('email', email)
        .eq('empresa', empresa)
        .maybeSingle();

      if (emailContact) {
        contactId = emailContact.id;
        // Vincula o legacy_lead_id ao contact existente para evitar criação de duplicata futura
        await supabase
          .from('contacts')
          .update({ legacy_lead_id: leadId, updated_at: now })
          .eq('id', contactId);
      } else if (telefone) {
        // Fallback: busca por telefone na mesma empresa antes de criar novo contact
        const { data: phoneContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('telefone', telefone)
          .eq('empresa', empresa)
          .maybeSingle();

        if (phoneContact) {
          contactId = phoneContact.id;
          await supabase
            .from('contacts')
            .update({ legacy_lead_id: leadId, email: email || undefined, updated_at: now })
            .eq('id', contactId);
        }
      }
    }

    if (!contactId) {
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
          linkedin_cargo: lead.linkedin_cargo || null,
          linkedin_empresa: lead.linkedin_empresa || null,
          linkedin_setor: lead.linkedin_setor || null,
          linkedin_senioridade: lead.linkedin_senioridade || null,
          linkedin_url: lead.linkedin_url || null,
          score_marketing: lead.score_temperatura || null,
        })
        .select('id')
        .single();

      if (insertErr) {
        log.warn(`Erro ao inserir contato lead ${leadId}`, { error: insertErr.message });
        result.erro = true;
        return result;
      }

      contactId = newContact.id;
      result.novoContato = true;
    }

    if (!contactId) { result.ignorado = true; return result; }

    // ---- Enrich contact ----
    const contactEnrich: Record<string, any> = { is_cliente: true, updated_at: now };
    if (lead.linkedin_cargo) contactEnrich.linkedin_cargo = lead.linkedin_cargo;
    if (lead.linkedin_empresa) contactEnrich.linkedin_empresa = lead.linkedin_empresa;
    if (lead.linkedin_setor) contactEnrich.linkedin_setor = lead.linkedin_setor;
    if (lead.linkedin_senioridade) contactEnrich.linkedin_senioridade = lead.linkedin_senioridade;
    if (lead.linkedin_url) contactEnrich.linkedin_url = lead.linkedin_url;
    if (lead.score_temperatura != null) contactEnrich.score_marketing = lead.score_temperatura;
    await supabase.from('contacts').update(contactEnrich).eq('id', contactId);

    // ---- 3. Upsert cs_customers ----
    const sgtExtras = buildSgtExtras(lead);
    const tags = buildClienteTags(lead, empresa);
    // Investimentos: array detalhado (buscar-lead-api) ou vazio (listar-clientes-api usa dados agregados)
    const investimentos = lead.dados_tokeniza?.investimentos || lead.investimentos || [];
    // MRR: usa valor_venda para BLUE; para TOKENIZA usa valor_investido do objeto dados_tokeniza agregado
    const valorMrr = lead.valor_venda
      || (empresa === 'TOKENIZA' ? (lead.dados_tokeniza?.valor_investido || lead.tokeniza_valor_investido || null) : null)
      || 0;
    const dataPrimeiroGanho = lead.data_venda || lead.data_primeiro_investimento || now;

    const { data: existingCs } = await supabase
      .from('cs_customers')
      .select('id')
      .eq('contact_id', contactId)
      .eq('empresa', empresa)
      .maybeSingle();

    result.novoCsCustomer = !existingCs;

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

    // ---- 4. Tokeniza: upsert cs_contracts per investment ----
    if (empresa === 'TOKENIZA' && csCustomer && Array.isArray(investimentos) && investimentos.length > 0) {
      const statusMap: Record<string, string> = {
        FINISHED: 'ATIVO',
        PAID: 'ATIVO',
        PENDING: 'PENDENTE',
        CANCELLED: 'CANCELADO',
      };

      for (const inv of investimentos) {
        const invStatus = (inv.status || '').toUpperCase();
        if (invStatus !== 'PAID' && invStatus !== 'FINISHED') continue;

        const invDate = new Date(inv.data || inv.data_investimento || '');
        const anoFiscal = isNaN(invDate.getTime()) ? new Date().getFullYear() : invDate.getFullYear();

        const { error: contractErr } = await supabase.from('cs_contracts').upsert(
          {
            customer_id: csCustomer.id,
            empresa: 'TOKENIZA',
            ano_fiscal: anoFiscal,
            plano: inv.oferta_nome || 'Investimento',
            oferta_id: inv.oferta_id || inv.id || null,
            oferta_nome: inv.oferta_nome || null,
            tipo: (inv.tipo && inv.tipo.trim()) ? inv.tipo.trim().toLowerCase() : 'crowdfunding',
            valor: inv.valor || 0,
            data_contratacao: inv.data || inv.data_investimento || null,
            status: statusMap[invStatus] || 'ATIVO',
            notas: 'Importado via sgt-full-import',
          },
          { onConflict: 'customer_id,ano_fiscal,oferta_id' }
        );

        if (!contractErr) result.novosContratos++;
      }
    }
  } catch (err) {
    log.error('Erro processando lead', { error: String(err) });
    result.erro = true;
  }

  return result;
}

// ========================================
// Main handler
// ========================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsOptions(req);

  const cors = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sgtApiKey = Deno.env.get('SGT_WEBHOOK_SECRET');

    if (!sgtApiKey) {
      log.error('SGT_WEBHOOK_SECRET não configurado');
      return new Response(JSON.stringify({ error: 'SGT_WEBHOOK_SECRET missing' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---- Parse request body ----
    let empresa: 'BLUE' | 'TOKENIZA' = 'BLUE';
    let resetOffset = false;
    let manualOffset: number | null = null;

    try {
      const body = await req.json();
      if (body?.empresa) empresa = body.empresa.toUpperCase() as 'BLUE' | 'TOKENIZA';
      if (body?.reset_offset === true) resetOffset = true;
      if (body?.offset != null) manualOffset = Number(body.offset);
    } catch { /* no body */ }

    if (empresa !== 'BLUE' && empresa !== 'TOKENIZA') {
      return new Response(JSON.stringify({ error: 'empresa deve ser BLUE ou TOKENIZA' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ---- Batch size dinâmico por empresa ----
    const batchSize = empresa === 'BLUE' ? BATCH_SIZE_BLUE : BATCH_SIZE_TOKENIZA;

    // ---- Load offset ----
    let offset = 0;
    if (!resetOffset) {
      const { data: offsetRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('category', SETTINGS_CATEGORY)
        .eq('key', empresa.toLowerCase())
        .maybeSingle();

      if (offsetRow?.value?.offset != null) {
        offset = offsetRow.value.offset;
      }
    }

    if (manualOffset !== null) offset = manualOffset;

    log.info(`Iniciando import ${empresa} — offset ${offset}, batch ${batchSize} via listar-clientes-api`);

    // ---- Call SGT listar-clientes-api com timeout de 25s ----
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 25000);

    let sgtResponse: Response;
    try {
      sgtResponse = await fetch(SGT_LIST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': sgtApiKey,
        },
        body: JSON.stringify({ empresa, limit: batchSize, offset }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      const isTimeout = String(fetchErr).includes('abort') || String(fetchErr).includes('AbortError');
      log.error(`SGT fetch ${isTimeout ? 'timeout (25s)' : 'error'}`, { error: String(fetchErr), empresa, batchSize, offset });
      return new Response(JSON.stringify({
        error: isTimeout ? `SGT timeout após 25s — tente com batch menor ou verifique o SGT` : `SGT fetch error`,
        details: String(fetchErr),
        empresa,
      }), {
        status: 504,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(fetchTimeout);
    }

    if (!sgtResponse.ok) {
      const details = await sgtResponse.text();
      log.error(`SGT error ${sgtResponse.status}`, { details });
      return new Response(JSON.stringify({ error: `SGT error ${sgtResponse.status}`, details }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const sgtData = await sgtResponse.json();

    // Support both { clientes: [...] } and { data: [...] } shapes
    const clientes: any[] = sgtData.clientes || sgtData.data || sgtData.leads || [];
    const total: number = sgtData.total ?? clientes.length;
    const hasMore: boolean = sgtData.has_more ?? (clientes.length === batchSize);

    log.info(`SGT retornou ${clientes.length} clientes (total: ${total}, has_more: ${hasMore}, batchSize: ${batchSize})`);

    // ---- Log schema do primeiro cliente para diagnóstico de campos ----
    if (clientes.length > 0) {
      const sample = clientes[0];
      log.info('Sample lead schema', {
        empresa,
        keys: Object.keys(sample),
        tokeniza_fields: {
          tokeniza_investidor: sample.tokeniza_investidor,
          is_investidor: sample.is_investidor,
          has_dados_tokeniza: !!sample.dados_tokeniza,
          dados_tokeniza_keys: sample.dados_tokeniza ? Object.keys(sample.dados_tokeniza) : [],
          investimentos_root_count: Array.isArray(sample.investimentos) ? sample.investimentos.length : 'N/A',
          dados_tokeniza_investimentos_count: Array.isArray(sample.dados_tokeniza?.investimentos) ? sample.dados_tokeniza.investimentos.length : 'N/A',
        },
        blue_fields: {
          plano_ativo: sample.plano_ativo,
          stage_atual: sample.stage_atual,
          cliente_status: sample.cliente_status,
          venda_realizada: sample.venda_realizada,
        },
      });
    }

    if (clientes.length === 0) {
      await saveOffset(supabase, empresa, 0);
      return new Response(JSON.stringify({
        processados: 0,
        novos_contatos: 0,
        novos_cs_customers: 0,
        novos_contratos: 0,
        ignorados: 0,
        erros: 0,
        proximo_offset: 0,
        ciclo_completo: true,
        empresa,
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ---- Process each client ----
    let novosContatos = 0;
    let novosCsCustomers = 0;
    let novosContratos = 0;
    let ignorados = 0;
    let erros = 0;
    const now = new Date().toISOString();

    for (const cliente of clientes) {
      // Qualify first — skip non-clients early
      if (!isClienteElegivel(cliente, empresa)) {
        ignorados++;
        continue;
      }

      const r = await processLead(supabase, cliente, empresa, now);
      if (r.ignorado) ignorados++;
      else if (r.erro) erros++;
      else {
        if (r.novoContato) novosContatos++;
        if (r.novoCsCustomer) novosCsCustomers++;
        novosContratos += r.novosContratos;
      }
    }

    // ---- Save next offset ----
    const cicloCompleto = !hasMore;
    const nextOffset = cicloCompleto ? 0 : offset + batchSize;
    await saveOffset(supabase, empresa, nextOffset);

    const result = {
      processados: clientes.length,
      novos_contatos: novosContatos,
      novos_cs_customers: novosCsCustomers,
      novos_contratos: novosContratos,
      ignorados,
      erros,
      total_sgt: total,
      offset_atual: offset,
      proximo_offset: nextOffset,
      ciclo_completo: cicloCompleto,
      empresa,
      timestamp: now,
    };

    log.info(`Import ${empresa} concluído`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('Erro inesperado', { error: String(err) });
    return new Response(JSON.stringify({ error: 'Erro interno', details: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
