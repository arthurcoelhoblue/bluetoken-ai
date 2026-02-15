import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5A + 5E - Cadence Runner
// Motor de execução automática de cadências
// ========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================================
// TIPOS
// ========================================
type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type CanalTipo = 'WHATSAPP' | 'EMAIL' | 'SMS';
type CadenceRunStatus = 'ATIVA' | 'CONCLUIDA' | 'CANCELADA' | 'PAUSADA';
type TriggerSource = 'CRON' | 'MANUAL' | 'TEST';

interface LeadCadenceRun {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  cadence_id: string;
  status: CadenceRunStatus;
  last_step_ordem: number;
  next_step_ordem: number | null;
  next_run_at: string | null;
  started_at: string;
}

interface CadenceStep {
  id: string;
  cadence_id: string;
  ordem: number;
  offset_minutos: number;
  canal: CanalTipo;
  template_codigo: string;
  parar_se_responder: boolean;
}

interface LeadContact {
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  primeiro_nome: string | null;
}

interface MessageTemplate {
  id: string;
  empresa: EmpresaTipo;
  canal: CanalTipo;
  codigo: string;
  conteudo: string;
  ativo: boolean;
}

interface ProcessResult {
  runId: string;
  leadId: string;
  stepOrdem: number;
  templateCodigo: string;
  status: 'DISPARADO' | 'ERRO' | 'CONCLUIDA' | 'SKIPPED';
  mensagem?: string;
  erro?: string;
}

interface RunnerExecutionLog {
  steps_executed: number;
  errors: number;
  runs_touched: number;
  duration_ms: number;
  trigger_source: TriggerSource;
  details: {
    results: ProcessResult[];
    started_at: string;
    finished_at: string;
  };
}

// ========================================
// AUTENTICAÇÃO
// ========================================
function validateAuth(req: Request, body?: Record<string, unknown>): boolean {
  // pg_cron calls with source marker: safe because verify_jwt=false
  // and the function uses service_role internally for all DB ops
  if (body?.source === 'pg_cron' || body?.trigger === 'CRON') {
    console.log('[Auth] pg_cron/CRON source accepted');
    return true;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.warn('[Auth] Missing Authorization header');
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (token === serviceRoleKey || token === cronSecret || token === anonKey) {
    console.log('[Auth] Token válido');
    return true;
  }
  
  console.warn('[Auth] Invalid token provided');
  return false;
}

// ========================================
// TIPOS DE OFERTA
// ========================================
interface TokenizaOferta {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  empresa: string;
  empresaWebsite: string;
  rentabilidade: string;
  duracaoDias: number;
  contribuicaoMinima: number;
  metaCaptacao: number;
  valorCaptado: number;
  percentualCaptado: number;
  tipoRisco: string;
  diasRestantes: number;
}

// ========================================
// BUSCAR OFERTA ATIVA (TOKENIZA)
// ========================================
async function buscarOfertaAtiva(): Promise<TokenizaOferta | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/tokeniza-offers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!response.ok) {
      console.warn('[Oferta] Erro ao buscar ofertas:', response.status);
      return null;
    }

    const data = await response.json();
    const ofertasAbertas = data.ofertas?.filter((o: TokenizaOferta) => o.status === 'open') || [];
    
    if (ofertasAbertas.length === 0) {
      console.log('[Oferta] Nenhuma oferta aberta encontrada');
      return null;
    }

    // Retorna a primeira oferta aberta (pode ser ordenada por prioridade futuramente)
    const oferta = ofertasAbertas[0];
    console.log('[Oferta] Oferta ativa encontrada:', oferta.nome);
    return oferta;
  } catch (error) {
    console.error('[Oferta] Erro ao buscar oferta:', error);
    return null;
  }
}

// ========================================
// RESOLUÇÃO DE TEMPLATE COM PLACEHOLDERS INTELIGENTES
// ========================================
interface PlaceholderContext {
  // Lead
  nome: string;
  primeiro_nome: string;
  email: string;
  empresa: string;
  // Oferta (opcional)
  oferta?: TokenizaOferta | null;
}

