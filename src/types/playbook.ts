// ========================================
// Playbook de Vendas — Types
// ========================================

import type { EmpresaTipo, CanalTipo } from '@/types/enums';

// ── Enums ──────────────────────────────────────

export type PlaybookStepTipo = 'MENSAGEM_AUTO' | 'MENSAGEM_MANUAL' | 'LIGACAO' | 'REUNIAO' | 'TAREFA';
export type PlaybookExecutor = 'IA' | 'HUMANO';
export type PlaybookRunStatus = 'ATIVA' | 'CONCLUIDA' | 'PAUSADA' | 'CANCELADA' | 'AGUARDANDO_HUMANO';
export type PlaybookEventoTipo =
  | 'AGENDADO' | 'EXECUTADO' | 'PULADO' | 'ATRASADO'
  | 'FALLBACK_IA' | 'PAUSADO' | 'RETOMADO' | 'CANCELADO' | 'ESCALADO';

// ── Labels ─────────────────────────────────────

export const STEP_TIPO_LABELS: Record<PlaybookStepTipo, string> = {
  MENSAGEM_AUTO: 'Mensagem Automática (IA)',
  MENSAGEM_MANUAL: 'Mensagem Manual',
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  TAREFA: 'Tarefa',
};

export const EXECUTOR_LABELS: Record<PlaybookExecutor, string> = {
  IA: 'IA',
  HUMANO: 'Humano',
};

export const RUN_STATUS_LABELS: Record<PlaybookRunStatus, string> = {
  ATIVA: 'Ativa',
  CONCLUIDA: 'Concluída',
  PAUSADA: 'Pausada',
  CANCELADA: 'Cancelada',
  AGUARDANDO_HUMANO: 'Aguardando Humano',
};

export const EVENTO_TIPO_LABELS: Record<PlaybookEventoTipo, string> = {
  AGENDADO: 'Agendado',
  EXECUTADO: 'Executado',
  PULADO: 'Pulado',
  ATRASADO: 'Atrasado',
  FALLBACK_IA: 'Fallback IA',
  PAUSADO: 'Pausado',
  RETOMADO: 'Retomado',
  CANCELADO: 'Cancelado',
  ESCALADO: 'Escalado',
};

// ── Mapping step tipo → executor ───────────────

export const STEP_TIPO_EXECUTOR: Record<PlaybookStepTipo, PlaybookExecutor> = {
  MENSAGEM_AUTO: 'IA',
  MENSAGEM_MANUAL: 'HUMANO',
  LIGACAO: 'HUMANO',
  REUNIAO: 'HUMANO',
  TAREFA: 'HUMANO',
};

// ── Entities ───────────────────────────────────

export interface Playbook {
  id: string;
  empresa: EmpresaTipo;
  nome: string;
  descricao: string | null;
  pipeline_id: string | null;
  versao: number;
  parent_id: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaybookStep {
  id: string;
  playbook_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  tipo: PlaybookStepTipo;
  executor: PlaybookExecutor;
  canal: CanalTipo | null;
  offset_dias: number;
  offset_horas: number;
  duracao_estimada_min: number | null;
  fallback_habilitado: boolean;
  fallback_offset_horas: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DealPlaybookRun {
  id: string;
  deal_id: string;
  playbook_id: string;
  status: PlaybookRunStatus;
  current_step_ordem: number;
  next_step_at: string | null;
  owner_id: string | null;
  started_at: string;
  completed_at: string | null;
  locked_until: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DealPlaybookEvent {
  id: string;
  run_id: string;
  step_ordem: number;
  tipo_evento: PlaybookEventoTipo;
  descricao: string | null;
  notas_vendedor: string | null;
  resultado: string | null;
  ai_response: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── With Relations ─────────────────────────────

export interface PlaybookWithStats extends Playbook {
  total_runs: number;
  runs_ativas: number;
  runs_aguardando: number;
  runs_concluidas: number;
  runs_canceladas: number;
  tempo_medio_ciclo_dias: number | null;
  total_steps?: number;
}

export interface PlaybookRunWithDetails extends DealPlaybookRun {
  playbook_nome?: string;
  playbook_versao?: number;
  deal_titulo?: string;
  owner_nome?: string;
  total_steps?: number;
  steps_concluidos?: number;
}

export interface PlaybookEventWithStep extends DealPlaybookEvent {
  step_titulo?: string;
  step_tipo?: PlaybookStepTipo;
  step_executor?: PlaybookExecutor;
}

// ── Filters ────────────────────────────────────

export interface PlaybooksFilters {
  empresa?: EmpresaTipo;
  ativo?: boolean;
  pipeline_id?: string;
  searchTerm?: string;
}

export interface PlaybookRunsFilters {
  empresa?: EmpresaTipo;
  playbook_id?: string;
  status?: PlaybookRunStatus;
  owner_id?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Helpers ────────────────────────────────────

export function formatStepOffset(dias: number, horas: number): string {
  if (dias === 0 && horas === 0) return 'Imediato';
  const parts: string[] = [];
  if (dias > 0) parts.push(`${dias}d`);
  if (horas > 0) parts.push(`${horas}h`);
  return '+' + parts.join(' ');
}

export function getRunStatusColor(status: PlaybookRunStatus): string {
  switch (status) {
    case 'ATIVA':
      return 'bg-success text-success-foreground';
    case 'CONCLUIDA':
      return 'bg-primary text-primary-foreground';
    case 'PAUSADA':
      return 'bg-warning text-warning-foreground';
    case 'CANCELADA':
      return 'bg-destructive text-destructive-foreground';
    case 'AGUARDANDO_HUMANO':
      return 'bg-accent text-accent-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getStepIcon(tipo: PlaybookStepTipo): string {
  switch (tipo) {
    case 'MENSAGEM_AUTO': return '🤖';
    case 'MENSAGEM_MANUAL': return '💬';
    case 'LIGACAO': return '📞';
    case 'REUNIAO': return '📅';
    case 'TAREFA': return '✅';
    default: return '📌';
  }
}

export function getEventIcon(tipo: PlaybookEventoTipo): string {
  switch (tipo) {
    case 'AGENDADO': return '📅';
    case 'EXECUTADO': return '✅';
    case 'PULADO': return '⏭️';
    case 'ATRASADO': return '⏰';
    case 'FALLBACK_IA': return '🤖';
    case 'PAUSADO': return '⏸️';
    case 'RETOMADO': return '▶️';
    case 'CANCELADO': return '❌';
    case 'ESCALADO': return '🚨';
    default: return '📌';
  }
}

/** Calcula o progresso do playbook como percentual (0-100) */
export function calcProgress(currentStep: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.min(100, Math.round(((currentStep - 1) / totalSteps) * 100));
}
