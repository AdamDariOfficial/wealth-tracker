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
      v2_accounts: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          include_in_net_worth: boolean
          kind: string
          name: string
          opened_at: string | null
          ownership: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id: string
          include_in_net_worth: boolean
          kind: string
          name: string
          opened_at?: string | null
          ownership: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          include_in_net_worth?: boolean
          kind?: string
          name?: string
          opened_at?: string | null
          ownership?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_assets: {
        Row: {
          created_at: string
          fiat_currency: string | null
          id: string
          kind: string
          name: string
          precision: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fiat_currency?: string | null
          id: string
          kind: string
          name: string
          precision: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fiat_currency?: string | null
          id?: string
          kind?: string
          name?: string
          precision?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_assets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_fx_rates: {
        Row: {
          as_of: string
          created_at: string
          id: number
          rate: number
          source: string
          source_currency: string
          target_currency: string
          user_id: string
        }
        Insert: {
          as_of: string
          created_at?: string
          id?: never
          rate: number
          source?: string
          source_currency: string
          target_currency: string
          user_id: string
        }
        Update: {
          as_of?: string
          created_at?: string
          id?: never
          rate?: number
          source?: string
          source_currency?: string
          target_currency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_fx_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_goals: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          name: string
          target_account_id: string | null
          target_amount: number | null
          target_asset_id: string | null
          target_date: string | null
          target_quantity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id: string
          kind: string
          name: string
          target_account_id?: string | null
          target_amount?: number | null
          target_asset_id?: string | null
          target_date?: string | null
          target_quantity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          target_account_id?: string | null
          target_amount?: number | null
          target_asset_id?: string | null
          target_date?: string | null
          target_quantity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_goals_account_fk"
            columns: ["user_id", "target_account_id"]
            isOneToOne: false
            referencedRelation: "v2_accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_goals_asset_fk"
            columns: ["user_id", "target_asset_id"]
            isOneToOne: false
            referencedRelation: "v2_assets"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_import_batch_transactions: {
        Row: {
          batch_id: string
          ordinal: number
          transaction_id: string
          user_id: string
        }
        Insert: {
          batch_id: string
          ordinal: number
          transaction_id: string
          user_id: string
        }
        Update: {
          batch_id?: string
          ordinal?: number
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_import_batch_transactions_batch_fk"
            columns: ["user_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "v2_import_batches"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_import_batch_transactions_transaction_fk"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "v2_transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      v2_import_batches: {
        Row: {
          created_at: string
          id: string
          label: string | null
          rolled_back_at: string | null
          source_text: string
          transaction_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          label?: string | null
          rolled_back_at?: string | null
          source_text: string
          transaction_count: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          rolled_back_at?: string | null
          source_text?: string
          transaction_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_import_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_price_quotes: {
        Row: {
          amount: number
          as_of: string
          asset_id: string
          created_at: string
          currency: string
          id: number
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          as_of: string
          asset_id: string
          created_at?: string
          currency: string
          id?: never
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          as_of?: string
          asset_id?: string
          created_at?: string
          currency?: string
          id?: never
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_price_quotes_asset_fk"
            columns: ["user_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "v2_assets"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_price_quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_profiles: {
        Row: {
          base_currency: string | null
          created_at: string
          display_name: string | null
          locale: string | null
          onboarded: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string | null
          onboarded?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string | null
          onboarded?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_trading_settings: {
        Row: {
          default_risk_pct: number
          max_daily_loss_pct: number
          primary_asset: string | null
          reserve: number
          updated_at: string
          user_id: string
          weekly_loss_limit_pct: number
        }
        Insert: {
          default_risk_pct?: number
          max_daily_loss_pct?: number
          primary_asset?: string | null
          reserve?: number
          updated_at?: string
          user_id: string
          weekly_loss_limit_pct?: number
        }
        Update: {
          default_risk_pct?: number
          max_daily_loss_pct?: number
          primary_asset?: string | null
          reserve?: number
          updated_at?: string
          user_id?: string
          weekly_loss_limit_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_trading_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_transaction_legs: {
        Row: {
          account_id: string
          asset_id: string
          created_at: string
          id: string
          memo: string | null
          quantity: number
          transaction_id: string
          user_id: string
        }
        Insert: {
          account_id: string
          asset_id: string
          created_at?: string
          id: string
          memo?: string | null
          quantity: number
          transaction_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          asset_id?: string
          created_at?: string
          id?: string
          memo?: string | null
          quantity?: number
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_transaction_legs_account_fk"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "v2_accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_transaction_legs_asset_fk"
            columns: ["user_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "v2_assets"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_transaction_legs_transaction_fk"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "v2_transactions"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_transaction_legs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_transactions: {
        Row: {
          created_at: string
          description: string
          id: string
          occurred_at: string
          purpose: string
          recorded_at: string
          related_transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id: string
          occurred_at: string
          purpose?: string
          recorded_at: string
          related_transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          occurred_at?: string
          purpose?: string
          recorded_at?: string
          related_transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_transactions_related_fk"
            columns: ["user_id", "related_transaction_id"]
            isOneToOne: false
            referencedRelation: "v2_transactions"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "v2_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      v2_weekly_reviews: {
        Row: {
          avg_rr: number
          consistency_score: number
          created_at: string
          discipline_score: number
          finalized_at: string | null
          id: string
          is_draft: boolean
          lessons: string | null
          max_drawdown_pct: number
          notes: string | null
          psychology_score: number
          reported_pnl: number
          trade_count: number
          updated_at: string
          user_id: string
          week_start: string
          win_rate: number
        }
        Insert: {
          avg_rr?: number
          consistency_score?: number
          created_at?: string
          discipline_score?: number
          finalized_at?: string | null
          id: string
          is_draft?: boolean
          lessons?: string | null
          max_drawdown_pct?: number
          notes?: string | null
          psychology_score?: number
          reported_pnl?: number
          trade_count?: number
          updated_at?: string
          user_id: string
          week_start: string
          win_rate?: number
        }
        Update: {
          avg_rr?: number
          consistency_score?: number
          created_at?: string
          discipline_score?: number
          finalized_at?: string | null
          id?: string
          is_draft?: boolean
          lessons?: string | null
          max_drawdown_pct?: number
          notes?: string | null
          psychology_score?: number
          reported_pnl?: number
          trade_count?: number
          updated_at?: string
          user_id?: string
          week_start?: string
          win_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_weekly_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v2_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      v2_append_fx_rate: { Args: { p_rate: Json }; Returns: undefined }
      v2_append_price_quote: { Args: { p_quote: Json }; Returns: undefined }
      v2_archive_goal: { Args: { p_goal_id: string }; Returns: undefined }
      v2_complete_onboarding: { Args: { p_profile: Json }; Returns: Json }
      v2_delete_weekly_review: {
        Args: { p_review_id: string }
        Returns: undefined
      }
      v2_export_backup: { Args: never; Returns: Json }
      v2_finalize_weekly_review: {
        Args: { p_review_id: string }
        Returns: undefined
      }
      v2_get_advanced_state: { Args: never; Returns: Json }
      v2_get_financial_state: { Args: never; Returns: Json }
      v2_import_batch: { Args: { p_batch: Json }; Returns: undefined }
      v2_post_transaction: { Args: { p_transaction: Json }; Returns: string }
      v2_put_account: { Args: { p_account: Json }; Returns: undefined }
      v2_put_asset: { Args: { p_asset: Json }; Returns: undefined }
      v2_put_goal: { Args: { p_goal: Json }; Returns: undefined }
      v2_put_trading_settings: {
        Args: { p_settings: Json }
        Returns: undefined
      }
      v2_put_weekly_review: { Args: { p_review: Json }; Returns: undefined }
      v2_reset_workspace: {
        Args: { p_confirmation: string }
        Returns: undefined
      }
      v2_restore_backup: { Args: { p_backup: Json }; Returns: undefined }
      v2_rollback_import_batch: {
        Args: { p_batch_id: string }
        Returns: undefined
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