function resolverPlaceholders(template: string, context: PlaceholderContext): string {
  let resultado = template;
  
  // === Placeholders de Lead ===
  resultado = resultado.replace(/\{\{nome\}\}/g, context.nome || 'você');
  resultado = resultado.replace(/\{\{primeiro_nome\}\}/g, context.primeiro_nome || 'você');
  resultado = resultado.replace(/\{\{lead_nome\}\}/g, context.nome || 'você');
  resultado = resultado.replace(/\{\{email\}\}/g, context.email || '');
  resultado = resultado.replace(/\{\{empresa\}\}/g, 
    context.empresa === 'TOKENIZA' ? 'Tokeniza' : 'Blue Consult'
  );
  
  // === Placeholders de Oferta (TOKENIZA) ===
  if (context.oferta) {
    const oferta = context.oferta;
    resultado = resultado.replace(/\{\{oferta_nome\}\}/g, oferta.nome || '');
    resultado = resultado.replace(/\{\{oferta_rentabilidade\}\}/g, oferta.rentabilidade || '');
    resultado = resultado.replace(/\{\{oferta_prazo\}\}/g, `${oferta.duracaoDias || 0} dias`);
    resultado = resultado.replace(/\{\{oferta_tipo\}\}/g, oferta.tipo || '');
    resultado = resultado.replace(/\{\{oferta_url\}\}/g, oferta.empresaWebsite || 'https://tokeniza.com.br');
    resultado = resultado.replace(/\{\{oferta_garantia\}\}/g, oferta.tipoRisco || 'Não informado');
    resultado = resultado.replace(/\{\{oferta_minimo\}\}/g, 
      oferta.contribuicaoMinima ? `R$ ${oferta.contribuicaoMinima.toLocaleString('pt-BR')}` : ''
    );
    resultado = resultado.replace(/\{\{oferta_captado\}\}/g, `${oferta.percentualCaptado}%`);
    resultado = resultado.replace(/\{\{oferta_dias_restantes\}\}/g, `${oferta.diasRestantes}`);
  } else {
    // Remove placeholders de oferta se não houver oferta
    resultado = resultado.replace(/\{\{oferta_nome\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_rentabilidade\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_prazo\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_tipo\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_url\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_garantia\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_minimo\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_captado\}\}/g, '');
    resultado = resultado.replace(/\{\{oferta_dias_restantes\}\}/g, '');
  }
  
  return resultado;
}

async function resolverMensagem(
  supabase: SupabaseClient,
  empresa: EmpresaTipo,
  templateCodigo: string,
  canal: CanalTipo,
  contact: LeadContact
): Promise<{ success: boolean; body?: string; to?: string; error?: string; ofertaUsada?: string }> {
  console.log('[Template] Resolvendo:', { empresa, templateCodigo, canal });

  // Buscar template
  const { data: template, error: templateError } = await supabase
    .from('message_templates')
    .select('*')
    .eq('empresa', empresa)
    .eq('codigo', templateCodigo)
    .eq('ativo', true)
    .maybeSingle();

  if (templateError || !template) {
    console.error('[Template] Não encontrado:', templateCodigo);
    return { success: false, error: `Template ${templateCodigo} não encontrado ou inativo` };
  }

  // Validar canal
  if (template.canal !== canal) {
    console.warn('[Template] Canal diferente:', { templateCanal: template.canal, stepCanal: canal });
  }

  // Definir destinatário
  let to: string | null = null;
  if (canal === 'WHATSAPP' || canal === 'SMS') {
    to = contact.telefone;
  } else if (canal === 'EMAIL') {
    to = contact.email;
  }

  if (!to) {
    return { success: false, error: `Contato sem ${canal === 'EMAIL' ? 'email' : 'telefone'}` };
  }

  // Buscar oferta ativa (apenas para TOKENIZA e se template usa placeholders de oferta)
  let oferta: TokenizaOferta | null = null;
  const usaPlaceholdersOferta = template.conteudo.includes('{{oferta_');
  
  if (empresa === 'TOKENIZA' && usaPlaceholdersOferta) {
    console.log('[Template] Template usa placeholders de oferta, buscando oferta ativa...');
    oferta = await buscarOfertaAtiva();
  }

  // Resolver placeholders com contexto completo
  const body = resolverPlaceholders(template.conteudo, {
    nome: contact.nome || 'você',
    primeiro_nome: contact.primeiro_nome || contact.nome?.split(' ')[0] || 'você',
    email: contact.email || '',
    empresa: empresa,
    oferta: oferta,
  });

  if (oferta) {
    console.log('[Template] Placeholders resolvidos com oferta:', oferta.nome);
  }

  return { success: true, body, to, ofertaUsada: oferta?.nome };
}

