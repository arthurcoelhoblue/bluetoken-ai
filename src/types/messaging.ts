// ========================================
// PATCH 5A - Tipos de Mensageria
// ========================================

import type { CanalTipo, EmpresaTipo } from './cadence';

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
