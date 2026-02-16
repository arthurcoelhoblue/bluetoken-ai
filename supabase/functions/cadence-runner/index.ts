import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envConfig, createServiceClient } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";
import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import type { EmpresaTipo, CanalTipo, CadenceRunStatus, LeadCadenceRun } from "../_shared/types.ts";
import { getHorarioBrasilia, isHorarioComercial, proximoHorarioComercial } from "../_shared/business-hours.ts";

const log = createLogger('cadence-runner');
const corsHeaders = getWebhookCorsHeaders();

// ========================================
// TIPOS (locais ao cadence-runner)
// ========================================
type TriggerSource = 'CRON' | 'MANUAL' | 'TEST';

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
  if (body?.source === 'pg_cron' || body?.trigger === 'CRON') {
    log.info('pg_cron/CRON source accepted');
    return true;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    log.warn('Missing Authorization header');
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const anonKey = envConfig.SUPABASE_ANON_KEY;
  
  if (token === serviceRoleKey || token === cronSecret || token === anonKey) {
    log.info('Token válido');
    return true;
  }
  
  log.warn('Invalid token provided');
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
    const supabaseUrl = envConfig.SUPABASE_URL;
    const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/tokeniza-offers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
    });

    if (!response.ok) {
      log.warn('Erro ao buscar ofertas', { status: response.status });
      return null;
    }

    const data = await response.json();
    const ofertasAbertas = data.ofertas?.filter((o: TokenizaOferta) => o.status === 'open') || [];
    
    if (ofertasAbertas.length === 0) {
      log.info('Nenhuma oferta aberta encontrada');
      return null;
    }

    const oferta = ofertasAbertas[0];
    log.info('Oferta ativa encontrada', { nome: oferta.nome });
    return oferta;
  } catch (error) {
    log.error('Erro ao buscar oferta', { error: String(error) });
    return null;
  }
}

// ========================================
// RESOLUÇÃO DE TEMPLATE COM PLACEHOLDERS INTELIGENTES
// ========================================
interface PlaceholderContext {
  nome: string;
  primeiro_nome: string;
  email: string;
  empresa: string;
  oferta?: TokenizaOferta | null;
}