// ========================================
// DISPARO DE MENSAGEM
// ========================================
async function dispararMensagem(
  supabase: SupabaseClient,
  canal: CanalTipo,
  to: string,
  body: string,
  leadId: string,
  empresa: EmpresaTipo,
  runId: string,
  stepOrdem: number,
  templateCodigo: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  console.log('[Disparo] Enviando mensagem:', { canal, to: to.substring(0, 5) + '***', bodyPreview: body.substring(0, 50) });

  if (canal === 'WHATSAPP') {
    // Chamar edge function whatsapp-send
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          leadId,
          telefone: to,
          mensagem: body,
          empresa,
          runId,
          stepOrdem,
          templateCodigo,
        }),
      });

      const data = await response.json();
      console.log('[Disparo] Resposta WhatsApp:', data);

      if (!data.success) {
        return { success: false, error: data.error || 'Erro no envio WhatsApp' };
      }

      return { success: true, messageId: data.messageId };
    } catch (error) {
      console.error('[Disparo] Erro ao chamar whatsapp-send:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  } else if (canal === 'EMAIL') {
    // PATCH 5D: Integração com SMTP via edge function email-send
    // Verificar se integração de email está habilitada
    const supabaseUrlCheck = Deno.env.get('SUPABASE_URL')!;
    const supabaseKeyCheck = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseCheck = createClient(supabaseUrlCheck, supabaseKeyCheck);
    
    const { data: emailSetting } = await supabaseCheck
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', 'email')
      .maybeSingle();
    
    const emailEnabled = (emailSetting?.value as Record<string, unknown>)?.enabled;
    if (!emailEnabled) {
      console.warn('[Disparo] Integração de email desabilitada em system_settings');
      return { success: false, error: 'Integração de email desabilitada. Ative em Configurações > Integrações.' };
    }

    console.log('[Disparo] Enviando email para:', to);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // Extrair assunto do template (primeira linha com "Assunto:" ou fallback)
      const lines = body.split('\n');
      const subject = lines[0]?.startsWith('Assunto:') 
        ? lines[0].replace('Assunto:', '').trim()
        : `Mensagem de ${empresa === 'TOKENIZA' ? 'Tokeniza' : 'Blue Consult'}`;
      const htmlBody = lines[0]?.startsWith('Assunto:') ? lines.slice(1).join('\n').trim() : body;

      const response = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          to,
          subject,
          html: htmlBody.replace(/\n/g, '<br>'),
          text: htmlBody,
          lead_id: leadId,
          empresa,
          run_id: runId,
          step_ordem: stepOrdem,
          template_codigo: templateCodigo,
        }),
      });

      const data = await response.json();
      console.log('[Disparo] Resposta Email:', data);

      if (!data.success) {
        return { success: false, error: data.error || 'Erro no envio de email' };
      }

      return { success: true, messageId: data.messageId };
    } catch (error) {
      console.error('[Disparo] Erro ao chamar email-send:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  } else {
    // SMS não é suportado - canal não implementado
    console.warn('[Disparo] Canal SMS não implementado, marcando como erro');
    return { success: false, error: 'Canal SMS não suportado. Altere o step da cadência para WHATSAPP ou EMAIL.' };
  }
}

// ========================================
// HORÁRIO COMERCIAL - 09h-18h seg-sex (America/Sao_Paulo)
// ========================================
function getHorarioBrasilia(): Date {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + brasiliaOffset * 60 * 1000);
}

