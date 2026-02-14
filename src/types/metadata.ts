import { Json } from '@/integrations/supabase/types';

/** Typed metadata for deal activities created by SDR IA */
export interface DealActivityMetadata {
  origem?: 'SDR_IA' | 'MANUAL';
  dados_extraidos?: {
    valor_mencionado?: number;
    necessidade_principal?: string;
    urgencia?: 'ALTA' | 'MEDIA' | 'BAIXA';
    decisor_identificado?: boolean;
    prazo_mencionado?: string;
  };
  from_stage_id?: string;
  to_stage_id?: string;
  old_valor?: number;
  new_valor?: number;
  motivo?: string;
  categoria?: string;
  [key: string]: unknown;
}

/** Typed metadata for pipeline stage with optional tempo_minimo_dias */
export interface PipelineStageWithTempo {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  is_won: boolean;
  is_lost: boolean;
  sla_minutos: number | null;
  tempo_minimo_dias?: number | null;
}

/** User profile with is_vendedor flag */
export interface UserProfileWithVendedor {
  is_vendedor?: boolean;
  [key: string]: unknown;
}
