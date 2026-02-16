// ========================================
// bluechat-inbound/types.ts — Tipos locais
// ========================================

import type { EmpresaTipo } from "../_shared/types.ts";

export type ChannelType = 'WHATSAPP' | 'EMAIL' | 'SMS';

export interface BlueChatPayload {
  conversation_id: string;
  ticket_id?: string;
  message_id: string;
  timestamp: string;
  channel: ChannelType;
  contact: {
    phone: string;
    name?: string;
    email?: string;
  };
  message: {
    type: 'text' | 'audio' | 'image' | 'document';
    text: string;
    media_url?: string;
  };
  context?: {
    empresa?: EmpresaTipo;
    tipo_lead?: 'INVESTIDOR' | 'CAPTADOR';
    agent_id?: string;
    tags?: string[];
    history_summary?: string;
  };
}

export interface TriageSummary {
  clienteNome: string | null;
  telefone: string | null;
  email: string | null;
  resumoTriagem: string | null;
  historico: string | null;
  rawSummary: string;
}

export interface LeadContact {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  nome: string | null;
  telefone: string | null;
  telefone_e164: string | null;
  email: string | null;
}

export interface LeadCadenceRun {
  id: string;
  lead_id: string;
  empresa: EmpresaTipo;
  status: string;
}

export interface BlueChatResponse {
  success: boolean;
  conversation_id: string;
  message_id?: string;
  lead_id?: string | null;
  action: 'RESPOND' | 'ESCALATE' | 'QUALIFY_ONLY' | 'RESOLVE';
  response?: {
    text: string;
    suggested_next?: string;
  };
  intent?: {
    detected: string;
    confidence: number;
    lead_ready: boolean;
  };
  escalation?: {
    needed: boolean;
    reason?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    department?: string;
  };
  resolution?: {
    summary: string;
    reason: string;
  };
  error?: string;
}
