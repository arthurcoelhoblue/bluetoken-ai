export type CustomFieldEntityType = 'CONTACT' | 'ORGANIZATION' | 'DEAL';

export type CustomFieldValueType =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'CURRENCY' | 'DATE' | 'DATETIME'
  | 'BOOLEAN' | 'SELECT' | 'MULTISELECT' | 'EMAIL' | 'PHONE' | 'URL' | 'PERCENT' | 'TAG';

export interface SelectOption {
  label: string;
  value: string;
}

export interface CustomFieldDefinition {
  id: string;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  entity_type: CustomFieldEntityType;
  slug: string;
  label: string;
  value_type: CustomFieldValueType;
  options_json: SelectOption[] | null;
  is_required: boolean;
  is_visible: boolean;
  is_system: boolean;
  grupo: string;
  posicao: number;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  field_id: string;
  entity_type: CustomFieldEntityType;
  entity_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface ResolvedCustomField {
  definition: CustomFieldDefinition;
  value: CustomFieldValue | null;
  displayValue: string;
}

export interface Organization {
  id: string;
  empresa: 'BLUE' | 'TOKENIZA';
  nome: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  setor: string | null;
  porte: string | null;
  website: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  pais: string | null;
  owner_id: string | null;
  tags: string[];
  notas: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationFormData {
  nome: string;
  empresa: 'BLUE' | 'TOKENIZA';
  nome_fantasia?: string;
  cnpj?: string;
  setor?: string;
  porte?: string;
  website?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  owner_id?: string;
}

export interface PipelineFormData {
  nome: string;
  empresa: 'BLUE' | 'TOKENIZA';
  descricao?: string;
  is_default?: boolean;
  tipo?: string;
}

export interface StageFormData {
  nome: string;
  pipeline_id: string;
  posicao: number;
  cor?: string;
  is_won?: boolean;
  is_lost?: boolean;
  sla_minutos?: number;
}

export interface CustomFieldFormData {
  empresa: 'BLUE' | 'TOKENIZA';
  entity_type: CustomFieldEntityType;
  slug: string;
  label: string;
  value_type: CustomFieldValueType;
  options_json?: SelectOption[];
  is_required?: boolean;
  is_visible?: boolean;
  grupo?: string;
  posicao?: number;
}
