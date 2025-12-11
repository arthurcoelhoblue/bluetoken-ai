// ========================================
// PATCH 5G-B - Tipos de Intenção e Ações SDR IA
// Evolução com resposta automática e compliance
// ========================================

import type { EmpresaTipo } from './sgt';

// Tipos de intenção detectáveis pela IA (expandido 5G-B)
export type LeadIntentTipo =
  | 'INTERESSE_COMPRA'
  | 'INTERESSE_IR'        // NOVO: Interesse específico em IR (BLUE)
  | 'DUVIDA_PRODUTO'
  | 'DUVIDA_PRECO'
  | 'DUVIDA_TECNICA'      // NOVO: Pergunta técnica específica
  | 'SOLICITACAO_CONTATO'
  | 'AGENDAMENTO_REUNIAO'
  | 'RECLAMACAO'
  | 'OPT_OUT'
  | 'OBJECAO_PRECO'       // NOVO: Acha caro/não compensa
  | 'OBJECAO_RISCO'       // NOVO: Medo de perda (TOKENIZA)
  | 'SEM_INTERESSE'       // NOVO: Não quer, mas sem opt-out
  | 'NAO_ENTENDI'
  | 'CUMPRIMENTO'
  | 'AGRADECIMENTO'
  | 'FORA_CONTEXTO'
  | 'OUTRO';

// Tipos de ação que a IA pode recomendar (expandido 5G-B)
export type SdrAcaoTipo =
  | 'PAUSAR_CADENCIA'
  | 'CANCELAR_CADENCIA'
  | 'RETOMAR_CADENCIA'
  | 'AJUSTAR_TEMPERATURA'
  | 'CRIAR_TAREFA_CLOSER'
  | 'MARCAR_OPT_OUT'
  | 'NENHUMA'
  | 'ESCALAR_HUMANO'
  | 'ENVIAR_RESPOSTA_AUTOMATICA'
  | 'HANDOFF_EMPRESA';  // Transferência entre empresas

// Labels para exibição
export const INTENT_LABELS: Record<LeadIntentTipo, string> = {
  INTERESSE_COMPRA: 'Interesse em Compra',
  INTERESSE_IR: 'Interesse em IR',
  DUVIDA_PRODUTO: 'Dúvida sobre Produto',
  DUVIDA_PRECO: 'Dúvida sobre Preço',
  DUVIDA_TECNICA: 'Dúvida Técnica',
  SOLICITACAO_CONTATO: 'Solicitação de Contato',
  AGENDAMENTO_REUNIAO: 'Agendamento de Reunião',
  RECLAMACAO: 'Reclamação',
  OPT_OUT: 'Opt-out (Descadastrar)',
  OBJECAO_PRECO: 'Objeção de Preço',
  OBJECAO_RISCO: 'Objeção de Risco',
  SEM_INTERESSE: 'Sem Interesse',
  NAO_ENTENDI: 'Não Entendi',
  CUMPRIMENTO: 'Cumprimento',
  AGRADECIMENTO: 'Agradecimento',
  FORA_CONTEXTO: 'Fora de Contexto',
  OUTRO: 'Outro',
};

export const ACAO_LABELS: Record<SdrAcaoTipo, string> = {
  PAUSAR_CADENCIA: 'Pausar Cadência',
  CANCELAR_CADENCIA: 'Cancelar Cadência',
  RETOMAR_CADENCIA: 'Retomar Cadência',
  AJUSTAR_TEMPERATURA: 'Ajustar Temperatura',
  CRIAR_TAREFA_CLOSER: 'Criar Tarefa para Closer',
  MARCAR_OPT_OUT: 'Marcar Opt-out',
  NENHUMA: 'Nenhuma Ação',
  ESCALAR_HUMANO: 'Escalar para Humano',
  ENVIAR_RESPOSTA_AUTOMATICA: 'Resposta Automática',
  HANDOFF_EMPRESA: 'Transferir para outra Empresa',
};

// Interface da interpretação de mensagem (expandida 5G-B)
export interface LeadMessageIntent {
  id: string;
  message_id: string;
  lead_id: string | null;
  run_id: string | null;
  empresa: EmpresaTipo;
  intent: LeadIntentTipo;
  intent_confidence: number;
  intent_summary: string | null;
  acao_recomendada: SdrAcaoTipo;
  acao_aplicada: boolean;
  acao_detalhes: Record<string, unknown> | null;
  modelo_ia: string | null;
  tokens_usados: number | null;
  tempo_processamento_ms: number | null;
  created_at: string;
  // PATCH 5G-B: Novos campos para resposta automática
  resposta_automatica_texto: string | null;
  resposta_enviada_em: string | null;
}

