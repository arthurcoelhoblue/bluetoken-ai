// ========================================
// PATCH 6 - SDR Conversacional Inteligente
// Tipos de Pessoa Global & Multi-Empresa
// ========================================

// Tipo de relacionamento por empresa
export type PessoaRelacaoTipo =
  | 'CLIENTE_IR'        // Blue: já é cliente de IR
  | 'LEAD_IR'           // Blue: lead de IR
  | 'INVESTIDOR'        // Tokeniza: já investiu
  | 'LEAD_INVESTIDOR'   // Tokeniza: lead de investimento
  | 'DESCONHECIDO';     // Sem histórico

// Perfil DISC
export type PerfilDISC = 'D' | 'I' | 'S' | 'C';

// Entidade global da pessoa
export interface Pessoa {
  id: string;
  nome: string;
  telefone_e164?: string | null;
  telefone_base?: string | null;  // Últimos 8 dígitos (sem o 9º)
  ddd?: string | null;
  email_principal?: string | null;
  idioma_preferido: 'PT' | 'EN' | 'ES';
  perfil_disc?: PerfilDISC | null;
  created_at: string;
  updated_at: string;
}

// Resumo de relacionamento por empresa
export interface EmpresaRelacionamentoResumo {
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  tipo_relacao: PessoaRelacaoTipo;
  ultima_interacao_em?: string | null;
  total_mensagens?: number;
  // Dados específicos
  ticket_medio?: number | null;         // Blue
  valor_investido?: number | null;      // Tokeniza
  qtd_investimentos?: number | null;    // Tokeniza
  status_cliente?: string | null;       // Status geral
}

// Contexto completo da pessoa para o SDR IA
export interface PessoaContext {
  pessoa: Pessoa;
  relacionamentos: EmpresaRelacionamentoResumo[];
}

// Labels para tipos de relação
export const RELACAO_LABELS: Record<PessoaRelacaoTipo, string> = {
  CLIENTE_IR: 'Cliente IR',
  LEAD_IR: 'Lead IR',
  INVESTIDOR: 'Investidor',
  LEAD_INVESTIDOR: 'Lead Investidor',
  DESCONHECIDO: 'Desconhecido',
};

// Cores para badges de relação
export const RELACAO_COLORS: Record<PessoaRelacaoTipo, string> = {
  CLIENTE_IR: 'bg-green-100 text-green-800',
  LEAD_IR: 'bg-blue-100 text-blue-800',
  INVESTIDOR: 'bg-emerald-100 text-emerald-800',
  LEAD_INVESTIDOR: 'bg-cyan-100 text-cyan-800',
  DESCONHECIDO: 'bg-gray-100 text-gray-800',
};

// Labels para perfil DISC
export const DISC_LABELS: Record<PerfilDISC, { nome: string; tom: string; descricao: string }> = {
  D: {
    nome: 'Dominante',
    tom: 'Seja direto e objetivo',
    descricao: 'Focado em resultados, decisivo, gosta de controle',
  },
  I: {
    nome: 'Influente',
    tom: 'Seja amigável e entusiasta',
    descricao: 'Comunicativo, otimista, gosta de interação social',
  },
  S: {
    nome: 'Estável',
    tom: 'Seja paciente e acolhedor',
    descricao: 'Confiável, paciente, valoriza harmonia',
  },
  C: {
    nome: 'Cauteloso',
    tom: 'Traga dados e estrutura',
    descricao: 'Analítico, preciso, orientado a detalhes',
  },
};

// Cores para perfil DISC
export const DISC_COLORS: Record<PerfilDISC, string> = {
  D: 'bg-red-100 text-red-800',
  I: 'bg-yellow-100 text-yellow-800',
  S: 'bg-green-100 text-green-800',
  C: 'bg-blue-100 text-blue-800',
};

// Função helper para formatar telefone para exibição
export function formatPhoneDisplay(telefone_e164: string | null | undefined): string {
  if (!telefone_e164) return 'Não informado';
  
  // Remove o + e formata como (XX) XXXXX-XXXX
  const digits = telefone_e164.replace(/\D/g, '');
  
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `(${ddd}) ${part1}-${part2}`;
  }
  
  return telefone_e164;
}

// Função helper para determinar tipo de relação
export function determineRelacaoTipo(
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA',
  dados: {
    tokeniza_investor_id?: string | null;
    blue_client_id?: string | null;
    valor_investido?: number;
    qtd_compras_ir?: number;
  }
): PessoaRelacaoTipo {
  if (empresa === 'BLUE') {
    if (dados.blue_client_id || (dados.qtd_compras_ir && dados.qtd_compras_ir > 0)) {
      return 'CLIENTE_IR';
    }
    return 'LEAD_IR';
  }
  
  if (empresa === 'TOKENIZA') {
    if (dados.tokeniza_investor_id || (dados.valor_investido && dados.valor_investido > 0)) {
      return 'INVESTIDOR';
    }
    return 'LEAD_INVESTIDOR';
  }
  
  return 'DESCONHECIDO';
}
