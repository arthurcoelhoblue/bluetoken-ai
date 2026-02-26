// ========================================
// PATCH 5A/5B - Tipos de Mensageria
// ========================================

import type { CanalTipo, EmpresaTipo } from './cadence';

// ========================================
// PATCH 5B - Log Centralizado de Mensagens
// ========================================

// Direção da mensagem
export type MensagemDirecao = 'OUTBOUND' | 'INBOUND';

// Estado da mensagem
export type MensagemEstado = 
  | 'PENDENTE' 
  | 'ENVIADO' 
  | 'ENTREGUE' 
  | 'LIDO' 
  | 'ERRO' 
  | 'RECEBIDO';

// Tipo de mídia
export type TipoMidia = 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contacts';

// Mensagem do lead (log centralizado)
export interface LeadMessage {
  id: string;
  lead_id: string | null;
  empresa: EmpresaTipo;
  run_id: string | null;
  step_ordem: number | null;
  canal: CanalTipo;
  direcao: MensagemDirecao;
  template_codigo: string | null;
  conteudo: string;
  estado: MensagemEstado;
  erro_detalhe: string | null;
  whatsapp_message_id: string | null;
  email_message_id: string | null;
  created_at: string;
  updated_at: string;
  enviado_em: string | null;
  entregue_em: string | null;
  lido_em: string | null;
  // Media fields
  tipo_midia: TipoMidia;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_caption: string | null;
  media_meta_id: string | null;
}

// Mensagem com contexto (para UI)
export interface LeadMessageWithContext extends LeadMessage {
  template_nome?: string;
  cadencia_nome?: string;
  // Flag para mensagens INBOUND não associadas ao lead
  unmatched?: boolean;
}

// Parâmetros para criar mensagem outbound
export interface LogOutboundParams {
  lead_id: string;
  empresa: EmpresaTipo;
  canal: CanalTipo;
  conteudo: string;
  template_codigo?: string;
  run_id?: string;
  step_ordem?: number;
}

// Parâmetros para criar mensagem inbound
export interface LogInboundParams {
  lead_id: string;
  empresa: EmpresaTipo;
  canal: CanalTipo;
  conteudo: string;
  whatsapp_message_id?: string;
  email_message_id?: string;
}

// Parâmetros para atualizar status
export interface UpdateMessageStatusParams {
  estado: MensagemEstado;
  erro_detalhe?: string;
  whatsapp_message_id?: string;
  email_message_id?: string;
  enviado_em?: string;
  entregue_em?: string;
  lido_em?: string;
}

// Constantes
export const MENSAGEM_DIRECOES: MensagemDirecao[] = ['OUTBOUND', 'INBOUND'];
export const MENSAGEM_ESTADOS: MensagemEstado[] = [
  'PENDENTE', 'ENVIADO', 'ENTREGUE', 'LIDO', 'ERRO', 'RECEBIDO'
];

// Utilitários
export function getEstadoColor(estado: MensagemEstado): string {
  const colors: Record<MensagemEstado, string> = {
    PENDENTE: 'bg-yellow-100 text-yellow-800',
    ENVIADO: 'bg-blue-100 text-blue-800',
    ENTREGUE: 'bg-green-100 text-green-800',
    LIDO: 'bg-emerald-100 text-emerald-800',
    ERRO: 'bg-red-100 text-red-800',
    RECEBIDO: 'bg-purple-100 text-purple-800',
  };
  return colors[estado];
}

export function getDirecaoIcon(direcao: MensagemDirecao): string {
  return direcao === 'OUTBOUND' ? '📤' : '📥';
}

// ========================================
// PATCH 5A - Tipos originais
// ========================================

// Template de mensagem
export interface MessageTemplate {
  id: string;
  empresa: EmpresaTipo;
  canal: CanalTipo;
  codigo: string;
  nome: string;
  descricao: string | null;
  conteudo: string;
  ativo: boolean;
  assunto_template: string | null;
  meta_template_id: string | null;
  meta_status: string;
  meta_category: string | null;
  meta_language: string;
  meta_components: unknown | null;
  meta_rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Contato do lead (cache local)
export interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  primeiro_nome: string | null;
  created_at: string;
  updated_at: string;
}

// Contexto para resolver template
export interface TemplateContext {
  nome: string;
  primeiro_nome: string;
  email: string;
  telefone: string | null;
  empresa: EmpresaTipo;
  lead_id: string;
  // Campos extras para futuro
  oferta_nome?: string;
  prazo?: string;
}

// Mensagem resolvida pronta para disparo
export interface ResolvedMessage {
  canal: CanalTipo;
  to: string;
  body: string;
  templateCodigo: string;
}

// Resultado do processamento de cadência
export interface CadenceProcessResult {
  runId: string;
  leadId: string;
  stepOrdem: number;
  templateCodigo: string;
  status: 'DISPARADO' | 'ERRO' | 'CONCLUIDA';
  mensagem?: string;
  erro?: string;
}

// Resultado do runner
export interface CadenceRunnerResult {
  processed: CadenceProcessResult[];
  total: number;
  success: number;
  errors: number;
  skipped: number;
}