// Resultado da interpretação da IA
export interface InterpretacaoResultado {
  intent: LeadIntentTipo;
  confidence: number;
  summary: string;
  acao: SdrAcaoTipo;
  acao_detalhes?: Record<string, unknown>;
  // PATCH 5G-B
  deve_responder?: boolean;
  resposta_sugerida?: string | null;
}

// Contexto para interpretação
export interface InterpretacaoContexto {
  mensagem: string;
  historico_mensagens?: Array<{
    direcao: 'INBOUND' | 'OUTBOUND';
    conteudo: string;
    created_at: string;
  }>;
  lead_nome?: string;
  lead_email?: string;
  empresa: EmpresaTipo;
  cadencia_nome?: string;
  temperatura_atual?: string;
}

// Helper para cor do intent
export function getIntentColor(intent: LeadIntentTipo): string {
  switch (intent) {
    case 'INTERESSE_COMPRA':
    case 'INTERESSE_IR':
    case 'AGENDAMENTO_REUNIAO':
      return 'bg-success text-success-foreground';
    case 'DUVIDA_PRODUTO':
    case 'DUVIDA_PRECO':
    case 'DUVIDA_TECNICA':
    case 'SOLICITACAO_CONTATO':
      return 'bg-primary text-primary-foreground';
    case 'OPT_OUT':
    case 'RECLAMACAO':
    case 'SEM_INTERESSE':
      return 'bg-destructive text-destructive-foreground';
    case 'OBJECAO_PRECO':
    case 'OBJECAO_RISCO':
    case 'NAO_ENTENDI':
    case 'FORA_CONTEXTO':
      return 'bg-warning text-warning-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Helper para cor da ação
export function getAcaoColor(acao: SdrAcaoTipo): string {
  switch (acao) {
    case 'CRIAR_TAREFA_CLOSER':
    case 'AJUSTAR_TEMPERATURA':
    case 'ENVIAR_RESPOSTA_AUTOMATICA':
      return 'bg-success text-success-foreground';
    case 'PAUSAR_CADENCIA':
      return 'bg-warning text-warning-foreground';
    case 'CANCELAR_CADENCIA':
    case 'MARCAR_OPT_OUT':
      return 'bg-destructive text-destructive-foreground';
    case 'ESCALAR_HUMANO':
    case 'HANDOFF_EMPRESA':
      return 'bg-accent text-accent-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Helper para ícone do intent
export function getIntentIcon(intent: LeadIntentTipo): string {
  switch (intent) {
    case 'INTERESSE_COMPRA':
      return '💰';
    case 'INTERESSE_IR':
      return '📊';
    case 'DUVIDA_PRODUTO':
      return '❓';
    case 'DUVIDA_PRECO':
      return '💵';
    case 'DUVIDA_TECNICA':
      return '🔧';
    case 'SOLICITACAO_CONTATO':
      return '📞';
    case 'AGENDAMENTO_REUNIAO':
      return '📅';
    case 'RECLAMACAO':
      return '😡';
    case 'OPT_OUT':
      return '🚫';
    case 'OBJECAO_PRECO':
      return '💸';
    case 'OBJECAO_RISCO':
      return '⚠️';
    case 'SEM_INTERESSE':
      return '👎';
    case 'NAO_ENTENDI':
      return '🤔';
    case 'CUMPRIMENTO':
      return '👋';
    case 'AGRADECIMENTO':
      return '🙏';
    case 'FORA_CONTEXTO':
      return '🔀';
    case 'OUTRO':
      return '📌';
    default:
      return '💬';
  }
}

// Helper para ícone da ação
export function getAcaoIcon(acao: SdrAcaoTipo): string {
  switch (acao) {
    case 'PAUSAR_CADENCIA':
      return '⏸️';
    case 'CANCELAR_CADENCIA':
      return '⏹️';
    case 'RETOMAR_CADENCIA':
      return '▶️';
    case 'AJUSTAR_TEMPERATURA':
      return '🌡️';
    case 'CRIAR_TAREFA_CLOSER':
      return '📋';
    case 'MARCAR_OPT_OUT':
      return '🚫';
    case 'ESCALAR_HUMANO':
      return '👤';
    case 'ENVIAR_RESPOSTA_AUTOMATICA':
      return '💬';
    case 'HANDOFF_EMPRESA':
      return '🔄';
    case 'NENHUMA':
      return '✅';
    default:
      return '⚙️';
  }
}