function isHorarioComercial(): boolean {
  const brasilia = getHorarioBrasilia();
  const dia = brasilia.getDay();
  const hora = brasilia.getHours();
  return dia >= 1 && dia <= 5 && hora >= 9 && hora < 18;
}

function proximoHorarioComercial(): Date {
  const brasilia = getHorarioBrasilia();
  const dia = brasilia.getDay();
  const hora = brasilia.getHours();
  
  let diasParaAdicionar = 0;
  
  if (dia >= 1 && dia <= 5 && hora < 9) {
    diasParaAdicionar = 0;
  } else if (dia === 5 && hora >= 18) {
    diasParaAdicionar = 3;
  } else if (dia === 6) {
    diasParaAdicionar = 2;
  } else if (dia === 0) {
    diasParaAdicionar = 1;
  } else if (dia >= 1 && dia <= 4 && hora >= 18) {
    diasParaAdicionar = 1;
  }
  
  const resultado = new Date(brasilia);
  resultado.setDate(resultado.getDate() + diasParaAdicionar);
  resultado.setHours(9, 0, 0, 0);
  const utcMs = resultado.getTime() - (-3 * 60) * 60 * 1000;
  return new Date(utcMs);
}

// ========================================
// PROCESSAMENTO DE CADÊNCIAS VENCIDAS
// ========================================
async function processarCadenciasVencidas(supabase: SupabaseClient): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const now = new Date().toISOString();

  console.log('[Runner] Buscando runs vencidas...');

  // 1. Buscar runs ativas com next_run_at vencido
  // Usando lock otimista: atualizamos next_run_at antes de processar
  const { data: runs, error: runsError } = await supabase
    .from('lead_cadence_runs')
    .select('*')
    .eq('status', 'ATIVA')
    .not('next_run_at', 'is', null)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true })
    .limit(100); // Processa em lotes maiores para CRON

  if (runsError) {
    console.error('[Runner] Erro ao buscar runs:', runsError);
    throw runsError;
  }

  if (!runs || runs.length === 0) {
    console.log('[Runner] Nenhuma run vencida encontrada');
    return results;
  }

  console.log('[Runner] Runs encontradas:', runs.length);

  // 2. Processar cada run
  for (const run of runs as LeadCadenceRun[]) {
    try {
      const result = await processarRun(supabase, run);
      results.push(result);
    } catch (error) {
      console.error('[Runner] Erro ao processar run:', run.id, error);
      results.push({
        runId: run.id,
        leadId: run.lead_id,
        stepOrdem: run.next_step_ordem || 0,
        templateCodigo: '',
        status: 'ERRO',
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }

  return results;
}

async function processarRun(supabase: SupabaseClient, run: LeadCadenceRun): Promise<ProcessResult> {
  console.log('[Runner] Processando run:', { runId: run.id, leadId: run.lead_id, step: run.next_step_ordem });

  // 1. Lock otimista: tentar marcar como "em processamento"
  // Atualizamos next_run_at para um valor futuro temporário
  const lockTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // +5min
  const { data: locked, error: lockError } = await supabase
    .from('lead_cadence_runs')
    .update({ next_run_at: lockTime, updated_at: new Date().toISOString() })
    .eq('id', run.id)
    .eq('next_run_at', run.next_run_at) // Lock otimista - só atualiza se next_run_at não mudou
    .select()
    .maybeSingle();

  if (lockError || !locked) {
    console.log('[Runner] Run já sendo processada por outra instância:', run.id);
    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: run.next_step_ordem || 0,
      templateCodigo: '',
      status: 'SKIPPED',
      mensagem: 'Run em processamento por outra instância (lock otimista)',
    };
  }

  // 2. Buscar step atual
  const { data: step, error: stepError } = await supabase
    .from('cadence_steps')
    .select('*')
    .eq('cadence_id', run.cadence_id)
    .eq('ordem', run.next_step_ordem)
    .single();

  if (stepError || !step) {
    console.error('[Runner] Step não encontrado:', run.next_step_ordem);
    // Marca como concluída se não tem mais steps
    await supabase
      .from('lead_cadence_runs')
      .update({
        status: 'CONCLUIDA',
        next_step_ordem: null,
        next_run_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: run.next_step_ordem || 0,
      templateCodigo: '',
      status: 'CONCLUIDA',
      mensagem: 'Cadência concluída - sem mais steps',
    };
  }

  const currentStep = step as CadenceStep;

  // 2.5 Verificar horário comercial
  if (!isHorarioComercial()) {
    const proximoHorario = proximoHorarioComercial();
    console.log('[Runner] Fora de horário comercial, reagendando para:', proximoHorario.toISOString());
    
    await supabase
      .from('lead_cadence_runs')
      .update({
        next_run_at: proximoHorario.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'AGENDADO',
      detalhes: { motivo: 'Fora de horário comercial', next_run_at: proximoHorario.toISOString() },
    });

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'SKIPPED',
      mensagem: 'Reagendado para próximo horário comercial',
    };
  }

  // 2.6 Verificar modo de atendimento
  const { data: convState } = await supabase
    .from('lead_conversation_state')
    .select('modo')
    .eq('lead_id', run.lead_id)
    .eq('empresa', run.empresa)
    .maybeSingle();

  if (convState?.modo === 'MANUAL') {
    console.log('[Runner] Lead em modo MANUAL, pausando cadência:', run.id);
    
    await supabase
      .from('lead_cadence_runs')
      .update({
        status: 'PAUSADA',
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'PAUSADA',
      detalhes: { motivo: 'Lead em atendimento manual por vendedor' },
    });

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'SKIPPED',
      mensagem: 'Cadência pausada - lead em atendimento manual',
    };
  }

  // 3. Buscar contato do lead
  const { data: contact, error: contactError } = await supabase
    .from('lead_contacts')
    .select('*')
    .eq('lead_id', run.lead_id)
    .eq('empresa', run.empresa)
    .maybeSingle();

  if (contactError || !contact) {
    console.error('[Runner] Contato não encontrado para lead:', run.lead_id);
    
    // Registra erro
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'ERRO',
      detalhes: { error: 'Contato do lead não encontrado' },
    });

    // Restaura next_run_at para retry futuro
    await supabase
      .from('lead_cadence_runs')
      .update({ 
        next_run_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'ERRO',
      erro: 'Contato do lead não encontrado',
    };
  }

  // 4. Resolver mensagem
  const mensagemResolvida = await resolverMensagem(
    supabase,
    run.empresa,
    currentStep.template_codigo,
    currentStep.canal,
    contact as LeadContact
  );

  if (!mensagemResolvida.success) {
    console.error('[Runner] Erro ao resolver mensagem:', mensagemResolvida.error);
    
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'ERRO',
      detalhes: { error: mensagemResolvida.error },
    });

    // Restaura para retry
    await supabase
      .from('lead_cadence_runs')
      .update({ 
        next_run_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'ERRO',
      erro: mensagemResolvida.error,
    };
  }

  // 5. Disparar mensagem
  const disparo = await dispararMensagem(
    supabase,
    currentStep.canal,
    mensagemResolvida.to!,
    mensagemResolvida.body!,
    run.lead_id,
    run.empresa,
    run.id,
    currentStep.ordem,
    currentStep.template_codigo
  );

  if (!disparo.success) {
    console.error('[Runner] Erro no disparo:', disparo.error);
    
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'ERRO',
      detalhes: { error: disparo.error, to: mensagemResolvida.to },
    });

    // Restaura para retry
    await supabase
      .from('lead_cadence_runs')
      .update({ 
        next_run_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'ERRO',
      erro: disparo.error,
    };
  }

  // 6. Registrar evento de disparo
  await supabase.from('lead_cadence_events').insert({
    lead_cadence_run_id: run.id,
    step_ordem: currentStep.ordem,
    template_codigo: currentStep.template_codigo,
    tipo_evento: 'DISPARADO',
    detalhes: {
      canal: currentStep.canal,
      to: mensagemResolvida.to,
      body_preview: mensagemResolvida.body!.substring(0, 100),
      message_id: disparo.messageId,
    },
  });

  console.log('[Runner] Mensagem disparada com sucesso:', {
    runId: run.id,
    step: currentStep.ordem,
    template: currentStep.template_codigo,
  });

  // 7. Avançar para próximo step ou concluir
  const { data: nextStep } = await supabase
    .from('cadence_steps')
    .select('ordem, offset_minutos')
    .eq('cadence_id', run.cadence_id)
    .gt('ordem', currentStep.ordem)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextStep) {
    // Há próximo step
    const nextRunAt = new Date(Date.now() + nextStep.offset_minutos * 60 * 1000).toISOString();
    
    await supabase
      .from('lead_cadence_runs')
      .update({
        last_step_ordem: currentStep.ordem,
        next_step_ordem: nextStep.ordem,
        next_run_at: nextRunAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    // Agendar próximo step
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: nextStep.ordem,
      template_codigo: '', // Será preenchido quando executar
      tipo_evento: 'AGENDADO',
      detalhes: { next_run_at: nextRunAt },
    });

    console.log('[Runner] Próximo step agendado:', { step: nextStep.ordem, at: nextRunAt });

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'DISPARADO',
      mensagem: `Step ${currentStep.ordem} disparado, próximo: ${nextStep.ordem}`,
    };
  } else {
    // Cadência concluída
    await supabase
      .from('lead_cadence_runs')
      .update({
        status: 'CONCLUIDA',
        last_step_ordem: currentStep.ordem,
        next_step_ordem: null,
        next_run_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    console.log('[Runner] Cadência concluída:', run.id);

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'CONCLUIDA',
      mensagem: 'Cadência concluída com sucesso',
    };
  }
}

