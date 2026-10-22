export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      account_roles: {
        Row: {
          role: string;
          user_id: string;
        };
        Insert: {
          role?: string;
          user_id: string;
        };
        Update: {
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      discord_accounts: {
        Row: {
          discord_id: string;
          linked_at: string;
          user_id: string;
          username: string;
        };
        Insert: {
          discord_id: string;
          linked_at?: string;
          user_id: string;
          username?: string;
        };
        Update: {
          discord_id?: string;
          linked_at?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      order_assignments: {
        Row: {
          accepted_at: string;
          end_reason: string | null;
          ended_at: string | null;
          id: string;
          order_id: string;
          teammate_id: string;
        };
        Insert: {
          accepted_at: string;
          end_reason?: string | null;
          ended_at?: string | null;
          id?: string;
          order_id: string;
          teammate_id: string;
        };
        Update: {
          accepted_at?: string;
          end_reason?: string | null;
          ended_at?: string | null;
          id?: string;
          order_id?: string;
          teammate_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_assignments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_assignments_teammate_id_fkey';
            columns: ['teammate_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          accepted_at: string | null;
          amount_eur_cents: number;
          assigned_teammate_id: string | null;
          booking_fx: number;
          cancel_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          current_assignment_id: string | null;
          customer_country: string;
          customer_id: string;
          customer_image: string;
          customer_name: string;
          game: string;
          gg: boolean;
          id: string;
          ign: string;
          note: string;
          payout_usd_cents: number;
          public_reference: string;
          queued_at: string;
          rank: string;
          region: string;
          rerolls: number;
          service: string;
          status: string;
          title: string;
          unit: string;
          units: number;
          voice: boolean;
        };
        Insert: {
          accepted_at?: string | null;
          amount_eur_cents: number;
          assigned_teammate_id?: string | null;
          booking_fx: number;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_assignment_id?: string | null;
          customer_country?: string;
          customer_id: string;
          customer_image?: string;
          customer_name: string;
          game: string;
          gg?: boolean;
          id?: string;
          ign: string;
          note?: string;
          payout_usd_cents: number;
          public_reference?: string;
          queued_at?: string;
          rank?: string;
          region: string;
          rerolls?: number;
          service: string;
          status?: string;
          title: string;
          unit: string;
          units: number;
          voice?: boolean;
        };
        Update: {
          accepted_at?: string | null;
          amount_eur_cents?: number;
          assigned_teammate_id?: string | null;
          booking_fx?: number;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          current_assignment_id?: string | null;
          customer_country?: string;
          customer_id?: string;
          customer_image?: string;
          customer_name?: string;
          game?: string;
          gg?: boolean;
          id?: string;
          ign?: string;
          note?: string;
          payout_usd_cents?: number;
          public_reference?: string;
          queued_at?: string;
          rank?: string;
          region?: string;
          rerolls?: number;
          service?: string;
          status?: string;
          title?: string;
          unit?: string;
          units?: number;
          voice?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_assigned_teammate_id_fkey';
            columns: ['assigned_teammate_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_current_assignment_fk';
            columns: ['current_assignment_id', 'id', 'assigned_teammate_id'];
            isOneToOne: false;
            referencedRelation: 'order_assignments';
            referencedColumns: ['id', 'order_id', 'teammate_id'];
          },
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          country: string;
          created_at: string;
          id: string;
          image: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          id: string;
          image?: string;
          name?: string;
          updated_at?: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          id?: string;
          image?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      refund_credits: {
        Row: {
          amount_eur_cents: number;
          created_at: string;
          customer_id: string;
          id: string;
          kind: string;
          order_id: string;
        };
        Insert: {
          amount_eur_cents: number;
          created_at?: string;
          customer_id: string;
          id?: string;
          kind: string;
          order_id: string;
        };
        Update: {
          amount_eur_cents?: number;
          created_at?: string;
          customer_id?: string;
          id?: string;
          kind?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'refund_credits_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refund_credits_order_id_customer_id_amount_eur_cents_fkey';
            columns: ['order_id', 'customer_id', 'amount_eur_cents'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id', 'customer_id', 'amount_eur_cents'];
          },
          {
            foreignKeyName: 'refund_credits_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      teammate_order_access: {
        Row: {
          approved_games: string[];
          discord_id: string | null;
          discord_verified_at: string | null;
          gg_access: boolean;
          priority_adjustment: number;
          priority_adjustment_expires_at: string | null;
          priority_base: number;
          suspended: boolean;
          user_id: string;
        };
        Insert: {
          approved_games?: string[];
          discord_id?: string | null;
          discord_verified_at?: string | null;
          gg_access?: boolean;
          priority_adjustment?: number;
          priority_adjustment_expires_at?: string | null;
          priority_base?: number;
          suspended?: boolean;
          user_id: string;
        };
        Update: {
          approved_games?: string[];
          discord_id?: string | null;
          discord_verified_at?: string | null;
          gg_access?: boolean;
          priority_adjustment?: number;
          priority_adjustment_expires_at?: string | null;
          priority_base?: number;
          suspended?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teammate_order_access_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_order: { Args: { p_order_id: string }; Returns: Json };
      cancel_queued_order: { Args: { p_order_id: string }; Returns: Json };
      customer_active_order: { Args: never; Returns: Json };
      customer_order: { Args: { p_order_id: string }; Returns: Json };
      customer_order_history: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      customer_refund_credits: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      customer_checkout_status: {
        Args: { p_intent_id: string };
        Returns: Json;
      };
      order_customer_dto: {
        Args: { p_order: Database['public']['Tables']['orders']['Row'] };
        Returns: Json;
      };
      order_eligible: {
        Args: {
          p_actor: string;
          p_order: Database['public']['Tables']['orders']['Row'];
        };
        Returns: boolean;
      };
      order_error: {
        Args: { p_code: number; p_message: string };
        Returns: Json;
      };
      order_expire_locked: { Args: { p_id: string }; Returns: boolean };
      order_sweep: { Args: { p_limit: number }; Returns: number };
      order_teammate_dto: {
        Args: { p_order: Database['public']['Tables']['orders']['Row'] };
        Returns: Json;
      };
      reroll_order: { Args: { p_order_id: string }; Returns: Json };
      sweep_expired_orders: { Args: { p_limit?: number }; Returns: Json };
      teammate_current_assignment: { Args: never; Returns: Json };
      teammate_order_queue: { Args: never; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
