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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      order_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_status: string | null
          old_status: string | null
          resume_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          resume_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_status?: string | null
          old_status?: string | null
          resume_id?: string
        }
        Relationships: []
      }
      pix_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          pix_key: string
          plan_id: string
          qr_code_object_path: string | null
          recipient_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pix_key?: string
          plan_id: string
          qr_code_object_path?: string | null
          recipient_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pix_key?: string
          plan_id?: string
          qr_code_object_path?: string | null
          recipient_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_configs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          description: string
          features: Json
          id: string
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      resumes: {
        Row: {
          access_token: string
          admin_notes: string | null
          amount_cents: number | null
          approved_at: string | null
          approved_by: string | null
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          data: Json
          download_released: boolean
          id: string
          payment_proof_path: string | null
          payment_status: string
          plan: string
          released_at: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string
          admin_notes?: string | null
          amount_cents?: number | null
          approved_at?: string | null
          approved_by?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          data?: Json
          download_released?: boolean
          id?: string
          payment_proof_path?: string | null
          payment_status?: string
          plan?: string
          released_at?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          admin_notes?: string | null
          amount_cents?: number | null
          approved_at?: string | null
          approved_by?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          data?: Json
          download_released?: boolean
          id?: string
          payment_proof_path?: string | null
          payment_status?: string
          plan?: string
          released_at?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          data: Json
          id: number
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: number
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string
          clean_background_url: string | null
          created_at: string
          creation_type: string | null
          generated_html: string | null
          id: string
          is_active: boolean
          name: string
          preview_url: string
          prompt: string | null
          reference_file_url: string | null
          template_schema: Json | null
          updated_at: string
        }
        Insert: {
          category: string
          clean_background_url?: string | null
          created_at?: string
          creation_type?: string | null
          generated_html?: string | null
          id?: string
          is_active?: boolean
          name: string
          preview_url?: string
          prompt?: string | null
          reference_file_url?: string | null
          template_schema?: Json | null
          updated_at?: string
        }
        Update: {
          category?: string
          clean_background_url?: string | null
          created_at?: string
          creation_type?: string | null
          generated_html?: string | null
          id?: string
          is_active?: boolean
          name?: string
          preview_url?: string
          prompt?: string | null
          reference_file_url?: string | null
          template_schema?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      admin_release_download: {
        Args: { _release: boolean; _resume_id: string }
        Returns: undefined
      }
      admin_save_plan_and_pix: {
        Args: {
          _pix_key: string
          _price_cents: number
          _qr_code_object_path: string
          _recipient_name: string
          _slug: string
        }
        Returns: string
      }
      admin_set_payment: {
        Args: { _approve: boolean; _resume_id: string }
        Returns: undefined
      }
      claim_first_admin: { Args: never; Returns: boolean }
      get_checkout: {
        Args: { _token: string }
        Returns: {
          amount_cents: number
          payment_status: string
          pix_key: string
          qr_code_object_path: string
          recipient_name: string
        }[]
      }
      get_resume_status: {
        Args: { _token: string }
        Returns: {
          data: Json
          download_released: boolean
          payment_status: string
          plan: string
          template_id: string
        }[]
      }
      has_any_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      save_resume: {
        Args: {
          _client_email: string
          _client_name: string
          _client_phone: string
          _data: Json
          _plan: string
          _template_id: string
          _token: string
        }
        Returns: string
      }
      seed_default_plans: { Args: never; Returns: undefined }
      set_payment_proof: {
        Args: { _path: string; _token: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
