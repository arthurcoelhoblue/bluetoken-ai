// Amelia Learning System types

export type AmeliaLearningTipo =
  | 'PADRAO_TAKEOVER'
  | 'CORRECAO_CLASSIFICACAO'
  | 'PADRAO_PERDA'
  | 'RESPOSTA_HUMANA'
  | 'COMPORTAMENTO_DEAL'
  | 'ALERTA_CRITICO'
  | 'SEQUENCIA_PERDA'
  | 'SEQUENCIA_CHURN'
  | 'SEQUENCIA_SUCESSO';

export type AmeliaLearningCategoria =
  | 'classificacao'
  | 'conversacao'
  | 'pipeline'
  | 'compliance'
  | 'sequencia';

export type AmeliaLearningStatus = 'PENDENTE' | 'VALIDADO' | 'REJEITADO';

export type AmeliaNotificacaoTipo =
  | 'AMELIA_INSIGHT'
  | 'AMELIA_ALERTA'
  | 'AMELIA_CORRECAO'
  | 'AMELIA_SEQUENCIA';

export interface AmeliaLearning {
  id: string;
  empresa: string;
  tipo: AmeliaLearningTipo;
  categoria: AmeliaLearningCategoria;
  titulo: string;
  descricao: string;
  dados: Record<string, unknown>;
  confianca: number;
  status: AmeliaLearningStatus;
  validado_por: string | null;
  validado_em: string | null;
  aplicado: boolean;
  sequencia_eventos: string[] | null;
  sequencia_match_pct: number | null;
  sequencia_janela_dias: number | null;
  hash_titulo: string | null;
  created_at: string;
  updated_at: string;
}

export const LEARNING_TIPO_LABELS: Record<AmeliaLearningTipo, string> = {
  PADRAO_TAKEOVER: '🔄 Padrão Takeover',
  CORRECAO_CLASSIFICACAO: '🏷️ Correção Classificação',
  PADRAO_PERDA: '📉 Padrão de Perda',
  RESPOSTA_HUMANA: '💬 Resposta Humana',
  COMPORTAMENTO_DEAL: '📊 Comportamento Deal',
  ALERTA_CRITICO: '🚨 Alerta Crítico',
  SEQUENCIA_PERDA: '⛓️ Sequência de Perda',
  SEQUENCIA_CHURN: '🔗 Sequência de Churn',
  SEQUENCIA_SUCESSO: '✅ Sequência de Sucesso',
};

export const LEARNING_STATUS_LABELS: Record<AmeliaLearningStatus, string> = {
  PENDENTE: 'Pendente',
  VALIDADO: 'Validado',
  REJEITADO: 'Rejeitado',
};
