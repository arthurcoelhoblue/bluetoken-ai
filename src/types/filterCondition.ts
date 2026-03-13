export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string | number | string[];
}

export type MatchMode = 'all' | 'any';

export interface AdvancedFilterState {
  matchMode: MatchMode;
  conditions: FilterCondition[];
}

export interface SavedFilter {
  id: string;
  user_id: string;
  pipeline_id: string;
  nome: string;
  match_mode: MatchMode;
  conditions: FilterCondition[];
  is_default: boolean;
  created_at: string;
}

export const FILTER_FIELDS = [
  { value: 'valor', label: 'Valor' },
  { value: 'temperatura', label: 'Temperatura' },
  { value: 'owner_id', label: 'Vendedor' },
  { value: 'stage_id', label: 'Etapa' },
  { value: 'etiqueta', label: 'Etiqueta' },
  { value: 'created_at', label: 'Data criação' },
  { value: 'updated_at', label: 'Data atualização' },
  { value: 'score_probabilidade', label: 'Score probabilidade' },
  { value: 'contact_nome', label: 'Contato (nome)' },
  { value: 'origem', label: 'Origem' },
] as const;

export const OPERATORS_BY_FIELD: Record<string, { value: string; label: string }[]> = {
  valor: [
    { value: 'eq', label: 'é igual a' },
    { value: 'gt', label: 'maior que' },
    { value: 'lt', label: 'menor que' },
  ],
  temperatura: [
    { value: 'eq', label: 'é igual a' },
    { value: 'neq', label: 'não é' },
  ],
  owner_id: [
    { value: 'eq', label: 'é igual a' },
    { value: 'neq', label: 'não é' },
  ],
  stage_id: [
    { value: 'eq', label: 'é igual a' },
    { value: 'neq', label: 'não é' },
  ],
  etiqueta: [
    { value: 'eq', label: 'é igual a' },
    { value: 'ilike', label: 'contém' },
  ],
  created_at: [
    { value: 'gt', label: 'depois de' },
    { value: 'lt', label: 'antes de' },
  ],
  updated_at: [
    { value: 'gt', label: 'depois de' },
    { value: 'lt', label: 'antes de' },
  ],
  score_probabilidade: [
    { value: 'gt', label: 'maior que' },
    { value: 'lt', label: 'menor que' },
  ],
  contact_nome: [
    { value: 'ilike', label: 'contém' },
  ],
  origem: [
    { value: 'eq', label: 'é igual a' },
  ],
};
