export type ComissaoTipo = 'PERCENTUAL' | 'FIXO' | 'ESCALONADO';
export type ComissaoStatus = 'PENDENTE' | 'APROVADO' | 'PAGO' | 'CANCELADO';

export interface MetaVendedor {
  id: string;
  user_id: string;
  empresa: string;
  ano: number;
  mes: number;
  meta_valor: number;
  meta_deals: number;
  created_at: string;
  updated_at: string;
}

export interface MetaProgresso {
  meta_id: string;
  user_id: string;
  empresa: string;
  ano: number;
  mes: number;
  meta_valor: number;
  meta_deals: number;
  vendedor_nome: string;
  vendedor_avatar: string | null;
  realizado_valor: number;
  realizado_deals: number;
  pct_valor: number;
  pct_deals: number;
  pipeline_aberto: number;
  comissao_mes: number;
}

export interface ComissaoRegra {
  id: string;
  empresa: string;
  pipeline_id: string | null;
  nome: string;
  tipo: ComissaoTipo;
  percentual: number | null;
  valor_fixo: number | null;
  escalas: { ate: number | null; percentual: number }[] | null;
  valor_minimo_deal: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComissaoLancamento {
  id: string;
  deal_id: string;
  user_id: string;
  regra_id: string;
  empresa: string;
  deal_valor: number;
  comissao_valor: number;
  percentual_aplicado: number | null;
  status: ComissaoStatus;
  aprovado_por: string | null;
  aprovado_em: string | null;
  pago_em: string | null;
  referencia_ano: number;
  referencia_mes: number;
  created_at: string;
  updated_at: string;
  // joined
  deal_titulo?: string;
  vendedor_nome?: string;
  regra_nome?: string;
}

export interface ComissaoResumoMensal {
  user_id: string;
  vendedor_nome: string;
  empresa: string;
  ano: number;
  mes: number;
  pendentes: number;
  aprovados: number;
  pagos: number;
  comissao_total: number;
  valor_pendente: number;
  valor_aprovado: number;
  valor_pago: number;
}

export const MESES_LABEL: Record<number, string> = {
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
  5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
  9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
};