function resolverPlaceholders(template: string, context: PlaceholderContext): string {
  let resultado = template;
  
  resultado = resultado.replace(/\{\{nome\}\}/g, context.nome || 'você');
  resultado = resultado.replace(/\{\{primeiro_nome\}\}/g, context.primeiro_nome || 'você');
  resultado = resultado.replace(/\{\{lead_nome\}\}/g, context.nome || 'você');
  resultado = resultado.replace(/\{\{email\}\}/g, context.email || '');
  resultado = resultado.replace(/\{\{empresa\}\}/g, 
    context.empresa === 'TOKENIZA' ? 'Tokeniza' : 'Blue Consult'
  );
  
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
  log.info('Resolvendo template', { empresa, templateCodigo, canal });

  const { data: template, error: templateError } = await supabase
    .from('message_templates')
    .select('*')
    .eq('empresa', empresa)
    .eq('codigo', templateCodigo)
    .eq('ativo', true)
    .maybeSingle();

  if (templateError || !template) {
    log.error('Template não encontrado', { templateCodigo });
    return { success: false, error: `Template ${templateCodigo} não encontrado ou inativo` };
  }

  if (template.canal !== canal) {
    log.warn('Canal diferente', { templateCanal: template.canal, stepCanal: canal });
  }

  let to: string | null = null;
  if (canal === 'WHATSAPP' || canal === 'SMS') {
    to = contact.telefone;
  } else if (canal === 'EMAIL') {
    to = contact.email;
  }

  if (!to) {
    return { success: false, error: `Contato sem ${canal === 'EMAIL' ? 'email' : 'telefone'}` };
  }

  let oferta: TokenizaOferta | null = null;
  const usaPlaceholdersOferta = template.conteudo.includes('{{oferta_');
  
  if (empresa === 'TOKENIZA' && usaPlaceholdersOferta) {
    log.info('Template usa placeholders de oferta, buscando oferta ativa...');
    oferta = await buscarOfertaAtiva();
  }

  const body = resolverPlaceholders(template.conteudo, {
    nome: contact.nome || 'você',
    primeiro_nome: contact.primeiro_nome || contact.nome?.split(' ')[0] || 'você',
    email: contact.email || '',
    empresa: empresa,
    oferta: oferta,
  });

  if (oferta) {
    log.info('Placeholders resolvidos com oferta', { oferta: oferta.nome });
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
  log.info('Enviando mensagem', { canal, to: to.substring(0, 5) + '***', bodyPreview: body.substring(0, 50) });

  if (canal === 'WHATSAPP') {
    const supabaseUrl = envConfig.SUPABASE_URL;
    const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
    
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
      log.info('Resposta WhatsApp', data);

      if (!data.success) {
        return { success: false, error: data.error || 'Erro no envio WhatsApp' };
      }

      return { success: true, messageId: data.messageId };
    } catch (error) {
      log.error('Erro ao chamar whatsapp-send', { error: String(error) });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  } else if (canal === 'EMAIL') {
    const supabaseCheck = createServiceClient();
    
    const { data: emailSetting } = await supabaseCheck
      .from('system_settings')
      .select('value')
      .eq('category', 'integrations')
      .eq('key', 'email')
      .maybeSingle();
    
    const emailEnabled = (emailSetting?.value as Record<string, unknown>)?.enabled;
    if (!emailEnabled) {
      log.warn('Integração de email desabilitada em system_settings');
      return { success: false, error: 'Integração de email desabilitada. Ative em Configurações > Integrações.' };
    }

    log.info('Enviando email', { to });

    try {
      const supabaseUrl = envConfig.SUPABASE_URL;
      const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

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
      log.info('Resposta Email', data);

      if (!data.success) {
        return { success: false, error: data.error || 'Erro no envio de email' };
      }

      return { success: true, messageId: data.messageId };
    } catch (error) {
      log.error('Erro ao chamar email-send', { error: String(error) });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  } else {
    log.warn('Canal SMS não implementado, marcando como erro');
    return { success: false, error: 'Canal SMS não suportado. Altere o step da cadência para WHATSAPP ou EMAIL.' };
  }
}

// ========================================
// PROCESSAMENTO DE CADÊNCIAS VENCIDAS
// ========================================
async function processarCadenciasVencidas(supabase: SupabaseClient): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const now = new Date().toISOString();

  log.info('Buscando runs vencidas...');

  const { data: runs, error: runsError } = await supabase
    .from('lead_cadence_runs')
    .select('*')
    .eq('status', 'ATIVA')
    .not('next_run_at', 'is', null)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true })
    .limit(100);

  if (runsError) {
    log.error('Erro ao buscar runs', { error: runsError.message });
    throw runsError;
  }

  if (!runs || runs.length === 0) {
    log.info('Nenhuma run vencida encontrada');
    return results;
  }

  log.info('Runs encontradas', { count: runs.length });

  for (const run of runs as LeadCadenceRun[]) {
    try {
      const result = await processarRun(supabase, run);
      results.push(result);
    } catch (error) {
      log.error('Erro ao processar run', { runId: run.id, error: String(error) });
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
  log.info('Processando run', { runId: run.id, leadId: run.lead_id, step: run.next_step_ordem });

  const lockTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const { data: locked, error: lockError } = await supabase
    .from('lead_cadence_runs')
    .update({ next_run_at: lockTime, updated_at: new Date().toISOString() })
    .eq('id', run.id)
    .eq('next_run_at', run.next_run_at)
    .select()
    .maybeSingle();

  if (lockError || !locked) {
    log.info('Run já sendo processada por outra instância', { runId: run.id });
    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: run.next_step_ordem || 0,
      templateCodigo: '',
      status: 'SKIPPED',
      mensagem: 'Run em processamento por outra instância (lock otimista)',
    };
  }

  const { data: step, error: stepError } = await supabase
    .from('cadence_steps')
    .select('*')
    .eq('cadence_id', run.cadence_id)
    .eq('ordem', run.next_step_ordem)
    .single();

  if (stepError || !step) {
    log.error('Step não encontrado', { ordem: run.next_step_ordem });
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

  if (!isHorarioComercial()) {
    const proximoHorario = proximoHorarioComercial();
    log.info('Fora de horário comercial, reagendando', { nextRun: proximoHorario.toISOString() });
    
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

  const { data: convState } = await supabase
    .from('lead_conversation_state')
    .select('modo')
    .eq('lead_id', run.lead_id)
    .eq('empresa', run.empresa)
    .maybeSingle();

  if (convState?.modo === 'MANUAL') {
    log.info('Lead em modo MANUAL, pausando cadência', { runId: run.id });
    
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

  const { data: contact, error: contactError } = await supabase
    .from('lead_contacts')
    .select('*')
    .eq('lead_id', run.lead_id)
    .eq('empresa', run.empresa)
    .maybeSingle();

  if (contactError || !contact) {
    log.error('Contato não encontrado para lead', { leadId: run.lead_id });
    
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'ERRO',
      detalhes: { error: 'Contato do lead não encontrado' },
    });

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

  const mensagemResolvida = await resolverMensagem(
    supabase,
    run.empresa,
    currentStep.template_codigo,
    currentStep.canal,
    contact as LeadContact
  );

  if (!mensagemResolvida.success) {
    log.warn('Mensagem não resolvida (dados incompletos)', { error: mensagemResolvida.error });
    
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'ERRO',
      detalhes: { error: mensagemResolvida.error },
    });

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
    log.error('Erro no disparo', { error: disparo.error });
    
    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: currentStep.ordem,
      template_codigo: currentStep.template_codigo,
      tipo_evento: 'ERRO',
      detalhes: { error: disparo.error, to: mensagemResolvida.to },
    });

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

  log.info('Mensagem disparada com sucesso', {
    runId: run.id,
    step: currentStep.ordem,
    template: currentStep.template_codigo,
  });

  const { data: nextStep } = await supabase
    .from('cadence_steps')
    .select('ordem, offset_minutos')
    .eq('cadence_id', run.cadence_id)
    .gt('ordem', currentStep.ordem)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextStep) {
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

    await supabase.from('lead_cadence_events').insert({
      lead_cadence_run_id: run.id,
      step_ordem: nextStep.ordem,
      template_codigo: '',
      tipo_evento: 'AGENDADO',
      detalhes: { next_run_at: nextRunAt },
    });

    log.info('Próximo step agendado', { step: nextStep.ordem, at: nextRunAt });

    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: currentStep.ordem,
      templateCodigo: currentStep.template_codigo,
      status: 'DISPARADO',
      mensagem: `Step ${currentStep.ordem} disparado, próximo: ${nextStep.ordem}`,
    };
  } else {
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

    log.info('Cadência concluída', { runId: run.id });

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
  execLog: RunnerExecutionLog
): Promise<void> {
  try {
    await supabase.from('cadence_runner_logs').insert({
      executed_at: new Date().toISOString(),
      steps_executed: execLog.steps_executed,
      errors: execLog.errors,
      runs_touched: execLog.runs_touched,
      duration_ms: execLog.duration_ms,
      trigger_source: execLog.trigger_source,
      details: execLog.details,
    });
    log.info('Log de execução registrado');
  } catch (error) {
    log.error('Erro ao registrar log', { error: String(error) });
  }
}

// ========================================
// Handler Principal
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

  let parsedBody: Record<string, unknown> = {};
  try {
    parsedBody = await req.json().catch(() => ({}));
  } catch {
    // Ignora erro de parse
  }

  if (!validateAuth(req, parsedBody)) {
    log.error('Acesso não autorizado');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createServiceClient();

  let triggerSource: TriggerSource = 'CRON';
  if (parsedBody.trigger === 'MANUAL') triggerSource = 'MANUAL';
  if (parsedBody.trigger === 'TEST') triggerSource = 'TEST';

  const startedAt = new Date().toISOString();

  try {
    log.info('Iniciando processamento', { trigger: triggerSource });
    
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

    log.info('Processamento concluído', summary);

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
    log.error('Erro geral', { error: String(error) });
    
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
