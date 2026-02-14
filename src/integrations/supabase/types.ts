export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_system: boolean
          nome: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "access_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "access_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_model_benchmarks: {
        Row: {
          acao_recomendada: string | null
          created_at: string | null
          id: string
          intent: string | null
          intent_confidence: number | null
          message_id: string | null
          modelo_ia: string
          original_intent_id: string | null
          resposta_automatica_texto: string | null
          tempo_processamento_ms: number | null
          tokens_usados: number | null
        }
        Insert: {
          acao_recomendada?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          message_id?: string | null
          modelo_ia: string
          original_intent_id?: string | null
          resposta_automatica_texto?: string | null
          tempo_processamento_ms?: number | null
          tokens_usados?: number | null
        }
        Update: {
          acao_recomendada?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          message_id?: string | null
          modelo_ia?: string
          original_intent_id?: string | null
          resposta_automatica_texto?: string | null
          tempo_processamento_ms?: number | null
          tokens_usados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_benchmarks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "lead_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_benchmarks_original_intent_id_fkey"
            columns: ["original_intent_id"]
            isOneToOne: false
            referencedRelation: "lead_message_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      amelia_learnings: {
        Row: {
          aplicado: boolean | null
          categoria: string
          confianca: number | null
          created_at: string
          dados: Json | null
          descricao: string
          empresa: string
          hash_titulo: string | null
          id: string
          sequencia_eventos: Json | null
          sequencia_janela_dias: number | null
          sequencia_match_pct: number | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          aplicado?: boolean | null
          categoria: string
          confianca?: number | null
          created_at?: string
          dados?: Json | null
          descricao: string
          empresa: string
          hash_titulo?: string | null
          id?: string
          sequencia_eventos?: Json | null
          sequencia_janela_dias?: number | null
          sequencia_match_pct?: number | null
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          aplicado?: boolean | null
          categoria?: string
          confianca?: number | null
          created_at?: string
          dados?: Json | null
          descricao?: string
          empresa?: string
          hash_titulo?: string | null
          id?: string
          sequencia_eventos?: Json | null
          sequencia_janela_dias?: number | null
          sequencia_match_pct?: number | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "amelia_learnings_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "amelia_learnings_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "amelia_learnings_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amelia_learnings_validado_por_fkey"
            columns: ["validado_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cadence_runner_logs: {
        Row: {
          details: Json | null
          duration_ms: number | null
          errors: number
          executed_at: string
          id: string
          runs_touched: number
          steps_executed: number
          trigger_source: string | null
        }
        Insert: {
          details?: Json | null
          duration_ms?: number | null
          errors?: number
          executed_at?: string
          id?: string
          runs_touched?: number
          steps_executed?: number
          trigger_source?: string | null
        }
        Update: {
          details?: Json | null
          duration_ms?: number | null
          errors?: number
          executed_at?: string
          id?: string
          runs_touched?: number
          steps_executed?: number
          trigger_source?: string | null
        }
        Relationships: []
      }
      cadence_stage_triggers: {
        Row: {
          cadence_id: string
          created_at: string
          id: string
          is_active: boolean
          pipeline_id: string
          stage_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          cadence_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id: string
          stage_id: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          cadence_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string
          stage_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_stage_triggers_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadencias_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_stage_triggers_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      cadence_steps: {
        Row: {
          cadence_id: string
          canal: Database["public"]["Enums"]["canal_tipo"]
          created_at: string
          id: string
          offset_minutos: number
          ordem: number
          parar_se_responder: boolean
          template_codigo: string
          updated_at: string
        }
        Insert: {
          cadence_id: string
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          id?: string
          offset_minutos?: number
          ordem: number
          parar_se_responder?: boolean
          template_codigo: string
          updated_at?: string
        }
        Update: {
          cadence_id?: string
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          id?: string
          offset_minutos?: number
          ordem?: number
          parar_se_responder?: boolean
          template_codigo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadencias_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      cadences: {
        Row: {
          ativo: boolean
          canal_principal: Database["public"]["Enums"]["canal_tipo"]
          codigo: string
          created_at: string
          descricao: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal_principal?: Database["public"]["Enums"]["canal_tipo"]
          codigo: string
          created_at?: string
          descricao?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal_principal?: Database["public"]["Enums"]["canal_tipo"]
          codigo?: string
          created_at?: string
          descricao?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_events: {
        Row: {
          call_id: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          call_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "call_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answered_at: string | null
          caller_number: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          destination_number: string | null
          direcao: string
          duracao_segundos: number
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          ended_at: string | null
          id: string
          pbx_call_id: string
          recording_url: string | null
          started_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          answered_at?: string | null
          caller_number?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          destination_number?: string | null
          direcao: string
          duracao_segundos?: number
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          ended_at?: string | null
          id?: string
          pbx_call_id: string
          recording_url?: string | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          answered_at?: string | null
          caller_number?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          destination_number?: string | null
          direcao?: string
          duracao_segundos?: number
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          ended_at?: string | null
          id?: string
          pbx_call_id?: string
          recording_url?: string | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      capture_form_submissions: {
        Row: {
          answers: Json
          contact_id: string | null
          created_at: string
          deal_id: string | null
          empresa: string
          form_id: string
          id: string
          metadata: Json | null
          rating_score: number | null
        }
        Insert: {
          answers?: Json
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          empresa: string
          form_id: string
          id?: string
          metadata?: Json | null
          rating_score?: number | null
        }
        Update: {
          answers?: Json
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          empresa?: string
          form_id?: string
          id?: string
          metadata?: Json | null
          rating_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "capture_form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_form_submissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "capture_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "capture_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_forms: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa: string
          fields: Json
          id: string
          nome: string
          pipeline_id: string | null
          settings: Json
          slug: string
          stage_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa: string
          fields?: Json
          id?: string
          nome: string
          pipeline_id?: string | null
          settings?: Json
          slug: string
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa?: string
          fields?: Json
          id?: string
          nome?: string
          pipeline_id?: string | null
          settings?: Json
          slug?: string
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "capture_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "capture_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "capture_forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "capture_forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "capture_forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "capture_forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "capture_forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "capture_forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_forms_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      closer_notifications: {
        Row: {
          closer_email: string | null
          contexto: Json | null
          created_at: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          enviado_em: string | null
          id: string
          lead_id: string
          motivo: string
          visualizado_em: string | null
        }
        Insert: {
          closer_email?: string | null
          contexto?: Json | null
          created_at?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          enviado_em?: string | null
          id?: string
          lead_id: string
          motivo: string
          visualizado_em?: string | null
        }
        Update: {
          closer_email?: string | null
          contexto?: Json | null
          created_at?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          enviado_em?: string | null
          id?: string
          lead_id?: string
          motivo?: string
          visualizado_em?: string | null
        }
        Relationships: []
      }
      comissao_lancamentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          comissao_valor: number
          created_at: string
          deal_id: string
          deal_valor: number
          empresa: string
          id: string
          pago_em: string | null
          percentual_aplicado: number | null
          referencia_ano: number
          referencia_mes: number
          regra_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          comissao_valor: number
          created_at?: string
          deal_id: string
          deal_valor: number
          empresa: string
          id?: string
          pago_em?: string | null
          percentual_aplicado?: number | null
          referencia_ano: number
          referencia_mes: number
          regra_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          comissao_valor?: number
          created_at?: string
          deal_id?: string
          deal_valor?: number
          empresa?: string
          id?: string
          pago_em?: string | null
          percentual_aplicado?: number | null
          referencia_ano?: number
          referencia_mes?: number
          regra_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissao_lancamentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "comissao_regras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      comissao_regras: {
        Row: {
          ativo: boolean
          created_at: string
          empresa: string
          escalas: Json | null
          id: string
          nome: string
          percentual: number | null
          pipeline_id: string | null
          tipo: string
          updated_at: string
          valor_fixo: number | null
          valor_minimo_deal: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa: string
          escalas?: Json | null
          id?: string
          nome: string
          percentual?: number | null
          pipeline_id?: string | null
          tipo: string
          updated_at?: string
          valor_fixo?: number | null
          valor_minimo_deal?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa?: string
          escalas?: Json | null
          id?: string
          nome?: string
          percentual?: number | null
          pipeline_id?: string | null
          tipo?: string
          updated_at?: string
          valor_fixo?: number | null
          valor_minimo_deal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comissao_regras_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "comissao_regras_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_regras_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      contacts: {
        Row: {
          canal_origem: string | null
          cpf: string | null
          created_at: string
          ddi: string | null
          email: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          endereco: string | null
          foto_url: string | null
          id: string
          is_active: boolean
          is_cliente: boolean
          legacy_lead_id: string | null
          linkedin_cargo: string | null
          linkedin_empresa: string | null
          linkedin_setor: string | null
          linkedin_url: string | null
          nome: string
          notas: string | null
          numero_nacional: string | null
          opt_out: boolean | null
          opt_out_em: string | null
          opt_out_motivo: string | null
          organization_id: string | null
          origem_telefone: string | null
          owner_id: string | null
          pessoa_id: string | null
          primeiro_nome: string | null
          prioridade_marketing: string | null
          rg: string | null
          score_marketing: number | null
          sobrenome: string | null
          tags: string[] | null
          telefone: string | null
          telefone_e164: string | null
          telefone_valido: boolean | null
          telegram: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          canal_origem?: string | null
          cpf?: string | null
          created_at?: string
          ddi?: string | null
          email?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          endereco?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean
          is_cliente?: boolean
          legacy_lead_id?: string | null
          linkedin_cargo?: string | null
          linkedin_empresa?: string | null
          linkedin_setor?: string | null
          linkedin_url?: string | null
          nome: string
          notas?: string | null
          numero_nacional?: string | null
          opt_out?: boolean | null
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          organization_id?: string | null
          origem_telefone?: string | null
          owner_id?: string | null
          pessoa_id?: string | null
          primeiro_nome?: string | null
          prioridade_marketing?: string | null
          rg?: string | null
          score_marketing?: number | null
          sobrenome?: string | null
          tags?: string[] | null
          telefone?: string | null
          telefone_e164?: string | null
          telefone_valido?: boolean | null
          telegram?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          canal_origem?: string | null
          cpf?: string | null
          created_at?: string
          ddi?: string | null
          email?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          endereco?: string | null
          foto_url?: string | null
          id?: string
          is_active?: boolean
          is_cliente?: boolean
          legacy_lead_id?: string | null
          linkedin_cargo?: string | null
          linkedin_empresa?: string | null
          linkedin_setor?: string | null
          linkedin_url?: string | null
          nome?: string
          notas?: string | null
          numero_nacional?: string | null
          opt_out?: boolean | null
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          organization_id?: string | null
          origem_telefone?: string | null
          owner_id?: string | null
          pessoa_id?: string | null
          primeiro_nome?: string | null
          prioridade_marketing?: string | null
          rg?: string | null
          score_marketing?: number | null
          sobrenome?: string | null
          tags?: string[] | null
          telefone?: string | null
          telefone_e164?: string | null
          telefone_valido?: boolean | null
          telegram?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_takeover_log: {
        Row: {
          acao: string
          canal: Database["public"]["Enums"]["canal_tipo"]
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          lead_id: string
          motivo: string | null
          user_id: string
        }
        Insert: {
          acao: string
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id: string
          motivo?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id?: string
          motivo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_takeover_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversation_takeover_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversation_takeover_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_takeover_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          content: string
          context_id: string | null
          context_type: string
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          latency_ms: number | null
          model_used: string | null
          role: string
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          content: string
          context_id?: string | null
          context_type: string
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          content?: string
          context_id?: string | null
          context_type?: string
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          latency_ms?: number | null
          model_used?: string | null
          role?: string
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "copilot_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "copilot_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          entity_type: Database["public"]["Enums"]["custom_field_entity_type"]
          grupo: string
          id: string
          is_required: boolean
          is_system: boolean
          is_visible: boolean
          label: string
          options_json: Json | null
          posicao: number
          slug: string
          updated_at: string
          value_type: Database["public"]["Enums"]["custom_field_value_type"]
        }
        Insert: {
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          entity_type: Database["public"]["Enums"]["custom_field_entity_type"]
          grupo?: string
          id?: string
          is_required?: boolean
          is_system?: boolean
          is_visible?: boolean
          label: string
          options_json?: Json | null
          posicao?: number
          slug: string
          updated_at?: string
          value_type: Database["public"]["Enums"]["custom_field_value_type"]
        }
        Update: {
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          entity_type?: Database["public"]["Enums"]["custom_field_entity_type"]
          grupo?: string
          id?: string
          is_required?: boolean
          is_system?: boolean
          is_visible?: boolean
          label?: string
          options_json?: Json | null
          posicao?: number
          slug?: string
          updated_at?: string
          value_type?: Database["public"]["Enums"]["custom_field_value_type"]
        }
        Relationships: []
      }
      custom_field_values: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["custom_field_entity_type"]
          field_id: string
          id: string
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["custom_field_entity_type"]
          field_id: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["custom_field_entity_type"]
          field_id?: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          created_at: string
          deal_id: string
          descricao: string | null
          id: string
          metadata: Json | null
          tarefa_concluida: boolean | null
          tarefa_prazo: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          tarefa_concluida?: boolean | null
          tarefa_prazo?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          tarefa_concluida?: boolean | null
          tarefa_prazo?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
        ]
      }
      deal_cadence_runs: {
        Row: {
          cadence_run_id: string
          created_at: string
          deal_id: string
          id: string
          status: string
          trigger_stage_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          cadence_run_id: string
          created_at?: string
          deal_id: string
          id?: string
          status?: string
          trigger_stage_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          cadence_run_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          status?: string
          trigger_stage_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_cadence_runs_cadence_run_id_fkey"
            columns: ["cadence_run_id"]
            isOneToOne: false
            referencedRelation: "deal_cadencia_status"
            referencedColumns: ["cadence_run_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_cadence_run_id_fkey"
            columns: ["cadence_run_id"]
            isOneToOne: false
            referencedRelation: "lead_cadence_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      deal_loss_categories: {
        Row: {
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          label: string
          posicao: number
        }
        Insert: {
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          label: string
          posicao?: number
        }
        Update: {
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          label?: string
          posicao?: number
        }
        Relationships: []
      }
      deal_stage_history: {
        Row: {
          created_at: string
          deal_id: string
          from_stage_id: string | null
          id: string
          moved_by: string | null
          tempo_no_stage_anterior_ms: number | null
          to_stage_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          from_stage_id?: string | null
          id?: string
          moved_by?: string | null
          tempo_no_stage_anterior_ms?: number | null
          to_stage_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          from_stage_id?: string | null
          id?: string
          moved_by?: string | null
          tempo_no_stage_anterior_ms?: number | null
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_stage_history_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_stage_history_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_stage_history_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      deals: {
        Row: {
          canal_origem: string | null
          categoria_perda_closer: string | null
          categoria_perda_final: string | null
          categoria_perda_ia: string | null
          contact_id: string
          created_at: string
          data_ganho: string | null
          data_perda: string | null
          data_previsao_fechamento: string | null
          etiqueta: string | null
          fbclid: string | null
          fechado_em: string | null
          gclid: string | null
          id: string
          metadata: Json | null
          moeda: string
          motivo_perda: string | null
          motivo_perda_closer: string | null
          motivo_perda_final: string | null
          motivo_perda_ia: string | null
          notas: string | null
          organization_id: string | null
          owner_id: string | null
          perda_resolvida: boolean | null
          perda_resolvida_em: string | null
          perda_resolvida_por: string | null
          pipeline_id: string
          posicao_kanban: number
          score_engajamento: number | null
          score_intencao: number | null
          score_probabilidade: number
          score_urgencia: number | null
          score_valor: number | null
          stage_fechamento_id: string | null
          stage_id: string
          stage_origem_id: string | null
          status: string
          tags: string[] | null
          temperatura: Database["public"]["Enums"]["temperatura_tipo"] | null
          titulo: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor: number | null
        }
        Insert: {
          canal_origem?: string | null
          categoria_perda_closer?: string | null
          categoria_perda_final?: string | null
          categoria_perda_ia?: string | null
          contact_id: string
          created_at?: string
          data_ganho?: string | null
          data_perda?: string | null
          data_previsao_fechamento?: string | null
          etiqueta?: string | null
          fbclid?: string | null
          fechado_em?: string | null
          gclid?: string | null
          id?: string
          metadata?: Json | null
          moeda?: string
          motivo_perda?: string | null
          motivo_perda_closer?: string | null
          motivo_perda_final?: string | null
          motivo_perda_ia?: string | null
          notas?: string | null
          organization_id?: string | null
          owner_id?: string | null
          perda_resolvida?: boolean | null
          perda_resolvida_em?: string | null
          perda_resolvida_por?: string | null
          pipeline_id: string
          posicao_kanban?: number
          score_engajamento?: number | null
          score_intencao?: number | null
          score_probabilidade?: number
          score_urgencia?: number | null
          score_valor?: number | null
          stage_fechamento_id?: string | null
          stage_id: string
          stage_origem_id?: string | null
          status?: string
          tags?: string[] | null
          temperatura?: Database["public"]["Enums"]["temperatura_tipo"] | null
          titulo: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor?: number | null
        }
        Update: {
          canal_origem?: string | null
          categoria_perda_closer?: string | null
          categoria_perda_final?: string | null
          categoria_perda_ia?: string | null
          contact_id?: string
          created_at?: string
          data_ganho?: string | null
          data_perda?: string | null
          data_previsao_fechamento?: string | null
          etiqueta?: string | null
          fbclid?: string | null
          fechado_em?: string | null
          gclid?: string | null
          id?: string
          metadata?: Json | null
          moeda?: string
          motivo_perda?: string | null
          motivo_perda_closer?: string | null
          motivo_perda_final?: string | null
          motivo_perda_ia?: string | null
          notas?: string | null
          organization_id?: string | null
          owner_id?: string | null
          perda_resolvida?: boolean | null
          perda_resolvida_em?: string | null
          perda_resolvida_por?: string | null
          pipeline_id?: string
          posicao_kanban?: number
          score_engajamento?: number | null
          score_intencao?: number | null
          score_probabilidade?: number
          score_urgencia?: number | null
          score_valor?: number | null
          stage_fechamento_id?: string | null
          stage_id?: string
          stage_origem_id?: string | null
          status?: string
          tags?: string[] | null
          temperatura?: Database["public"]["Enums"]["temperatura_tipo"] | null
          titulo?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          config: Json | null
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          error_log: Json | null
          errors: number
          id: string
          imported: number
          skipped: number
          started_at: string | null
          started_by: string | null
          status: string
          tipo: string
          total_records: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          error_log?: Json | null
          errors?: number
          id?: string
          imported?: number
          skipped?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          tipo?: string
          total_records?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          config?: Json | null
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          error_log?: Json | null
          errors?: number
          id?: string
          imported?: number
          skipped?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          tipo?: string
          total_records?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      import_mapping: {
        Row: {
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          entity_type: string
          id: string
          import_job_id: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          entity_type: string
          id?: string
          import_job_id: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          entity_type?: string
          id?: string
          import_job_id?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_mapping_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_mapping_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_company_config: {
        Row: {
          channel: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          enabled: boolean
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          descricao: string | null
          id: string
          nome_arquivo: string
          product_knowledge_id: string
          storage_path: string
          tipo_documento: string | null
          uploaded_at: string
        }
        Insert: {
          descricao?: string | null
          id?: string
          nome_arquivo: string
          product_knowledge_id: string
          storage_path: string
          tipo_documento?: string | null
          uploaded_at?: string
        }
        Update: {
          descricao?: string | null
          id?: string
          nome_arquivo?: string
          product_knowledge_id?: string
          storage_path?: string
          tipo_documento?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_product_knowledge_id_fkey"
            columns: ["product_knowledge_id"]
            isOneToOne: false
            referencedRelation: "product_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_faq: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          categoria: string | null
          created_at: string
          criado_por: string | null
          empresa: string
          fonte: string
          id: string
          motivo_rejeicao: string | null
          pergunta: string
          produto_id: string | null
          resposta: string
          status: string
          tags: string[] | null
          updated_at: string
          visivel_amelia: boolean
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          empresa?: string
          fonte?: string
          id?: string
          motivo_rejeicao?: string | null
          pergunta: string
          produto_id?: string | null
          resposta: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          visivel_amelia?: boolean
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: string | null
          created_at?: string
          criado_por?: string | null
          empresa?: string
          fonte?: string
          id?: string
          motivo_rejeicao?: string | null
          pergunta?: string
          produto_id?: string | null
          resposta?: string
          status?: string
          tags?: string[] | null
          updated_at?: string
          visivel_amelia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_faq_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_faq_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_faq_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_faq_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_faq_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_faq_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_faq_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_faq_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_faq_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "product_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sections: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          ordem: number
          product_knowledge_id: string
          tipo: Database["public"]["Enums"]["knowledge_section_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          ordem?: number
          product_knowledge_id: string
          tipo: Database["public"]["Enums"]["knowledge_section_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          ordem?: number
          product_knowledge_id?: string
          tipo?: Database["public"]["Enums"]["knowledge_section_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sections_product_knowledge_id_fkey"
            columns: ["product_knowledge_id"]
            isOneToOne: false
            referencedRelation: "product_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_cadence_events: {
        Row: {
          created_at: string
          detalhes: Json | null
          id: string
          lead_cadence_run_id: string
          step_ordem: number
          template_codigo: string
          tipo_evento: Database["public"]["Enums"]["cadence_event_tipo"]
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          lead_cadence_run_id: string
          step_ordem: number
          template_codigo: string
          tipo_evento: Database["public"]["Enums"]["cadence_event_tipo"]
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          lead_cadence_run_id?: string
          step_ordem?: number
          template_codigo?: string
          tipo_evento?: Database["public"]["Enums"]["cadence_event_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_cadence_events_lead_cadence_run_id_fkey"
            columns: ["lead_cadence_run_id"]
            isOneToOne: false
            referencedRelation: "deal_cadencia_status"
            referencedColumns: ["cadence_run_id"]
          },
          {
            foreignKeyName: "lead_cadence_events_lead_cadence_run_id_fkey"
            columns: ["lead_cadence_run_id"]
            isOneToOne: false
            referencedRelation: "lead_cadence_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_cadence_runs: {
        Row: {
          cadence_id: string
          classification_snapshot: Json | null
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          fonte_evento_id: string | null
          id: string
          last_step_ordem: number
          lead_id: string
          next_run_at: string | null
          next_step_ordem: number | null
          started_at: string
          status: Database["public"]["Enums"]["cadence_run_status"]
          updated_at: string
        }
        Insert: {
          cadence_id: string
          classification_snapshot?: Json | null
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          fonte_evento_id?: string | null
          id?: string
          last_step_ordem?: number
          lead_id: string
          next_run_at?: string | null
          next_step_ordem?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["cadence_run_status"]
          updated_at?: string
        }
        Update: {
          cadence_id?: string
          classification_snapshot?: Json | null
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          fonte_evento_id?: string | null
          id?: string
          last_step_ordem?: number
          lead_id?: string
          next_run_at?: string | null
          next_step_ordem?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["cadence_run_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_cadence_runs_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadence_runs_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadencias_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadence_runs_fonte_evento_id_fkey"
            columns: ["fonte_evento_id"]
            isOneToOne: false
            referencedRelation: "sgt_events"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_classifications: {
        Row: {
          classificado_em: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          fonte_evento_id: string | null
          fonte_evento_tipo:
            | Database["public"]["Enums"]["sgt_evento_tipo"]
            | null
          icp: Database["public"]["Enums"]["icp_tipo"]
          id: string
          justificativa: Json | null
          lead_id: string
          origem: Database["public"]["Enums"]["classificacao_origem"]
          override_motivo: string | null
          override_por_user_id: string | null
          persona: Database["public"]["Enums"]["persona_tipo"] | null
          prioridade: number
          score_composto: number | null
          score_interno: number | null
          temperatura: Database["public"]["Enums"]["temperatura_tipo"]
          updated_at: string
        }
        Insert: {
          classificado_em?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          fonte_evento_id?: string | null
          fonte_evento_tipo?:
            | Database["public"]["Enums"]["sgt_evento_tipo"]
            | null
          icp: Database["public"]["Enums"]["icp_tipo"]
          id?: string
          justificativa?: Json | null
          lead_id: string
          origem?: Database["public"]["Enums"]["classificacao_origem"]
          override_motivo?: string | null
          override_por_user_id?: string | null
          persona?: Database["public"]["Enums"]["persona_tipo"] | null
          prioridade: number
          score_composto?: number | null
          score_interno?: number | null
          temperatura?: Database["public"]["Enums"]["temperatura_tipo"]
          updated_at?: string
        }
        Update: {
          classificado_em?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          fonte_evento_id?: string | null
          fonte_evento_tipo?:
            | Database["public"]["Enums"]["sgt_evento_tipo"]
            | null
          icp?: Database["public"]["Enums"]["icp_tipo"]
          id?: string
          justificativa?: Json | null
          lead_id?: string
          origem?: Database["public"]["Enums"]["classificacao_origem"]
          override_motivo?: string | null
          override_por_user_id?: string | null
          persona?: Database["public"]["Enums"]["persona_tipo"] | null
          prioridade?: number
          score_composto?: number | null
          score_interno?: number | null
          temperatura?: Database["public"]["Enums"]["temperatura_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_classifications_fonte_evento_id_fkey"
            columns: ["fonte_evento_id"]
            isOneToOne: false
            referencedRelation: "sgt_events"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contact_issues: {
        Row: {
          criado_em: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          issue_tipo: Database["public"]["Enums"]["lead_contact_issue_tipo"]
          lead_id: string
          mensagem: string
          resolvido: boolean
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
        }
        Insert: {
          criado_em?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          issue_tipo: Database["public"]["Enums"]["lead_contact_issue_tipo"]
          lead_id: string
          mensagem: string
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade: string
        }
        Update: {
          criado_em?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          issue_tipo?: Database["public"]["Enums"]["lead_contact_issue_tipo"]
          lead_id?: string
          mensagem?: string
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contact_issues_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_contact_issues_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_contact_issues_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_contact_issues_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          blue_client_id: string | null
          chatwoot_agente_atual: string | null
          chatwoot_conversas_total: number | null
          chatwoot_inbox: string | null
          chatwoot_status_atendimento: string | null
          chatwoot_tempo_resposta_medio: number | null
          contato_internacional: boolean
          created_at: string
          ddi: string | null
          email: string | null
          email_placeholder: boolean
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          lead_id: string
          linkedin_cargo: string | null
          linkedin_conexoes: number | null
          linkedin_empresa: string | null
          linkedin_senioridade: string | null
          linkedin_setor: string | null
          linkedin_url: string | null
          mautic_cidade: string | null
          mautic_estado: string | null
          mautic_first_visit: string | null
          nome: string | null
          numero_nacional: string | null
          opt_out: boolean
          opt_out_em: string | null
          opt_out_motivo: string | null
          origem_telefone: string | null
          owner_id: string | null
          pessoa_id: string | null
          pipedrive_deal_id: string | null
          pipedrive_person_id: string | null
          primeiro_nome: string | null
          prioridade_marketing: string | null
          score_marketing: number | null
          telefone: string | null
          telefone_e164: string | null
          telefone_validado_em: string | null
          telefone_valido: boolean
          tokeniza_investor_id: string | null
          updated_at: string
        }
        Insert: {
          blue_client_id?: string | null
          chatwoot_agente_atual?: string | null
          chatwoot_conversas_total?: number | null
          chatwoot_inbox?: string | null
          chatwoot_status_atendimento?: string | null
          chatwoot_tempo_resposta_medio?: number | null
          contato_internacional?: boolean
          created_at?: string
          ddi?: string | null
          email?: string | null
          email_placeholder?: boolean
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id: string
          linkedin_cargo?: string | null
          linkedin_conexoes?: number | null
          linkedin_empresa?: string | null
          linkedin_senioridade?: string | null
          linkedin_setor?: string | null
          linkedin_url?: string | null
          mautic_cidade?: string | null
          mautic_estado?: string | null
          mautic_first_visit?: string | null
          nome?: string | null
          numero_nacional?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          origem_telefone?: string | null
          owner_id?: string | null
          pessoa_id?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_person_id?: string | null
          primeiro_nome?: string | null
          prioridade_marketing?: string | null
          score_marketing?: number | null
          telefone?: string | null
          telefone_e164?: string | null
          telefone_validado_em?: string | null
          telefone_valido?: boolean
          tokeniza_investor_id?: string | null
          updated_at?: string
        }
        Update: {
          blue_client_id?: string | null
          chatwoot_agente_atual?: string | null
          chatwoot_conversas_total?: number | null
          chatwoot_inbox?: string | null
          chatwoot_status_atendimento?: string | null
          chatwoot_tempo_resposta_medio?: number | null
          contato_internacional?: boolean
          created_at?: string
          ddi?: string | null
          email?: string | null
          email_placeholder?: boolean
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id?: string
          linkedin_cargo?: string | null
          linkedin_conexoes?: number | null
          linkedin_empresa?: string | null
          linkedin_senioridade?: string | null
          linkedin_setor?: string | null
          linkedin_url?: string | null
          mautic_cidade?: string | null
          mautic_estado?: string | null
          mautic_first_visit?: string | null
          nome?: string | null
          numero_nacional?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          origem_telefone?: string | null
          owner_id?: string | null
          pessoa_id?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_person_id?: string | null
          primeiro_nome?: string | null
          prioridade_marketing?: string | null
          score_marketing?: number | null
          telefone?: string | null
          telefone_e164?: string | null
          telefone_validado_em?: string | null
          telefone_valido?: boolean
          tokeniza_investor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_contacts_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversation_state: {
        Row: {
          assumido_em: string | null
          assumido_por: string | null
          canal: Database["public"]["Enums"]["canal_tipo"]
          created_at: string
          devolvido_em: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          empresa_proxima_msg:
            | Database["public"]["Enums"]["empresa_tipo"]
            | null
          estado_funil: Database["public"]["Enums"]["estado_funil_tipo"]
          framework_ativo: Database["public"]["Enums"]["framework_tipo"]
          framework_data: Json | null
          id: string
          idioma_preferido: string
          lead_id: string
          modo: Database["public"]["Enums"]["atendimento_modo"]
          perfil_disc: string | null
          perfil_investidor: string | null
          ultima_pergunta_id: string | null
          ultimo_contato_em: string
          updated_at: string
        }
        Insert: {
          assumido_em?: string | null
          assumido_por?: string | null
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          devolvido_em?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          empresa_proxima_msg?:
            | Database["public"]["Enums"]["empresa_tipo"]
            | null
          estado_funil?: Database["public"]["Enums"]["estado_funil_tipo"]
          framework_ativo?: Database["public"]["Enums"]["framework_tipo"]
          framework_data?: Json | null
          id?: string
          idioma_preferido?: string
          lead_id: string
          modo?: Database["public"]["Enums"]["atendimento_modo"]
          perfil_disc?: string | null
          perfil_investidor?: string | null
          ultima_pergunta_id?: string | null
          ultimo_contato_em?: string
          updated_at?: string
        }
        Update: {
          assumido_em?: string | null
          assumido_por?: string | null
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          devolvido_em?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          empresa_proxima_msg?:
            | Database["public"]["Enums"]["empresa_tipo"]
            | null
          estado_funil?: Database["public"]["Enums"]["estado_funil_tipo"]
          framework_ativo?: Database["public"]["Enums"]["framework_tipo"]
          framework_data?: Json | null
          id?: string
          idioma_preferido?: string
          lead_id?: string
          modo?: Database["public"]["Enums"]["atendimento_modo"]
          perfil_disc?: string | null
          perfil_investidor?: string | null
          ultima_pergunta_id?: string | null
          ultimo_contato_em?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversation_state_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_conversation_state_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_conversation_state_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_state_assumido_por_fkey"
            columns: ["assumido_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_message_intents: {
        Row: {
          acao_aplicada: boolean
          acao_detalhes: Json | null
          acao_recomendada: Database["public"]["Enums"]["sdr_acao_tipo"]
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          intent: Database["public"]["Enums"]["lead_intent_tipo"]
          intent_confidence: number
          intent_summary: string | null
          lead_id: string | null
          message_id: string
          modelo_ia: string | null
          resposta_automatica_texto: string | null
          resposta_enviada_em: string | null
          run_id: string | null
          sentimento: string | null
          tempo_processamento_ms: number | null
          tokens_usados: number | null
        }
        Insert: {
          acao_aplicada?: boolean
          acao_detalhes?: Json | null
          acao_recomendada?: Database["public"]["Enums"]["sdr_acao_tipo"]
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          intent: Database["public"]["Enums"]["lead_intent_tipo"]
          intent_confidence: number
          intent_summary?: string | null
          lead_id?: string | null
          message_id: string
          modelo_ia?: string | null
          resposta_automatica_texto?: string | null
          resposta_enviada_em?: string | null
          run_id?: string | null
          sentimento?: string | null
          tempo_processamento_ms?: number | null
          tokens_usados?: number | null
        }
        Update: {
          acao_aplicada?: boolean
          acao_detalhes?: Json | null
          acao_recomendada?: Database["public"]["Enums"]["sdr_acao_tipo"]
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          intent?: Database["public"]["Enums"]["lead_intent_tipo"]
          intent_confidence?: number
          intent_summary?: string | null
          lead_id?: string | null
          message_id?: string
          modelo_ia?: string | null
          resposta_automatica_texto?: string | null
          resposta_enviada_em?: string | null
          run_id?: string | null
          sentimento?: string | null
          tempo_processamento_ms?: number | null
          tokens_usados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_message_intents_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "lead_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_message_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "deal_cadencia_status"
            referencedColumns: ["cadence_run_id"]
          },
          {
            foreignKeyName: "lead_message_intents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lead_cadence_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          canal: Database["public"]["Enums"]["canal_tipo"]
          conteudo: string
          created_at: string
          direcao: string
          email_message_id: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          entregue_em: string | null
          enviado_em: string | null
          erro_detalhe: string | null
          estado: string
          id: string
          lead_id: string | null
          lido_em: string | null
          recebido_em: string | null
          run_id: string | null
          sender_id: string | null
          sender_type: string
          step_ordem: number | null
          template_codigo: string | null
          updated_at: string
          whatsapp_message_id: string | null
        }
        Insert: {
          canal: Database["public"]["Enums"]["canal_tipo"]
          conteudo: string
          created_at?: string
          direcao: string
          email_message_id?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          entregue_em?: string | null
          enviado_em?: string | null
          erro_detalhe?: string | null
          estado?: string
          id?: string
          lead_id?: string | null
          lido_em?: string | null
          recebido_em?: string | null
          run_id?: string | null
          sender_id?: string | null
          sender_type?: string
          step_ordem?: number | null
          template_codigo?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_tipo"]
          conteudo?: string
          created_at?: string
          direcao?: string
          email_message_id?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          entregue_em?: string | null
          enviado_em?: string | null
          erro_detalhe?: string | null
          estado?: string
          id?: string
          lead_id?: string | null
          lido_em?: string | null
          recebido_em?: string | null
          run_id?: string | null
          sender_id?: string | null
          sender_type?: string
          step_ordem?: number | null
          template_codigo?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "deal_cadencia_status"
            referencedColumns: ["cadence_run_id"]
          },
          {
            foreignKeyName: "lead_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "lead_cadence_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "lead_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mass_action_jobs: {
        Row: {
          cadence_id: string | null
          canal: string
          completed_at: string | null
          created_at: string
          deal_ids: string[]
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          failed: number
          id: string
          instrucao: string | null
          messages_preview: Json | null
          processed: number
          started_at: string | null
          started_by: string | null
          status: string
          succeeded: number
          tipo: string
          total: number
          updated_at: string
        }
        Insert: {
          cadence_id?: string | null
          canal?: string
          completed_at?: string | null
          created_at?: string
          deal_ids?: string[]
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          failed?: number
          id?: string
          instrucao?: string | null
          messages_preview?: Json | null
          processed?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          succeeded?: number
          tipo: string
          total?: number
          updated_at?: string
        }
        Update: {
          cadence_id?: string | null
          canal?: string
          completed_at?: string | null
          created_at?: string
          deal_ids?: string[]
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          failed?: number
          id?: string
          instrucao?: string | null
          messages_preview?: Json | null
          processed?: number
          started_at?: string | null
          started_by?: string | null
          status?: string
          succeeded?: number
          tipo?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_action_jobs_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_action_jobs_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadencias_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_action_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mass_action_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "mass_action_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_action_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      message_templates: {
        Row: {
          assunto_template: string | null
          ativo: boolean
          canal: Database["public"]["Enums"]["canal_tipo"]
          codigo: string
          conteudo: string
          created_at: string
          descricao: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          assunto_template?: string | null
          ativo?: boolean
          canal: Database["public"]["Enums"]["canal_tipo"]
          codigo: string
          conteudo: string
          created_at?: string
          descricao?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          assunto_template?: string | null
          ativo?: boolean
          canal?: Database["public"]["Enums"]["canal_tipo"]
          codigo?: string
          conteudo?: string
          created_at?: string
          descricao?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      metas_vendedor: {
        Row: {
          ano: number
          created_at: string
          empresa: string
          id: string
          mes: number
          meta_deals: number
          meta_valor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          empresa: string
          id?: string
          mes: number
          meta_deals?: number
          meta_valor?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          empresa?: string
          id?: string
          mes?: number
          meta_deals?: number
          meta_valor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          empresa: string
          entity_id: string | null
          entity_type: string | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizations: {
        Row: {
          ativo: boolean
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          nome_fantasia: string | null
          notas: string | null
          owner_id: string | null
          pais: string | null
          porte: string | null
          setor: string | null
          tags: string[] | null
          telefone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          notas?: string | null
          owner_id?: string | null
          pais?: string | null
          porte?: string | null
          setor?: string | null
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          ativo?: boolean
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          notas?: string | null
          owner_id?: string | null
          pais?: string | null
          porte?: string | null
          setor?: string | null
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pessoas: {
        Row: {
          created_at: string
          ddd: string | null
          email_principal: string | null
          id: string
          idioma_preferido: string
          nome: string
          perfil_disc: string | null
          telefone_base: string | null
          telefone_e164: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ddd?: string | null
          email_principal?: string | null
          id?: string
          idioma_preferido?: string
          nome: string
          perfil_disc?: string | null
          telefone_base?: string | null
          telefone_e164?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ddd?: string | null
          email_principal?: string | null
          id?: string
          idioma_preferido?: string
          nome?: string
          perfil_disc?: string | null
          telefone_base?: string | null
          telefone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          cor: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          nome: string
          pipeline_id: string
          posicao: number
          sla_minutos: number | null
          tempo_minimo_dias: number | null
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          nome: string
          pipeline_id: string
          posicao: number
          sla_minutos?: number | null
          tempo_minimo_dias?: number | null
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          nome?: string
          pipeline_id?: string
          posicao?: number
          sla_minutos?: number | null
          tempo_minimo_dias?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      pipelines: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          is_default: boolean
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          is_default?: boolean
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          is_default?: boolean
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_knowledge: {
        Row: {
          ativo: boolean
          created_at: string
          descricao_curta: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          produto_id: string
          produto_nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          produto_id: string
          produto_nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao_curta?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          produto_id?: string
          produto_nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          empresa_id: string | null
          gestor_id: string | null
          google_id: string | null
          id: string
          is_active: boolean
          is_vendedor: boolean
          last_login_at: string | null
          nome: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          gestor_id?: string | null
          google_id?: string | null
          id: string
          is_active?: boolean
          is_vendedor?: boolean
          last_login_at?: string | null
          nome?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          gestor_id?: string | null
          google_id?: string | null
          id?: string
          is_active?: boolean
          is_vendedor?: boolean
          last_login_at?: string | null
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sazonalidade_indices: {
        Row: {
          empresa: string
          id: string
          indice: number
          mes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          empresa: string
          id?: string
          indice?: number
          mes: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          empresa?: string
          id?: string
          indice?: number
          mes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sazonalidade_indices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sazonalidade_indices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sazonalidade_indices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sazonalidade_indices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      seller_badge_awards: {
        Row: {
          awarded_at: string
          badge_key: string
          empresa: string
          id: string
          referencia: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_key: string
          empresa: string
          id?: string
          referencia?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_key?: string
          empresa?: string
          id?: string
          referencia?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_badge_awards_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "seller_badges"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "seller_badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "seller_badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "seller_badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_badge_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      seller_badges: {
        Row: {
          categoria: string
          created_at: string
          criterio_valor: number
          descricao: string | null
          icone: string
          id: string
          key: string
          nome: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          criterio_valor?: number
          descricao?: string | null
          icone?: string
          id?: string
          key: string
          nome: string
        }
        Update: {
          categoria?: string
          created_at?: string
          criterio_valor?: number
          descricao?: string | null
          icone?: string
          id?: string
          key?: string
          nome?: string
        }
        Relationships: []
      }
      seller_points_log: {
        Row: {
          created_at: string
          empresa: string
          id: string
          pontos: number
          referencia_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa: string
          id?: string
          pontos?: number
          referencia_id?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa?: string
          id?: string
          pontos?: number
          referencia_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "seller_points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "seller_points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sgt_event_logs: {
        Row: {
          created_at: string
          erro_stack: string | null
          event_id: string
          id: string
          mensagem: string | null
          status: Database["public"]["Enums"]["sgt_event_status"]
        }
        Insert: {
          created_at?: string
          erro_stack?: string | null
          event_id: string
          id?: string
          mensagem?: string | null
          status: Database["public"]["Enums"]["sgt_event_status"]
        }
        Update: {
          created_at?: string
          erro_stack?: string | null
          event_id?: string
          id?: string
          mensagem?: string | null
          status?: Database["public"]["Enums"]["sgt_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sgt_event_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "sgt_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sgt_events: {
        Row: {
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          evento: Database["public"]["Enums"]["sgt_evento_tipo"]
          id: string
          idempotency_key: string
          lead_id: string
          payload: Json
          processado_em: string | null
          recebido_em: string
        }
        Insert: {
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          evento: Database["public"]["Enums"]["sgt_evento_tipo"]
          id?: string
          idempotency_key: string
          lead_id: string
          payload: Json
          processado_em?: string | null
          recebido_em?: string
        }
        Update: {
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          evento?: Database["public"]["Enums"]["sgt_evento_tipo"]
          id?: string
          idempotency_key?: string
          lead_id?: string
          payload?: Json
          processado_em?: string | null
          recebido_em?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_access_assignments: {
        Row: {
          access_profile_id: string
          assigned_by: string | null
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_profile_id: string
          assigned_by?: string | null
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"] | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_profile_id?: string
          assigned_by?: string | null
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"] | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_assignments_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_access_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_access_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_access_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_access_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_access_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      zadarma_config: {
        Row: {
          api_key: string
          api_secret: string
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          updated_at: string
          webhook_enabled: boolean
          webrtc_enabled: boolean
        }
        Insert: {
          api_key: string
          api_secret: string
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          updated_at?: string
          webhook_enabled?: boolean
          webrtc_enabled?: boolean
        }
        Update: {
          api_key?: string
          api_secret?: string
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          updated_at?: string
          webhook_enabled?: boolean
          webrtc_enabled?: boolean
        }
        Relationships: []
      }
      zadarma_extensions: {
        Row: {
          created_at: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          extension_number: string
          id: string
          is_active: boolean
          sip_login: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          extension_number: string
          id?: string
          is_active?: boolean
          sip_login?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          extension_number?: string
          id?: string
          is_active?: boolean
          sip_login?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zadarma_extensions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "zadarma_extensions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "zadarma_extensions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zadarma_extensions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      analytics_canal_esforco: {
        Row: {
          canal: string | null
          deals_ganhos: number | null
          deals_perdidos: number | null
          empresa: string | null
          media_atividades_perdidos: number | null
          media_dias_funil_perdidos: number | null
          pipeline_id: string | null
          sem_atividade_pct: number | null
          total_deals: number | null
          valor_ganho: number | null
          win_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      analytics_canal_origem: {
        Row: {
          canal: string | null
          deals_ganhos: number | null
          deals_perdidos: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_id: string | null
          total_deals: number | null
          valor_ganho: number | null
          win_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      analytics_conversion: {
        Row: {
          ciclo_medio_dias: number | null
          deals_abertos: number | null
          deals_ganhos: number | null
          deals_perdidos: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_id: string | null
          pipeline_nome: string | null
          ticket_medio_ganho: number | null
          total_deals: number | null
          valor_ganho: number | null
          valor_pipeline_aberto: number | null
          win_rate: number | null
        }
        Relationships: []
      }
      analytics_deals_periodo: {
        Row: {
          deals_ganhos: number | null
          deals_perdidos: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          mes: string | null
          pipeline_id: string | null
          total_deals: number | null
          valor_ganho: number | null
          valor_perdido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      analytics_esforco_vendedor: {
        Row: {
          empresa: string | null
          media_atividades: number | null
          media_dias_funil: number | null
          perdidos_menos_24h: number | null
          sem_atividade_pct: number | null
          total_perdidos: number | null
          user_id: string | null
          vendedor_nome: string | null
        }
        Relationships: []
      }
      analytics_evolucao_mensal: {
        Row: {
          deals_criados: number | null
          deals_ganhos: number | null
          deals_perdidos: number | null
          empresa: string | null
          mes: string | null
          pipeline_id: string | null
          ticket_medio: number | null
          valor_ganho: number | null
          valor_perdido: number | null
          win_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      analytics_funil_visual: {
        Row: {
          deals_entrada: number | null
          deals_saida: number | null
          empresa: string | null
          pipeline_id: string | null
          pipeline_nome: string | null
          posicao: number | null
          stage_id: string | null
          stage_nome: string | null
          taxa_conversao: number | null
          valor_entrada: number | null
          valor_saida: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      analytics_funnel: {
        Row: {
          deals_ativos: number | null
          deals_count: number | null
          deals_valor: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_id: string | null
          pipeline_nome: string | null
          posicao: number | null
          stage_id: string | null
          stage_nome: string | null
          tempo_medio_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      analytics_ltv_cohort: {
        Row: {
          cohort_mes: string | null
          deals_ganhos: number | null
          empresa: string | null
          ltv_medio: number | null
          total_deals: number | null
          valor_total: number | null
          win_rate: number | null
        }
        Relationships: []
      }
      analytics_motivos_perda: {
        Row: {
          categoria: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          motivo: string | null
          pipeline_id: string | null
          quantidade: number | null
          valor_perdido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      analytics_vendedor: {
        Row: {
          atividades_7d: number | null
          deals_abertos: number | null
          deals_ganhos: number | null
          deals_perdidos: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          total_deals: number | null
          user_id: string | null
          valor_ganho: number | null
          vendedor_nome: string | null
          win_rate: number | null
        }
        Relationships: []
      }
      cadencias_crm: {
        Row: {
          ativo: boolean | null
          canal_principal: Database["public"]["Enums"]["canal_tipo"] | null
          codigo: string | null
          deals_ativos: number | null
          deals_completados: number | null
          deals_total: number | null
          descricao: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          id: string | null
          nome: string | null
          total_steps: number | null
          triggers: Json | null
        }
        Insert: {
          ativo?: boolean | null
          canal_principal?: Database["public"]["Enums"]["canal_tipo"] | null
          codigo?: string | null
          deals_ativos?: never
          deals_completados?: never
          deals_total?: never
          descricao?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"] | null
          id?: string | null
          nome?: string | null
          total_steps?: never
          triggers?: never
        }
        Update: {
          ativo?: boolean | null
          canal_principal?: Database["public"]["Enums"]["canal_tipo"] | null
          codigo?: string | null
          deals_ativos?: never
          deals_completados?: never
          deals_total?: never
          descricao?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"] | null
          id?: string | null
          nome?: string | null
          total_steps?: never
          triggers?: never
        }
        Relationships: []
      }
      call_stats_by_user: {
        Row: {
          ano: number | null
          atendidas: number | null
          duracao_media: number | null
          duracao_total: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          mes: number | null
          perdidas: number | null
          total_chamadas: number | null
          user_id: string | null
          user_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      comissao_resumo_mensal: {
        Row: {
          ano: number | null
          aprovados: number | null
          comissao_total: number | null
          empresa: string | null
          mes: number | null
          pagos: number | null
          pendentes: number | null
          user_id: string | null
          valor_aprovado: number | null
          valor_pago: number | null
          valor_pendente: number | null
          vendedor_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissao_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contacts_with_stats: {
        Row: {
          canal_origem: string | null
          cpf: string | null
          created_at: string | null
          deals_abertos: number | null
          deals_count: number | null
          deals_valor_total: number | null
          email: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          endereco: string | null
          foto_url: string | null
          id: string | null
          is_active: boolean | null
          is_cliente: boolean | null
          legacy_lead_id: string | null
          linkedin_cargo: string | null
          linkedin_empresa: string | null
          linkedin_setor: string | null
          linkedin_url: string | null
          nome: string | null
          notas: string | null
          opt_out: boolean | null
          org_nome: string | null
          org_nome_fantasia: string | null
          organization_id: string | null
          origem_telefone: string | null
          owner_avatar: string | null
          owner_id: string | null
          owner_nome: string | null
          pessoa_id: string | null
          primeiro_nome: string | null
          prioridade_marketing: string | null
          rg: string | null
          score_marketing: number | null
          sobrenome: string | null
          tags: string[] | null
          telefone: string | null
          telefone_e164: string | null
          telefone_valido: boolean | null
          telegram: string | null
          tipo: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_cadencia_status: {
        Row: {
          bridge_status: string | null
          cadence_codigo: string | null
          cadence_id: string | null
          cadence_nome: string | null
          cadence_run_id: string | null
          deal_cadence_run_id: string | null
          deal_id: string | null
          last_step_ordem: number | null
          next_run_at: string | null
          next_step_ordem: number | null
          run_status: Database["public"]["Enums"]["cadence_run_status"] | null
          started_at: string | null
          total_steps: number | null
          trigger_stage_id: string | null
          trigger_stage_nome: string | null
          trigger_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_cadence_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_cadence_runs_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "lead_cadence_runs_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadence_runs_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadencias_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      deals_full_detail: {
        Row: {
          canal_origem: string | null
          categoria_perda_closer: string | null
          categoria_perda_final: string | null
          categoria_perda_ia: string | null
          contact_email: string | null
          contact_foto_url: string | null
          contact_id: string | null
          contact_nome: string | null
          contact_telefone: string | null
          created_at: string | null
          data_ganho: string | null
          data_perda: string | null
          data_previsao_fechamento: string | null
          etiqueta: string | null
          fbclid: string | null
          fechado_em: string | null
          gclid: string | null
          id: string | null
          metadata: Json | null
          minutos_no_stage: number | null
          moeda: string | null
          motivo_perda: string | null
          motivo_perda_closer: string | null
          motivo_perda_final: string | null
          motivo_perda_ia: string | null
          notas: string | null
          org_nome: string | null
          organization_id: string | null
          owner_avatar_url: string | null
          owner_email: string | null
          owner_id: string | null
          owner_nome: string | null
          perda_resolvida: boolean | null
          perda_resolvida_em: string | null
          perda_resolvida_por: string | null
          pipeline_empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_id: string | null
          pipeline_nome: string | null
          posicao_kanban: number | null
          score_engajamento: number | null
          score_intencao: number | null
          score_urgencia: number | null
          score_valor: number | null
          sla_minutos: number | null
          stage_cor: string | null
          stage_fechamento_id: string | null
          stage_id: string | null
          stage_is_lost: boolean | null
          stage_is_won: boolean | null
          stage_nome: string | null
          stage_origem_id: string | null
          stage_posicao: number | null
          status: string | null
          temperatura: Database["public"]["Enums"]["temperatura_tipo"] | null
          tempo_minimo_dias: number | null
          titulo: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_perda_resolvida_por_fkey"
            columns: ["perda_resolvida_por"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_fechamento_id_fkey"
            columns: ["stage_fechamento_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_origem_id_fkey"
            columns: ["stage_origem_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      import_jobs_summary: {
        Row: {
          completed_at: string | null
          config: Json | null
          contacts_mapped: number | null
          created_at: string | null
          deals_mapped: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          error_log: Json | null
          errors: number | null
          id: string | null
          imported: number | null
          orgs_mapped: number | null
          skipped: number | null
          started_at: string | null
          started_by: string | null
          started_by_nome: string | null
          status: string | null
          tipo: string | null
          total_records: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      meta_progresso: {
        Row: {
          ano: number | null
          comissao_mes: number | null
          empresa: string | null
          mes: number | null
          meta_deals: number | null
          meta_id: string | null
          meta_valor: number | null
          pct_deals: number | null
          pct_valor: number | null
          pipeline_aberto: number | null
          realizado_deals: number | null
          realizado_valor: number | null
          user_id: string | null
          vendedor_avatar: string | null
          vendedor_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_vendedor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      organizations_with_stats: {
        Row: {
          ativo: boolean | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          contacts_count: number | null
          created_at: string | null
          deals_abertos: number | null
          deals_count: number | null
          deals_valor_total: number | null
          email: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          endereco: string | null
          estado: string | null
          id: string | null
          nome: string | null
          nome_fantasia: string | null
          notas: string | null
          owner_avatar: string | null
          owner_id: string | null
          owner_nome: string | null
          pais: string | null
          porte: string | null
          setor: string | null
          tags: string[] | null
          telefone: string | null
          updated_at: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pipeline_stage_projection: {
        Row: {
          deals_count: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          owner_id: string | null
          pipeline_id: string | null
          pipeline_nome: string | null
          stage_id: string | null
          stage_nome: string | null
          taxa_conversao: number | null
          valor_projetado: number | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      seller_leaderboard: {
        Row: {
          empresa: string | null
          pontos_mes: number | null
          ranking_posicao: number | null
          streak_dias: number | null
          total_badges: number | null
          user_id: string | null
          vendedor_avatar: string | null
          vendedor_nome: string | null
        }
        Relationships: []
      }
      stage_conversion_rates: {
        Row: {
          deals_ganhos: number | null
          empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_id: string | null
          pipeline_nome: string | null
          stage_id: string | null
          stage_nome: string | null
          taxa_conversao: number | null
          total_deals: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "analytics_conversion"
            referencedColumns: ["pipeline_id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "workbench_pipeline_summary"
            referencedColumns: ["pipeline_id"]
          },
        ]
      }
      workbench_pipeline_summary: {
        Row: {
          deals_abertos: number | null
          deals_ganhos: number | null
          deals_perdidos: number | null
          owner_id: string | null
          pipeline_empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_id: string | null
          pipeline_nome: string | null
          valor_aberto: number | null
          valor_ganho: number | null
          valor_perdido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
      workbench_sla_alerts: {
        Row: {
          contact_nome: string | null
          deal_id: string | null
          deal_titulo: string | null
          deal_valor: number | null
          minutos_no_stage: number | null
          owner_id: string | null
          pipeline_empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_nome: string | null
          sla_estourado: boolean | null
          sla_minutos: number | null
          sla_percentual: number | null
          stage_cor: string | null
          stage_id: string | null
          stage_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funil_visual"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "analytics_funnel"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stage_projection"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage_conversion_rates"
            referencedColumns: ["stage_id"]
          },
        ]
      }
      workbench_tarefas: {
        Row: {
          contact_nome: string | null
          created_at: string | null
          deal_id: string | null
          deal_status: string | null
          deal_titulo: string | null
          deal_valor: number | null
          descricao: string | null
          id: string | null
          owner_id: string | null
          pipeline_empresa: Database["public"]["Enums"]["empresa_tipo"] | null
          pipeline_nome: string | null
          stage_cor: string | null
          stage_nome: string | null
          tarefa_concluida: boolean | null
          tarefa_prazo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals_full_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "workbench_sla_alerts"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_esforco_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "analytics_vendedor"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "seller_leaderboard"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      fn_calc_deal_score: { Args: { p_deal_id: string }; Returns: number }
      get_user_empresa: { Args: { _user_id: string }; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_conversation_with_intent: {
        Args: {
          p_cadence_action?: string
          p_cadence_run_id?: string
          p_canal: string
          p_empresa: string
          p_intent_data: Json
          p_lead_id: string
          p_state_updates: Json
        }
        Returns: Json
      }
    }
    Enums: {
      atendimento_modo: "SDR_IA" | "MANUAL" | "HIBRIDO"
      cadence_event_tipo:
        | "AGENDADO"
        | "DISPARADO"
        | "ERRO"
        | "RESPOSTA_DETECTADA"
      cadence_run_status: "ATIVA" | "CONCLUIDA" | "CANCELADA" | "PAUSADA"
      canal_tipo: "WHATSAPP" | "EMAIL" | "SMS"
      classificacao_origem: "AUTOMATICA" | "MANUAL"
      custom_field_entity_type: "CONTACT" | "ORGANIZATION" | "DEAL"
      custom_field_value_type:
        | "TEXT"
        | "TEXTAREA"
        | "NUMBER"
        | "CURRENCY"
        | "DATE"
        | "DATETIME"
        | "BOOLEAN"
        | "SELECT"
        | "MULTISELECT"
        | "EMAIL"
        | "PHONE"
        | "URL"
        | "PERCENT"
        | "TAG"
      empresa_tipo: "TOKENIZA" | "BLUE"
      estado_funil_tipo:
        | "SAUDACAO"
        | "DIAGNOSTICO"
        | "QUALIFICACAO"
        | "OBJECOES"
        | "FECHAMENTO"
        | "POS_VENDA"
      framework_tipo: "GPCT" | "BANT" | "SPIN" | "NONE"
      icp_tipo:
        | "TOKENIZA_SERIAL"
        | "TOKENIZA_MEDIO_PRAZO"
        | "TOKENIZA_EMERGENTE"
        | "TOKENIZA_ALTO_VOLUME_DIGITAL"
        | "TOKENIZA_NAO_CLASSIFICADO"
        | "BLUE_ALTO_TICKET_IR"
        | "BLUE_RECURRENTE"
        | "BLUE_PERDIDO_RECUPERAVEL"
        | "BLUE_NAO_CLASSIFICADO"
      knowledge_section_tipo:
        | "FAQ"
        | "OBJECOES"
        | "PITCH"
        | "RISCOS"
        | "ESTRUTURA_JURIDICA"
        | "GERAL"
      lead_contact_issue_tipo:
        | "SEM_CANAL_CONTATO"
        | "EMAIL_PLACEHOLDER"
        | "EMAIL_INVALIDO"
        | "TELEFONE_LIXO"
        | "TELEFONE_SEM_WHATSAPP"
        | "DADO_SUSPEITO"
      lead_intent_tipo:
        | "INTERESSE_COMPRA"
        | "DUVIDA_PRODUTO"
        | "DUVIDA_PRECO"
        | "SOLICITACAO_CONTATO"
        | "AGENDAMENTO_REUNIAO"
        | "RECLAMACAO"
        | "OPT_OUT"
        | "NAO_ENTENDI"
        | "CUMPRIMENTO"
        | "AGRADECIMENTO"
        | "FORA_CONTEXTO"
        | "OUTRO"
        | "INTERESSE_IR"
        | "OBJECAO_PRECO"
        | "OBJECAO_RISCO"
        | "SEM_INTERESSE"
        | "DUVIDA_TECNICA"
      persona_tipo:
        | "CONSTRUTOR_PATRIMONIO"
        | "COLECIONADOR_DIGITAL"
        | "INICIANTE_CAUTELOSO"
        | "CRIPTO_CONTRIBUINTE_URGENTE"
        | "CLIENTE_FIEL_RENOVADOR"
        | "LEAD_PERDIDO_RECUPERAVEL"
      pessoa_relacao_tipo:
        | "CLIENTE_IR"
        | "LEAD_IR"
        | "INVESTIDOR"
        | "LEAD_INVESTIDOR"
        | "DESCONHECIDO"
      sdr_acao_tipo:
        | "PAUSAR_CADENCIA"
        | "CANCELAR_CADENCIA"
        | "RETOMAR_CADENCIA"
        | "AJUSTAR_TEMPERATURA"
        | "CRIAR_TAREFA_CLOSER"
        | "MARCAR_OPT_OUT"
        | "NENHUMA"
        | "ESCALAR_HUMANO"
        | "ENVIAR_RESPOSTA_AUTOMATICA"
        | "HANDOFF_EMPRESA"
      sgt_event_status: "RECEBIDO" | "PROCESSADO" | "ERRO"
      sgt_evento_tipo:
        | "LEAD_NOVO"
        | "ATUALIZACAO"
        | "CARRINHO_ABANDONADO"
        | "MQL"
        | "SCORE_ATUALIZADO"
        | "CLIQUE_OFERTA"
        | "FUNIL_ATUALIZADO"
      temperatura_tipo: "FRIO" | "MORNO" | "QUENTE"
      user_role:
        | "ADMIN"
        | "CLOSER"
        | "MARKETING"
        | "AUDITOR"
        | "READONLY"
        | "SDR_IA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      atendimento_modo: ["SDR_IA", "MANUAL", "HIBRIDO"],
      cadence_event_tipo: [
        "AGENDADO",
        "DISPARADO",
        "ERRO",
        "RESPOSTA_DETECTADA",
      ],
      cadence_run_status: ["ATIVA", "CONCLUIDA", "CANCELADA", "PAUSADA"],
      canal_tipo: ["WHATSAPP", "EMAIL", "SMS"],
      classificacao_origem: ["AUTOMATICA", "MANUAL"],
      custom_field_entity_type: ["CONTACT", "ORGANIZATION", "DEAL"],
      custom_field_value_type: [
        "TEXT",
        "TEXTAREA",
        "NUMBER",
        "CURRENCY",
        "DATE",
        "DATETIME",
        "BOOLEAN",
        "SELECT",
        "MULTISELECT",
        "EMAIL",
        "PHONE",
        "URL",
        "PERCENT",
        "TAG",
      ],
      empresa_tipo: ["TOKENIZA", "BLUE"],
      estado_funil_tipo: [
        "SAUDACAO",
        "DIAGNOSTICO",
        "QUALIFICACAO",
        "OBJECOES",
        "FECHAMENTO",
        "POS_VENDA",
      ],
      framework_tipo: ["GPCT", "BANT", "SPIN", "NONE"],
      icp_tipo: [
        "TOKENIZA_SERIAL",
        "TOKENIZA_MEDIO_PRAZO",
        "TOKENIZA_EMERGENTE",
        "TOKENIZA_ALTO_VOLUME_DIGITAL",
        "TOKENIZA_NAO_CLASSIFICADO",
        "BLUE_ALTO_TICKET_IR",
        "BLUE_RECURRENTE",
        "BLUE_PERDIDO_RECUPERAVEL",
        "BLUE_NAO_CLASSIFICADO",
      ],
      knowledge_section_tipo: [
        "FAQ",
        "OBJECOES",
        "PITCH",
        "RISCOS",
        "ESTRUTURA_JURIDICA",
        "GERAL",
      ],
      lead_contact_issue_tipo: [
        "SEM_CANAL_CONTATO",
        "EMAIL_PLACEHOLDER",
        "EMAIL_INVALIDO",
        "TELEFONE_LIXO",
        "TELEFONE_SEM_WHATSAPP",
        "DADO_SUSPEITO",
      ],
      lead_intent_tipo: [
        "INTERESSE_COMPRA",
        "DUVIDA_PRODUTO",
        "DUVIDA_PRECO",
        "SOLICITACAO_CONTATO",
        "AGENDAMENTO_REUNIAO",
        "RECLAMACAO",
        "OPT_OUT",
        "NAO_ENTENDI",
        "CUMPRIMENTO",
        "AGRADECIMENTO",
        "FORA_CONTEXTO",
        "OUTRO",
        "INTERESSE_IR",
        "OBJECAO_PRECO",
        "OBJECAO_RISCO",
        "SEM_INTERESSE",
        "DUVIDA_TECNICA",
      ],
      persona_tipo: [
        "CONSTRUTOR_PATRIMONIO",
        "COLECIONADOR_DIGITAL",
        "INICIANTE_CAUTELOSO",
        "CRIPTO_CONTRIBUINTE_URGENTE",
        "CLIENTE_FIEL_RENOVADOR",
        "LEAD_PERDIDO_RECUPERAVEL",
      ],
      pessoa_relacao_tipo: [
        "CLIENTE_IR",
        "LEAD_IR",
        "INVESTIDOR",
        "LEAD_INVESTIDOR",
        "DESCONHECIDO",
      ],
      sdr_acao_tipo: [
        "PAUSAR_CADENCIA",
        "CANCELAR_CADENCIA",
        "RETOMAR_CADENCIA",
        "AJUSTAR_TEMPERATURA",
        "CRIAR_TAREFA_CLOSER",
        "MARCAR_OPT_OUT",
        "NENHUMA",
        "ESCALAR_HUMANO",
        "ENVIAR_RESPOSTA_AUTOMATICA",
        "HANDOFF_EMPRESA",
      ],
      sgt_event_status: ["RECEBIDO", "PROCESSADO", "ERRO"],
      sgt_evento_tipo: [
        "LEAD_NOVO",
        "ATUALIZACAO",
        "CARRINHO_ABANDONADO",
        "MQL",
        "SCORE_ATUALIZADO",
        "CLIQUE_OFERTA",
        "FUNIL_ATUALIZADO",
      ],
      temperatura_tipo: ["FRIO", "MORNO", "QUENTE"],
      user_role: [
        "ADMIN",
        "CLOSER",
        "MARKETING",
        "AUDITOR",
        "READONLY",
        "SDR_IA",
      ],
    },
  },
} as const
