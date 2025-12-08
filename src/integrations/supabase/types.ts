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
      lead_contacts: {
        Row: {
          created_at: string
          email: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id: string
          lead_id: string
          nome: string | null
          primeiro_nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id: string
          nome?: string | null
          primeiro_nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa?: Database["public"]["Enums"]["empresa_tipo"]
          id?: string
          lead_id?: string
          nome?: string | null
          primeiro_nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      persona_tipo:
        | "CONSTRUTOR_PATRIMONIO"
        | "COLECIONADOR_DIGITAL"
        | "INICIANTE_CAUTELOSO"
        | "CRIPTO_CONTRIBUINTE_URGENTE"
        | "CLIENTE_FIEL_RENOVADOR"
        | "LEAD_PERDIDO_RECUPERAVEL"
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
      persona_tipo: [
        "CONSTRUTOR_PATRIMONIO",
        "COLECIONADOR_DIGITAL",
        "INICIANTE_CAUTELOSO",
        "CRIPTO_CONTRIBUINTE_URGENTE",
        "CLIENTE_FIEL_RENOVADOR",
        "LEAD_PERDIDO_RECUPERAVEL",
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
