export type CaptureFieldType = 'short_text' | 'long_text' | 'email' | 'phone' | 'single_select' | 'multi_select' | 'number';

export interface CaptureFormField {
  id: string;
  type: CaptureFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface CaptureFormSettings {
  primary_color?: string;
  logo_url?: string;
  thank_you_title?: string;
  thank_you_message?: string;
}

export interface CaptureForm {
  id: string;
  empresa: string;
  nome: string;
  slug: string;
  descricao: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  fields: CaptureFormField[];
  settings: CaptureFormSettings;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  submission_count?: number;
}

export interface CaptureFormSubmission {
  id: string;
  form_id: string;
  empresa: string;
  answers: Record<string, unknown>;
  metadata: Record<string, unknown>;
  rating_score: number | null;
  contact_id: string | null;
  deal_id: string | null;
  created_at: string;
}
