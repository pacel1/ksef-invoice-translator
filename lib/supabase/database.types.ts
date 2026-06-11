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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      credit_balances: {
        Row: {
          free_credits_period_start: string
          free_credits_remaining: number
          paid_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          free_credits_period_start?: string
          free_credits_remaining?: number
          paid_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          free_credits_period_start?: string
          free_credits_remaining?: number
          paid_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          balance_free_after: number
          balance_paid_after: number
          created_at: string
          delta_free: number
          delta_paid: number
          event_type: string
          id: string
          invoice_id: string | null
          note: string | null
          stripe_purchase_id: string | null
          user_id: string
        }
        Insert: {
          balance_free_after: number
          balance_paid_after: number
          created_at?: string
          delta_free?: number
          delta_paid?: number
          event_type: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          stripe_purchase_id?: string | null
          user_id: string
        }
        Update: {
          balance_free_after?: number
          balance_paid_after?: number
          created_at?: string
          delta_free?: number
          delta_paid?: number
          event_type?: string
          id?: string
          invoice_id?: string | null
          note?: string | null
          stripe_purchase_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_stripe_purchase_fk"
            columns: ["stripe_purchase_id"]
            isOneToOne: false
            referencedRelation: "stripe_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_usage: {
        Row: {
          day: string
          ip_hash: string
          pdf_count: number
          translate_count: number
          unlock_count: number
        }
        Insert: {
          day: string
          ip_hash: string
          pdf_count?: number
          translate_count?: number
          unlock_count?: number
        }
        Update: {
          day?: string
          ip_hash?: string
          pdf_count?: number
          translate_count?: number
          unlock_count?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          currency: string | null
          deleted_at: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          source_data: Json
          source_hash: string
          source_size: number
          source_type: string
          total_gross: number | null
          user_id: string
          warnings: string[]
        }
        Insert: {
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          source_data: Json
          source_hash: string
          source_size: number
          source_type: string
          total_gross?: number | null
          user_id: string
          warnings?: string[]
        }
        Update: {
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          source_data?: Json
          source_hash?: string
          source_size?: number
          source_type?: string
          total_gross?: number | null
          user_id?: string
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ksef_invoices: {
        Row: {
          attempt_count: number
          created_at: string
          gov_id: string | null
          gov_status: string
          id: string
          kind: string
          last_error: string | null
          parent_id: string | null
          pdf_url: string | null
          provider_invoice_id: string | null
          stripe_purchase_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          gov_id?: string | null
          gov_status?: string
          id?: string
          kind: string
          last_error?: string | null
          parent_id?: string | null
          pdf_url?: string | null
          provider_invoice_id?: string | null
          stripe_purchase_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          gov_id?: string | null
          gov_status?: string
          id?: string
          kind?: string
          last_error?: string | null
          parent_id?: string | null
          pdf_url?: string | null
          provider_invoice_id?: string | null
          stripe_purchase_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ksef_invoices_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ksef_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ksef_invoices_stripe_purchase_id_fkey"
            columns: ["stripe_purchase_id"]
            isOneToOne: false
            referencedRelation: "stripe_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          locale: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          locale?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          locale?: string
        }
        Relationships: []
      }
      stripe_purchases: {
        Row: {
          buyer_address_line1: string | null
          buyer_address_line2: string | null
          buyer_business_name: string | null
          buyer_city: string | null
          buyer_country: string | null
          buyer_email: string | null
          buyer_eu_vat: string | null
          buyer_nip: string | null
          buyer_postal_code: string | null
          created_at: string
          credits_granted: number
          currency: string
          id: string
          needs_manual_review: boolean
          package_size: number
          paid_at: string | null
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          total_amount_cents: number
          unit_price_cents: number
          user_id: string
        }
        Insert: {
          buyer_address_line1?: string | null
          buyer_address_line2?: string | null
          buyer_business_name?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_eu_vat?: string | null
          buyer_nip?: string | null
          buyer_postal_code?: string | null
          created_at?: string
          credits_granted?: number
          currency?: string
          id?: string
          needs_manual_review?: boolean
          package_size: number
          paid_at?: string | null
          status: string
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          total_amount_cents: number
          unit_price_cents: number
          user_id: string
        }
        Update: {
          buyer_address_line1?: string | null
          buyer_address_line2?: string | null
          buyer_business_name?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_eu_vat?: string | null
          buyer_nip?: string | null
          buyer_postal_code?: string | null
          created_at?: string
          credits_granted?: number
          currency?: string
          id?: string
          needs_manual_review?: boolean
          package_size?: number
          paid_at?: string | null
          status?: string
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
          total_amount_cents?: number
          unit_price_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          bilingual: boolean
          created_at: string
          id: string
          invoice_id: string
          language: string
          translated_data: Json
          used_ai: boolean
        }
        Insert: {
          bilingual: boolean
          created_at?: string
          id?: string
          invoice_id: string
          language: string
          translated_data: Json
          used_ai: boolean
        }
        Update: {
          bilingual?: boolean
          created_at?: string
          id?: string
          invoice_id?: string
          language?: string
          translated_data?: Json
          used_ai?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "translations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_credit: {
        Args: { p_invoice: string; p_user: string }
        Returns: undefined
      }
      ensure_free_credit_for_period: {
        Args: { p_user: string }
        Returns: undefined
      }
      grant_paid_credits: {
        Args: { p_amount: number; p_purchase: string; p_user: string }
        Returns: undefined
      }
      increment_demo_pdf: { Args: { p_ip_hash: string }; Returns: number }
      increment_demo_translate: {
        Args: { p_ip_hash: string }
        Returns: {
          global_count: number
          ip_count: number
        }[]
      }
      increment_demo_unlock: { Args: { p_ip_hash: string }; Returns: number }
      refund_paid_credits: {
        Args: { p_amount: number; p_purchase: string; p_user: string }
        Returns: undefined
      }
      refund_translation_credit: {
        Args: { p_invoice: string; p_user: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
