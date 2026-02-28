export interface ContactWithStats {
  id: string;
  pessoa_id: string | null;
  empresa: 'BLUE' | 'TOKENIZA' | 'MPUPPE' | 'AXIA';
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  organization_id: string | null;
  is_cliente: boolean;
  is_active: boolean;
  nome: string;
  email: string | null;
  telefone: string | null;
  tags: string[] | null;
  tipo: string | null;
  canal_origem: string | null;
  legacy_lead_id: string | null;
  notas: string | null;
  primeiro_nome: string | null;
  sobrenome: string | null;
  cpf: string | null;
  rg: string | null;
  telegram: string | null;
  endereco: string | null;
  foto_url: string | null;
  // New fields from lead_contacts sync
  telefone_e164: string | null;
  telefone_valido: boolean | null;
  opt_out: boolean | null;
  score_marketing: number | null;
  prioridade_marketing: string | null;
  linkedin_url: string | null;
  linkedin_cargo: string | null;
  linkedin_empresa: string | null;
  linkedin_setor: string | null;
  origem_telefone: string | null;
  // From view joins
  org_nome: string | null;
  org_nome_fantasia: string | null;
  owner_nome: string | null;
  owner_avatar: string | null;
  deals_count: number;
  deals_abertos: number;
  deals_valor_total: number;
}

export interface OrganizationWithStats {
  id: string;
  empresa: 'BLUE' | 'TOKENIZA';
  owner_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
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
  tags: string[] | null;
  notas: string | null;
  // From view joins
  owner_nome: string | null;
  owner_avatar: string | null;
  contacts_count: number;
  deals_count: number;
  deals_abertos: number;
  deals_valor_total: number;
}

export interface ContactFormData {
  nome: string;
  empresa: 'BLUE' | 'TOKENIZA';
  primeiro_nome?: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  tipo?: string;
  canal_origem?: string;
  organization_id?: string;
  notas?: string;
  is_cliente?: boolean;
  tags?: string[];
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
