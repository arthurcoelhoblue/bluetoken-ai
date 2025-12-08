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
      empresa_tipo: "TOKENIZA" | "BLUE"
      sgt_event_status: "RECEBIDO" | "PROCESSADO" | "ERRO"
      sgt_evento_tipo:
        | "LEAD_NOVO"
        | "ATUALIZACAO"
        | "CARRINHO_ABANDONADO"
        | "MQL"
        | "SCORE_ATUALIZADO"
        | "CLIQUE_OFERTA"
        | "FUNIL_ATUALIZADO"
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
      empresa_tipo: ["TOKENIZA", "BLUE"],
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
