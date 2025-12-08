import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================================
// PATCH 5A - Cadence Runner
// Motor de execução de cadências
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
  status: 'DISPARADO' | 'ERRO' | 'CONCLUIDA';
  mensagem?: string;
  erro?: string;
}

// ========================================
// RESOLUÇÃO DE TEMPLATE
// ========================================
function resolverPlaceholders(template: string, context: {
  nome: string;
  primeiro_nome: string;
  email: string;
  empresa: string;
}): string {
  let resultado = template;
  
  resultado = resultado.replace(/\{\{nome\}\}/g, context.nome || 'você');
  resultado = resultado.replace(/\{\{primeiro_nome\}\}/g, context.primeiro_nome || 'você');
  resultado = resultado.replace(/\{\{email\}\}/g, context.email || '');
  resultado = resultado.replace(/\{\{empresa\}\}/g, 
    context.empresa === 'TOKENIZA' ? 'Tokeniza' : 'Blue Consult'
  );
  
  return resultado;
}

async function resolverMensagem(
  supabase: SupabaseClient,
  empresa: EmpresaTipo,
  templateCodigo: string,
  canal: CanalTipo,
  contact: LeadContact
): Promise<{ success: boolean; body?: string; to?: string; error?: string }> {
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

  // Resolver placeholders
  const body = resolverPlaceholders(template.conteudo, {
    nome: contact.nome || 'você',
    primeiro_nome: contact.primeiro_nome || contact.nome?.split(' ')[0] || 'você',
    email: contact.email || '',
    empresa: empresa,
  });

  return { success: true, body, to };
}

// ========================================
// DISPARO DE MENSAGEM (MOCK)
// ========================================
async function dispararMensagem(
  canal: CanalTipo,
  to: string,
  body: string,
  _leadId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[Disparo] Enviando mensagem:', { canal, to: to.substring(0, 5) + '***', bodyPreview: body.substring(0, 50) });

  // TODO PATCH 5B: Integrar com API real de WhatsApp/Email
  // Por enquanto, apenas loga e simula sucesso
  
  if (canal === 'WHATSAPP') {
    // Mock: Simula envio via WhatsApp
    console.log('[Disparo] [MOCK] WhatsApp enviado para:', to);
    // await enviarWhatsAppMensagem(to, body);
  } else if (canal === 'EMAIL') {
    // Mock: Simula envio via Email
    console.log('[Disparo] [MOCK] Email enviado para:', to);
    // await enviarEmailTransacional(to, 'Assunto', body);
  }

  // Simula 5% de erro para testes
  if (Math.random() < 0.05) {
    return { success: false, error: 'Erro simulado para teste' };
  }

  return { success: true };
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
    .limit(50); // Processa em lotes

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
    .update({ next_run_at: lockTime })
    .eq('id', run.id)
    .eq('next_run_at', run.next_run_at) // Lock otimista
    .select()
    .maybeSingle();

  if (lockError || !locked) {
    console.log('[Runner] Run já sendo processada por outra instância:', run.id);
    return {
      runId: run.id,
      leadId: run.lead_id,
      stepOrdem: run.next_step_ordem || 0,
      templateCodigo: '',
      status: 'ERRO',
      erro: 'Run em processamento por outra instância',
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
      .update({ next_run_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) // +30min
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
      .update({ next_run_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
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
    currentStep.canal,
    mensagemResolvida.to!,
    mensagemResolvida.body!,
    run.lead_id
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
      .update({ next_run_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
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
    console.log('[Cadence Runner] Iniciando processamento...');
    
    const startTime = Date.now();
    const results = await processarCadenciasVencidas(supabase);
    const duration = Date.now() - startTime;

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'DISPARADO' || r.status === 'CONCLUIDA').length,
      errors: results.filter(r => r.status === 'ERRO').length,
      duration_ms: duration,
    };

    console.log('[Cadence Runner] Processamento concluído:', summary);

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
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
