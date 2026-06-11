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
      accounts: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          currency: string
          current_balance: number
          description: string | null
          icon: string | null
          id: string
          include_in_net_worth: boolean
          name: string
          provider: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          description?: string | null
          icon?: string | null
          id?: string
          include_in_net_worth?: boolean
          name: string
          provider?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          description?: string | null
          icon?: string | null
          id?: string
          include_in_net_worth?: boolean
          name?: string
          provider?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      assets: {
        Row: {
          archived_at: string | null
          asset_class: Database["public"]["Enums"]["asset_class"]
          color: string | null
          created_at: string
          current_price: number
          custom_asset: boolean
          icon: string | null
          id: string
          name: string
          symbol: string
          tracking_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          color?: string | null
          created_at?: string
          current_price?: number
          custom_asset?: boolean
          icon?: string | null
          id?: string
          name: string
          symbol: string
          tracking_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          asset_class?: Database["public"]["Enums"]["asset_class"]
          color?: string | null
          created_at?: string
          current_price?: number
          custom_asset?: boolean
          icon?: string | null
          id?: string
          name?: string
          symbol?: string
          tracking_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          account_id: string | null
          after_balance: number | null
          before_balance: number | null
          created_at: string
          delta: number | null
          diff: Json | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          message: string | null
          metadata: Json
          source: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          after_balance?: number | null
          before_balance?: number | null
          created_at?: string
          delta?: number | null
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          source?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          after_balance?: number | null
          before_balance?: number | null
          created_at?: string
          delta?: number | null
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          source?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cash_reserves: {
        Row: {
          balance: number
          created_at: string
          id: string
          label: string
          purpose: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          label: string
          purpose?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          label?: string
          purpose?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crypto_holdings: {
        Row: {
          avg_cost: number
          created_at: string
          current_price: number
          id: string
          name: string | null
          quantity: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          created_at?: string
          current_price?: number
          id?: string
          name?: string | null
          quantity?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          created_at?: string
          current_price?: number
          id?: string
          name?: string | null
          quantity?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dca_plans: {
        Row: {
          active: boolean
          amount_fiat: number
          asset_id: string
          created_at: string
          destination_account_id: string
          frequency: string
          id: string
          next_run_at: string
          source_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount_fiat?: number
          asset_id: string
          created_at?: string
          destination_account_id: string
          frequency?: string
          id?: string
          next_run_at?: string
          source_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount_fiat?: number
          asset_id?: string
          created_at?: string
          destination_account_id?: string
          frequency?: string
          id?: string
          next_run_at?: string
          source_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      etfs: {
        Row: {
          avg_cost: number
          created_at: string
          current_price: number
          id: string
          monthly_contribution: number
          name: string
          quantity: number
          ticker: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          created_at?: string
          current_price?: number
          id?: string
          monthly_contribution?: number
          name: string
          quantity?: number
          ticker?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          created_at?: string
          current_price?: number
          id?: string
          monthly_contribution?: number
          name?: string
          quantity?: number
          ticker?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          as_of: string
          as_of_date: string | null
          base: string
          created_at: string
          id: string
          quote: string
          rate: number
          source: string
        }
        Insert: {
          as_of?: string
          as_of_date?: string | null
          base: string
          created_at?: string
          id?: string
          quote: string
          rate: number
          source?: string
        }
        Update: {
          as_of?: string
          as_of_date?: string | null
          base?: string
          created_at?: string
          id?: string
          quote?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          current_amount: number
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          target_account_id: string | null
          target_amount: number
          target_asset_id: string | null
          target_date: string | null
          target_quantity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          current_amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name: string
          target_account_id?: string | null
          target_amount?: number
          target_asset_id?: string | null
          target_date?: string | null
          target_quantity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          current_amount?: number
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name?: string
          target_account_id?: string | null
          target_amount?: number
          target_asset_id?: string | null
          target_date?: string | null
          target_quantity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_aliases: {
        Row: {
          alias: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          error_count: number
          errors: Json
          id: string
          imported_count: number
          label: string | null
          rolled_back_at: string | null
          source_text: string
          summary: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          errors?: Json
          id?: string
          imported_count?: number
          label?: string | null
          rolled_back_at?: string | null
          source_text: string
          summary?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          error_count?: number
          errors?: Json
          id?: string
          imported_count?: number
          label?: string | null
          rolled_back_at?: string | null
          source_text?: string
          summary?: Json
          user_id?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          asset_class: string
          avg_cost: number
          created_at: string
          current_price: number
          id: string
          name: string
          notes: string | null
          quantity: number
          ticker: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_class?: string
          avg_cost?: number
          created_at?: string
          current_price?: number
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          ticker?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_class?: string
          avg_cost?: number
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          ticker?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_data: {
        Row: {
          financial: Json
          investment: Json
          trading: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          financial?: Json
          investment?: Json
          trading?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          financial?: Json
          investment?: Json
          trading?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_snapshots: {
        Row: {
          cash_value: number
          crypto_value: number
          id: string
          investments_value: number
          net_worth: number
          snapshot_date: string
          trading_value: number
          user_id: string
        }
        Insert: {
          cash_value?: number
          crypto_value?: number
          id?: string
          investments_value?: number
          net_worth?: number
          snapshot_date?: string
          trading_value?: number
          user_id: string
        }
        Update: {
          cash_value?: number
          crypto_value?: number
          id?: string
          investments_value?: number
          net_worth?: number
          snapshot_date?: string
          trading_value?: number
          user_id?: string
        }
        Relationships: []
      }
      portfolio_snapshots_v2: {
        Row: {
          breakdown: Json
          granularity: string
          id: string
          invested_value: number
          liquid_value: number
          net_worth: number
          realized_pnl: number
          taken_at: string
          unrealized_pnl: number
          user_id: string
        }
        Insert: {
          breakdown?: Json
          granularity?: string
          id?: string
          invested_value?: number
          liquid_value?: number
          net_worth?: number
          realized_pnl?: number
          taken_at?: string
          unrealized_pnl?: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          granularity?: string
          id?: string
          invested_value?: number
          liquid_value?: number
          net_worth?: number
          realized_pnl?: number
          taken_at?: string
          unrealized_pnl?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          display_name: string | null
          id: string
          locale: string
          notifications: Json
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          locale?: string
          notifications?: Json
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          locale?: string
          notifications?: Json
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset: string
          created_at: string
          direction: string
          entry: number | null
          id: string
          notes: string | null
          pnl: number
          rating: number
          rr: number | null
          session: string | null
          setup: string | null
          stop_loss: number | null
          take_profit: number | null
          trade_date: string
          user_id: string
        }
        Insert: {
          asset: string
          created_at?: string
          direction?: string
          entry?: number | null
          id?: string
          notes?: string | null
          pnl?: number
          rating?: number
          rr?: number | null
          session?: string | null
          setup?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_date?: string
          user_id: string
        }
        Update: {
          asset?: string
          created_at?: string
          direction?: string
          entry?: number | null
          id?: string
          notes?: string | null
          pnl?: number
          rating?: number
          rr?: number | null
          session?: string | null
          setup?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_date?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_account: {
        Row: {
          balance: number
          default_risk_pct: number
          max_daily_loss_pct: number
          primary_asset: string | null
          reserve: number
          updated_at: string
          user_id: string
          weekly_loss_limit_pct: number
        }
        Insert: {
          balance?: number
          default_risk_pct?: number
          max_daily_loss_pct?: number
          primary_asset?: string | null
          reserve?: number
          updated_at?: string
          user_id: string
          weekly_loss_limit_pct?: number
        }
        Update: {
          balance?: number
          default_risk_pct?: number
          max_daily_loss_pct?: number
          primary_asset?: string | null
          reserve?: number
          updated_at?: string
          user_id?: string
          weekly_loss_limit_pct?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          asset_currency: string | null
          asset_id: string | null
          asset_price: number | null
          base_currency: string | null
          base_value: number | null
          created_at: string
          destination_account_id: string | null
          exchange_rate: number | null
          execution_timestamp: string
          fee_amount: number
          fee_asset_id: string | null
          fee_base_value: number | null
          fiat_value: number
          id: string
          note: string | null
          quantity: number
          source_account_id: string | null
          tags: string[]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          transfer_group_id: string | null
          updated_at: string
          user_id: string
          voided_at: string | null
          voided_reason: string | null
        }
        Insert: {
          asset_currency?: string | null
          asset_id?: string | null
          asset_price?: number | null
          base_currency?: string | null
          base_value?: number | null
          created_at?: string
          destination_account_id?: string | null
          exchange_rate?: number | null
          execution_timestamp?: string
          fee_amount?: number
          fee_asset_id?: string | null
          fee_base_value?: number | null
          fiat_value?: number
          id?: string
          note?: string | null
          quantity?: number
          source_account_id?: string | null
          tags?: string[]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          transfer_group_id?: string | null
          updated_at?: string
          user_id: string
          voided_at?: string | null
          voided_reason?: string | null
        }
        Update: {
          asset_currency?: string | null
          asset_id?: string | null
          asset_price?: number | null
          base_currency?: string | null
          base_value?: number | null
          created_at?: string
          destination_account_id?: string | null
          exchange_rate?: number | null
          execution_timestamp?: string
          fee_amount?: number
          fee_asset_id?: string | null
          fee_base_value?: number | null
          fiat_value?: number
          id?: string
          note?: string | null
          quantity?: number
          source_account_id?: string | null
          tags?: string[]
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          transfer_group_id?: string | null
          updated_at?: string
          user_id?: string
          voided_at?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_fee_asset_id_fkey"
            columns: ["fee_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          avg_rr: number
          broker_account_id: string | null
          consistency_score: number
          created_at: string
          discipline_score: number
          finalized_at: string | null
          id: string
          is_draft: boolean
          lessons: string | null
          max_drawdown: number
          notes: string | null
          num_trades: number
          pnl: number
          posted_transaction_id: string | null
          psychology_score: number
          screenshots: string[]
          updated_at: string
          user_id: string
          week_start: string
          winrate: number
        }
        Insert: {
          avg_rr?: number
          broker_account_id?: string | null
          consistency_score?: number
          created_at?: string
          discipline_score?: number
          finalized_at?: string | null
          id?: string
          is_draft?: boolean
          lessons?: string | null
          max_drawdown?: number
          notes?: string | null
          num_trades?: number
          pnl?: number
          posted_transaction_id?: string | null
          psychology_score?: number
          screenshots?: string[]
          updated_at?: string
          user_id: string
          week_start: string
          winrate?: number
        }
        Update: {
          avg_rr?: number
          broker_account_id?: string | null
          consistency_score?: number
          created_at?: string
          discipline_score?: number
          finalized_at?: string | null
          id?: string
          is_draft?: boolean
          lessons?: string | null
          max_drawdown?: number
          notes?: string | null
          num_trades?: number
          pnl?: number
          posted_transaction_id?: string | null
          psychology_score?: number
          screenshots?: string[]
          updated_at?: string
          user_id?: string
          week_start?: string
          winrate?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recompute_account_balance: {
        Args: { _account_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "bank"
        | "exchange"
        | "broker"
        | "crypto_wallet"
        | "cold_wallet"
        | "cash"
        | "savings"
        | "investment"
        | "external"
      asset_class:
        | "fiat"
        | "crypto"
        | "etf"
        | "stock"
        | "commodity"
        | "forex"
        | "cash"
        | "stablecoin"
        | "custom"
      goal_kind:
        | "net_worth"
        | "liquid"
        | "account_balance"
        | "asset_quantity"
        | "asset_value"
        | "custom"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "transfer"
        | "buy"
        | "sell"
        | "convert"
        | "fee"
        | "dividend"
        | "interest"
        | "staking_reward"
        | "profit_realization"
        | "manual_adjustment"
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
      account_type: [
        "bank",
        "exchange",
        "broker",
        "crypto_wallet",
        "cold_wallet",
        "cash",
        "savings",
        "investment",
        "external",
      ],
      asset_class: [
        "fiat",
        "crypto",
        "etf",
        "stock",
        "commodity",
        "forex",
        "cash",
        "stablecoin",
        "custom",
      ],
      goal_kind: [
        "net_worth",
        "liquid",
        "account_balance",
        "asset_quantity",
        "asset_value",
        "custom",
      ],
      transaction_type: [
        "deposit",
        "withdrawal",
        "transfer",
        "buy",
        "sell",
        "convert",
        "fee",
        "dividend",
        "interest",
        "staking_reward",
        "profit_realization",
        "manual_adjustment",
      ],
    },
  },
} as const
