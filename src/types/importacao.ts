export type ImportJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
export type ImportJobType = 'PIPEDRIVE_FULL' | 'PIPEDRIVE_DEALS' | 'PIPEDRIVE_CONTACTS' | 'PIPEDRIVE_ORGS';
export type ImportEntityType = 'DEAL' | 'CONTACT' | 'ORGANIZATION' | 'PERSON';

export interface ImportJob {
  id: string;
  tipo: string;
  empresa: string;
  status: ImportJobStatus;
  total_records: number;
  imported: number;
  skipped: number;
  errors: number;
  error_log: any[];
  config: ImportConfig;
  started_by: string | null;
  started_by_nome?: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  orgs_mapped?: number;
  contacts_mapped?: number;
  deals_mapped?: number;
}

export interface ImportMapping {
  id: string;
  import_job_id: string;
  entity_type: ImportEntityType;
  source_id: string;
  target_id: string;
  empresa: string;
  created_at: string;
}

export interface ImportConfig {
  pipeline_mapping?: Record<string, string>; // pipedrive_pipeline_id -> crm_pipeline_id
  stage_mapping?: Record<string, string>;    // pipedrive_stage_id -> crm_stage_id
  owner_mapping?: Record<string, string>;    // pipedrive_user_id -> crm_user_id
  skip_existing?: boolean;
}

export interface PipedriveDealRow {
  id: number | string;
  title?: string;
  value?: number;
  currency?: string;
  status?: string; // open, won, lost
  pipeline_id?: number | string;
  stage_id?: number | string;
  person_id?: number | string;
  org_id?: number | string;
  user_id?: number | string;
  add_time?: string;
  update_time?: string;
  won_time?: string;
  lost_time?: string;
  close_time?: string;
  lost_reason?: string;
  expected_close_date?: string;
  note?: string;
  [key: string]: any;
}

export interface PipedrivePersonRow {
  id: number | string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: Array<{ value: string; primary?: boolean }> | string;
  phone?: Array<{ value: string; primary?: boolean }> | string;
  org_id?: number | string | { value: number | string };
  add_time?: string;
  [key: string]: any;
}

export interface PipedriveOrgRow {
  id: number | string;
  name?: string;
  address?: string;
  add_time?: string;
  [key: string]: any;
}

export interface ImportProgress {
  phase: 'orgs' | 'contacts' | 'deals' | 'done';
  current: number;
  total: number;
  imported: number;
  skipped: number;
  errors: number;
}
