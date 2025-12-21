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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_contacts: {
        Row: {
          blue_client_id: string | null
          contato_internacional: boolean
          created_at: string
          ddi: string | null
          email: string | null
          email_placeholder: boolean
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          lead_id: string
          nome: string | null
          numero_nacional: string | null
          opt_out: boolean
          opt_out_em: string | null
          opt_out_motivo: string | null
          origem_telefone: string | null
          pessoa_id: string | null
          pipedrive_deal_id: string | null
          pipedrive_person_id: string | null
          primeiro_nome: string | null
          telefone: string | null
          telefone_e164: string | null
          telefone_validado_em: string | null
          telefone_valido: boolean
          tokeniza_investor_id: string | null
          updated_at: string
        }
        Insert: {
          blue_client_id?: string | null
          contato_internacional?: boolean
          created_at?: string
          ddi?: string | null
          email?: string | null
          email_placeholder?: boolean
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id: string
          nome?: string | null
          numero_nacional?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          origem_telefone?: string | null
          pessoa_id?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_person_id?: string | null
          primeiro_nome?: string | null
          telefone?: string | null
          telefone_e164?: string | null
          telefone_validado_em?: string | null
          telefone_valido?: boolean
          tokeniza_investor_id?: string | null
          updated_at?: string
        }
        Update: {
          blue_client_id?: string | null
          contato_internacional?: boolean
          created_at?: string
          ddi?: string | null
          email?: string | null
          email_placeholder?: boolean
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id?: string
          nome?: string | null
          numero_nacional?: string | null
          opt_out?: boolean
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          origem_telefone?: string | null
          pessoa_id?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_person_id?: string | null
          primeiro_nome?: string | null
          telefone?: string | null
          telefone_e164?: string | null
          telefone_validado_em?: string | null
          telefone_valido?: boolean
          tokeniza_investor_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          canal: Database["public"]["Enums"]["canal_tipo"]
          created_at: string
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
          perfil_disc: string | null
          ultima_pergunta_id: string | null
          ultimo_contato_em: string
          updated_at: string
        }
        Insert: {
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
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
          perfil_disc?: string | null
          ultima_pergunta_id?: string | null
          ultimo_contato_em?: string
          updated_at?: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
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
          perfil_disc?: string | null
          ultima_pergunta_id?: string | null
          ultimo_contato_em?: string
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "lead_cadence_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
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
          google_id: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          nome: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          google_id?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          nome?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          google_id?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      cadence_event_tipo:
        | "AGENDADO"
        | "DISPARADO"
        | "ERRO"
        | "RESPOSTA_DETECTADA"
      cadence_run_status: "ATIVA" | "CONCLUIDA" | "CANCELADA" | "PAUSADA"
      canal_tipo: "WHATSAPP" | "EMAIL" | "SMS"
      classificacao_origem: "AUTOMATICA" | "MANUAL"
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
      cadence_event_tipo: [
        "AGENDADO",
        "DISPARADO",
        "ERRO",
        "RESPOSTA_DETECTADA",
      ],
      cadence_run_status: ["ATIVA", "CONCLUIDA", "CANCELADA", "PAUSADA"],
      canal_tipo: ["WHATSAPP", "EMAIL", "SMS"],
      classificacao_origem: ["AUTOMATICA", "MANUAL"],
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