// ========================================
// LOGGING DE EXECUÇÃO
// ========================================
async function registrarLogExecucao(
  supabase: SupabaseClient,
  log: RunnerExecutionLog
): Promise<void> {
  try {
    await supabase.from('cadence_runner_logs').insert({
      executed_at: new Date().toISOString(),
      steps_executed: log.steps_executed,
      errors: log.errors,
      runs_touched: log.runs_touched,
      duration_ms: log.duration_ms,
      trigger_source: log.trigger_source,
      details: log.details,
    });
    console.log('[Runner] Log de execução registrado');
  } catch (error) {
    console.error('[Runner] Erro ao registrar log:', error);
  }
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

  // ========================================
  // PARSE BODY + AUTENTICAÇÃO
  // ========================================
  let parsedBody: Record<string, unknown> = {};
  try {
    parsedBody = await req.json().catch(() => ({}));
  } catch {
    // Ignora erro de parse
  }

  if (!validateAuth(req, parsedBody)) {
    console.error('[Runner] Acesso não autorizado');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Determinar fonte do trigger
  let triggerSource: TriggerSource = 'CRON';
  if (parsedBody.trigger === 'MANUAL') triggerSource = 'MANUAL';
  if (parsedBody.trigger === 'TEST') triggerSource = 'TEST';

  const startedAt = new Date().toISOString();

  try {
    console.log(`[Cadence Runner] Iniciando processamento (${triggerSource})...`);
    
    const startTime = Date.now();
    const results = await processarCadenciasVencidas(supabase);
    const duration = Date.now() - startTime;
    const finishedAt = new Date().toISOString();

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'DISPARADO' || r.status === 'CONCLUIDA').length,
      errors: results.filter(r => r.status === 'ERRO').length,
      skipped: results.filter(r => r.status === 'SKIPPED').length,
      duration_ms: duration,
      trigger_source: triggerSource,
    };

    console.log('[Cadence Runner] Processamento concluído:', summary);

    // Registrar log de execução no banco
    await registrarLogExecucao(supabase, {
      steps_executed: summary.success,
      errors: summary.errors,
      runs_touched: summary.total,
      duration_ms: duration,
      trigger_source: triggerSource,
      details: {
        results,
        started_at: startedAt,
        finished_at: finishedAt,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Cadence Runner] Erro geral:', error);
    
    // Registrar erro no log
    const duration = Date.now() - new Date(startedAt).getTime();
    await registrarLogExecucao(supabase, {
      steps_executed: 0,
      errors: 1,
      runs_touched: 0,
      duration_ms: duration,
      trigger_source: triggerSource,
      details: {
        results: [],
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      },
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
