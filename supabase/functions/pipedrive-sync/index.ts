import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getWebhookCorsHeaders } from "../_shared/cors.ts";
import { getOptionalEnv } from "../_shared/config.ts";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = getWebhookCorsHeaders();
const log = createLogger('pipedrive-sync');

// Pipedrive API base URL
const PIPEDRIVE_API_BASE = 'https://grupoblue.pipedrive.com/api/v1';

// ========================================
// TIPOS
// ========================================

type PipedriveSyncAction = 
  | 'add_note'
  | 'add_activity'
  | 'update_stage'
  | 'log_conversation';

type EmpresaTipo = 'TOKENIZA' | 'BLUE';
type TemperaturaTipo = 'FRIO' | 'MORNO' | 'QUENTE';

interface PipedriveSyncRequest {
  action: PipedriveSyncAction;
  deal_id: string;
  lead_id?: string;
  empresa?: EmpresaTipo;
  data: {
    content?: string;
    activity_type?: 'call' | 'meeting' | 'task' | 'email';
    subject?: string;
    due_date?: string;
    due_time?: string;
    note?: string;
    stage_id?: number;
    classification?: {
      icp?: string;
      persona?: string;
      temperatura?: TemperaturaTipo;
      prioridade?: number;
      score_interno?: number;
    };
    messages?: Array<{
      direcao: 'INBOUND' | 'OUTBOUND';
      conteudo: string;
      created_at: string;
    }>;
    intent?: string;
    acao_aplicada?: string;
  };
}

interface PipedriveResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/** Escape user-controlled strings before embedding in HTML */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNoteContent(
  tipo: string,
  content: string,
  classification?: PipedriveSyncRequest['data']['classification']
): string {
  let html = `<p><strong>🤖 SDR IA - ${escapeHtml(tipo)}</strong></p>`;
  
  if (classification) {
    html += `<p><strong>Classificação:</strong></p><ul>`;
    if (classification.icp) html += `<li>ICP: ${escapeHtml(classification.icp)}</li>`;
    if (classification.persona) html += `<li>Persona: ${escapeHtml(classification.persona)}</li>`;
    if (classification.temperatura) html += `<li>Temperatura: ${escapeHtml(classification.temperatura)}</li>`;
    if (classification.prioridade) html += `<li>Prioridade: ${classification.prioridade}</li>`;
    if (classification.score_interno) html += `<li>Score Interno: ${classification.score_interno}</li>`;
    html += `</ul>`;
  }
  
  html += `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
  html += `<p><em>Gerado em: ${new Date().toLocaleString('pt-BR')}</em></p>`;
  
  return html;
}

function formatConversationNote(
  messages: PipedriveSyncRequest['data']['messages'],
  intent?: string,
  acao?: string
): string {
  let html = `<p><strong>📱 WhatsApp - Conversa SDR IA</strong></p>`;
  
  if (intent) html += `<p><strong>Intenção detectada:</strong> ${escapeHtml(intent)}</p>`;
  if (acao) html += `<p><strong>Ação aplicada:</strong> ${escapeHtml(acao)}</p>`;
  
  if (messages && messages.length > 0) {
    html += `<hr>`;
    messages.forEach(msg => {
      const label = msg.direcao === 'INBOUND' ? '👤 Lead' : '🤖 SDR';
      const time = new Date(msg.created_at).toLocaleTimeString('pt-BR');
      html += `<p><strong>${label} (${time}):</strong><br>${escapeHtml(msg.conteudo)}</p>`;
    });
  }
  
  html += `<hr><p><em>Sincronizado em: ${new Date().toLocaleString('pt-BR')}</em></p>`;
  return html;
}

async function callPipedriveAPI(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>
): Promise<PipedriveResponse> {
  const apiToken = getOptionalEnv('PIPEDRIVE_API_TOKEN');
  if (!apiToken) {
    log.error('PIPEDRIVE_API_TOKEN não configurado');
    return { success: false, error: 'PIPEDRIVE_API_TOKEN não configurado' };
  }

  const url = `${PIPEDRIVE_API_BASE}${endpoint}?api_token=${apiToken}`;
  log.info('Chamando API', { endpoint, method });

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      log.error('Erro na API', { endpoint, error: data.error || `HTTP ${response.status}` });
      return { success: false, error: data.error || `HTTP ${response.status}`, data };
    }

    log.info('Sucesso', { endpoint, dataId: data.data?.id });
    return { success: true, data: data.data };
  } catch (error) {
    log.error('Erro na requisição', { endpoint, error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function addNote(dealId: string, content: string, classification?: PipedriveSyncRequest['data']['classification']): Promise<PipedriveResponse> {
  return callPipedriveAPI('/notes', 'POST', { deal_id: parseInt(dealId), content: formatNoteContent('Atualização', content, classification), pinned_to_deal_flag: true });
}

async function addActivity(dealId: string, type: string, subject: string, options?: { due_date?: string; due_time?: string; note?: string }): Promise<PipedriveResponse> {
  return callPipedriveAPI('/activities', 'POST', { deal_id: parseInt(dealId), type, subject, due_date: options?.due_date || new Date().toISOString().split('T')[0], due_time: options?.due_time || '09:00', note: options?.note || 'Criado automaticamente pelo SDR IA', done: 0 });
}

async function updateStage(dealId: string, stageId: number): Promise<PipedriveResponse> {
  return callPipedriveAPI(`/deals/${dealId}`, 'PUT', { stage_id: stageId });
}

async function logConversation(dealId: string, messages: PipedriveSyncRequest['data']['messages'], intent?: string, acao?: string): Promise<PipedriveResponse> {
  return callPipedriveAPI('/notes', 'POST', { deal_id: parseInt(dealId), content: formatConversationNote(messages, intent, acao) });
}

// ========================================
// Handler Principal
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const request: PipedriveSyncRequest = await req.json();
    log.info('Requisição recebida', { action: request.action, deal_id: request.deal_id });

    if (!request.deal_id) return new Response(JSON.stringify({ error: 'deal_id é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!request.action) return new Response(JSON.stringify({ error: 'action é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let result: PipedriveResponse;

    switch (request.action) {
      case 'add_note':
        if (!request.data.content) return new Response(JSON.stringify({ error: 'data.content é obrigatório para add_note' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await addNote(request.deal_id, request.data.content, request.data.classification);
        break;
      case 'add_activity':
        if (!request.data.activity_type || !request.data.subject) return new Response(JSON.stringify({ error: 'data.activity_type e data.subject são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await addActivity(request.deal_id, request.data.activity_type, request.data.subject, { due_date: request.data.due_date, due_time: request.data.due_time, note: request.data.note });
        break;
      case 'update_stage':
        if (!request.data.stage_id) return new Response(JSON.stringify({ error: 'data.stage_id é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await updateStage(request.deal_id, request.data.stage_id);
        break;
      case 'log_conversation':
        result = await logConversation(request.deal_id, request.data.messages, request.data.intent, request.data.acao_aplicada);
        break;
      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${request.action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!result.success) {
      log.error('Falha na ação', { action: request.action, error: result.error });
      return new Response(JSON.stringify({ success: false, error: result.error, action: request.action, deal_id: request.deal_id }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, action: request.action, deal_id: request.deal_id, pipedrive_response: result.data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    log.error('Erro geral', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Erro desconhecido' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
