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
          owner: boolean;
          role: string;
          role_set_at: string | null;
          role_set_by: string | null;
          user_id: string;
        };
        Insert: {
          owner?: boolean;
          role?: string;
          role_set_at?: string | null;
          role_set_by?: string | null;
          user_id: string;
        };
        Update: {
          owner?: boolean;
          role?: string;
          role_set_at?: string | null;
          role_set_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string;
          at: string;
          detail: string;
          id: number;
          target: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name: string;
          at?: string;
          detail?: string;
          id?: never;
          target?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string;
          at?: string;
          detail?: string;
          id?: never;
          target?: string;
        };
        Relationships: [];
      };
      checkout_intents: {
        Row: {
          amount_eur_cents: number;
          booking_fx: number;
          created_at: string;
          creator_id: string | null;
          customer_id: string;
          first_order_discount_cents: number;
          expires_at: string;
          game: string;
          gg: boolean;
          id: string;
          ign: string;
          note: string;
          order_id: string | null;
          payout_usd_cents: number;
          rank: string;
          ref_code: string | null;
          region: string;
          service: string;
          status: string;
          stripe_client_secret: string | null;
          stripe_payment_intent_id: string | null;
          stripe_session_id: string | null;
          title: string;
          unit: string;
          units: number;
          updated_at: string;
          voice: boolean;
          wallet_eur_cents: number;
        };
        Insert: {
          amount_eur_cents: number;
          booking_fx: number;
          created_at?: string;
          creator_id?: string | null;
          customer_id: string;
          first_order_discount_cents?: number;
          expires_at: string;
          game: string;
          gg?: boolean;
          id?: string;
          ign: string;
          note?: string;
          order_id?: string | null;
          payout_usd_cents: number;
          rank?: string;
          ref_code?: string | null;
          region: string;
          service: string;
          status?: string;
          stripe_client_secret?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
          title: string;
          unit: string;
          units: number;
          updated_at?: string;
          voice?: boolean;
          wallet_eur_cents?: number;
        };
        Update: {
          amount_eur_cents?: number;
          booking_fx?: number;
          created_at?: string;
          creator_id?: string | null;
          customer_id?: string;
          first_order_discount_cents?: number;
          expires_at?: string;
          game?: string;
          gg?: boolean;
          id?: string;
          ign?: string;
          note?: string;
          order_id?: string | null;
          payout_usd_cents?: number;
          rank?: string;
          ref_code?: string | null;
          region?: string;
          service?: string;
          status?: string;
          stripe_client_secret?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string | null;
          title?: string;
          unit?: string;
          units?: number;
          updated_at?: string;
          voice?: boolean;
          wallet_eur_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'checkout_intents_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkout_intents_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'checkout_intents_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      creators: {
        Row: {
          active: boolean;
          channel: string;
          code: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          channel?: string;
          code: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          channel?: string;
          code?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_blocks: {
        Row: {
          blocked_at: string;
          blocked_by: string | null;
          reason: string;
          user_id: string;
        };
        Insert: {
          blocked_at?: string;
          blocked_by?: string | null;
          reason: string;
          user_id: string;
        };
        Update: {
          blocked_at?: string;
          blocked_by?: string | null;
          reason?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_blocks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_referrals: {
        Row: {
          attributed_at: string;
          code: string;
          creator_id: string;
          customer_id: string;
          first_order_id: string;
        };
        Insert: {
          attributed_at?: string;
          code: string;
          creator_id: string;
          customer_id: string;
          first_order_id: string;
        };
        Update: {
          attributed_at?: string;
          code?: string;
          creator_id?: string;
          customer_id?: string;
          first_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_referrals_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_referrals_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_referrals_first_order_id_fkey';
            columns: ['first_order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'discord_accounts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
      order_chat_attempts: {
        Row: {
          actor_id: string;
          assignment_id: string;
          body_digest: string;
          created_at: string;
          request_id: string;
          result: Json;
        };
        Insert: {
          actor_id: string;
          assignment_id: string;
          body_digest: string;
          created_at?: string;
          request_id: string;
          result: Json;
        };
        Update: {
          actor_id?: string;
          assignment_id?: string;
          body_digest?: string;
          created_at?: string;
          request_id?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'order_chat_attempts_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'order_chat_rate_accounts';
            referencedColumns: ['actor_id'];
          },
          {
            foreignKeyName: 'order_chat_attempts_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'order_chat_rooms';
            referencedColumns: ['assignment_id'];
          },
        ];
      };
      order_chat_flags: {
        Row: {
          actor_id: string;
          assignment_id: string;
          body: string;
          created_at: string;
          id: string;
          order_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rule: string;
          sender_name: string;
          status: string;
        };
        Insert: {
          actor_id: string;
          assignment_id: string;
          body: string;
          created_at?: string;
          id?: string;
          order_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rule: string;
          sender_name: string;
          status?: string;
        };
        Update: {
          actor_id?: string;
          assignment_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          order_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          rule?: string;
          sender_name?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_chat_flags_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_chat_flags_assignment_id_order_id_fkey';
            columns: ['assignment_id', 'order_id'];
            isOneToOne: false;
            referencedRelation: 'order_chat_rooms';
            referencedColumns: ['assignment_id', 'order_id'];
          },
          {
            foreignKeyName: 'order_chat_flags_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_chat_messages: {
        Row: {
          assignment_id: string;
          body: string;
          created_at: string;
          id: string;
          image: string;
          kind: string;
          name: string;
          request_id: string | null;
          sender: string;
          sequence: number;
          system_event: string | null;
        };
        Insert: {
          assignment_id: string;
          body: string;
          created_at?: string;
          id?: string;
          image?: string;
          kind: string;
          name: string;
          request_id?: string | null;
          sender: string;
          sequence: number;
          system_event?: string | null;
        };
        Update: {
          assignment_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          image?: string;
          kind?: string;
          name?: string;
          request_id?: string | null;
          sender?: string;
          sequence?: number;
          system_event?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_chat_messages_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'order_chat_rooms';
            referencedColumns: ['assignment_id'];
          },
        ];
      };
      order_chat_rate_accounts: {
        Row: {
          actor_id: string;
        };
        Insert: {
          actor_id: string;
        };
        Update: {
          actor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_chat_rate_accounts_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_chat_rooms: {
        Row: {
          accepted_emitted: boolean;
          assignment_id: string;
          completed_emitted: boolean;
          next_sequence: number;
          order_id: string;
        };
        Insert: {
          accepted_emitted?: boolean;
          assignment_id: string;
          completed_emitted?: boolean;
          next_sequence?: number;
          order_id: string;
        };
        Update: {
          accepted_emitted?: boolean;
          assignment_id?: string;
          completed_emitted?: boolean;
          next_sequence?: number;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_chat_rooms_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: true;
            referencedRelation: 'order_assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_chat_rooms_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_chat_typing: {
        Row: {
          actor_id: string;
          assignment_id: string;
          emitted_at: string;
          expires_at: string;
          role: string;
        };
        Insert: {
          actor_id: string;
          assignment_id: string;
          emitted_at: string;
          expires_at: string;
          role: string;
        };
        Update: {
          actor_id?: string;
          assignment_id?: string;
          emitted_at?: string;
          expires_at?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_chat_typing_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_chat_typing_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'order_chat_rooms';
            referencedColumns: ['assignment_id'];
          },
        ];
      };
      order_completion_proofs: {
        Row: {
          order_id: string;
          proof_id: string;
        };
        Insert: {
          order_id: string;
          proof_id: string;
        };
        Update: {
          order_id?: string;
          proof_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_completion_proofs_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'teammate_earning_entries';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_completion_proofs_proof_id_fkey';
            columns: ['proof_id'];
            isOneToOne: true;
            referencedRelation: 'order_proof_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      order_handovers: {
        Row: {
          created_at: string;
          created_by: string;
          created_by_name: string;
          expires_at: string;
          id: string;
          order_id: string;
          revoke_reason: string | null;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          created_by_name: string;
          expires_at: string;
          id?: string;
          order_id: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          created_by_name?: string;
          expires_at?: string;
          id?: string;
          order_id?: string;
          revoke_reason?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_handovers_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_misses: {
        Row: {
          missed_at: string;
          order_id: string;
          seen_sec: number;
          teammate_id: string;
        };
        Insert: {
          missed_at?: string;
          order_id: string;
          seen_sec: number;
          teammate_id: string;
        };
        Update: {
          missed_at?: string;
          order_id?: string;
          seen_sec?: number;
          teammate_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_misses_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_payments: {
        Row: {
          amount_eur_cents: number;
          amount_minor: number;
          attempts: number;
          created_at: string;
          currency: string;
          intent_id: string;
          last_error: string | null;
          order_id: string;
          payment_method_type: string;
          refund_reason: string | null;
          refunded_at: string | null;
          settle: string;
          state: string;
          stripe_payment_intent_id: string;
          updated_at: string;
        };
        Insert: {
          amount_eur_cents: number;
          amount_minor: number;
          attempts?: number;
          created_at?: string;
          currency: string;
          intent_id: string;
          last_error?: string | null;
          order_id: string;
          payment_method_type?: string;
          refund_reason?: string | null;
          refunded_at?: string | null;
          settle?: string;
          state: string;
          stripe_payment_intent_id: string;
          updated_at?: string;
        };
        Update: {
          amount_eur_cents?: number;
          amount_minor?: number;
          attempts?: number;
          created_at?: string;
          currency?: string;
          intent_id?: string;
          last_error?: string | null;
          order_id?: string;
          payment_method_type?: string;
          refund_reason?: string | null;
          refunded_at?: string | null;
          settle?: string;
          state?: string;
          stripe_payment_intent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_payments_intent_id_fkey';
            columns: ['intent_id'];
            isOneToOne: true;
            referencedRelation: 'checkout_intents';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_referrals: {
        Row: {
          amount_eur_cents: number;
          attributed_at: string;
          creator_id: string;
          customer_id: string;
          order_id: string;
        };
        Insert: {
          amount_eur_cents: number;
          attributed_at?: string;
          creator_id: string;
          customer_id: string;
          order_id: string;
        };
        Update: {
          amount_eur_cents?: number;
          attributed_at?: string;
          creator_id?: string;
          customer_id?: string;
          order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_referrals_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'creators';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_referrals_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_referrals';
            referencedColumns: ['customer_id'];
          },
          {
            foreignKeyName: 'order_referrals_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_proof_cleanup_cursor: {
        Row: {
          cycle_cutoff: string;
          last_created_at: string | null;
          last_id: string | null;
          singleton: boolean;
        };
        Insert: {
          cycle_cutoff?: string;
          last_created_at?: string | null;
          last_id?: string | null;
          singleton?: boolean;
        };
        Update: {
          cycle_cutoff?: string;
          last_created_at?: string | null;
          last_id?: string | null;
          singleton?: boolean;
        };
        Relationships: [];
      };
      order_proof_cleanup_runs: {
        Row: {
          called_at: string;
          claimed: number | null;
          deleted: number | null;
          failed: number | null;
          http_status: number | null;
          id: number;
          outcome: string;
        };
        Insert: {
          called_at?: string;
          claimed?: number | null;
          deleted?: number | null;
          failed?: number | null;
          http_status?: number | null;
          id?: never;
          outcome: string;
        };
        Update: {
          called_at?: string;
          claimed?: number | null;
          deleted?: number | null;
          failed?: number | null;
          http_status?: number | null;
          id?: never;
          outcome?: string;
        };
        Relationships: [];
      };
      order_proof_uploads: {
        Row: {
          abandoned_at: string | null;
          assignment_id: string;
          byte_size: number | null;
          cleanup_claimed_at: string | null;
          created_at: string;
          id: string;
          mime: string | null;
          order_id: string;
          ready_at: string | null;
          request_id: string;
          sha256: string | null;
          state: string;
          storage_key: string | null;
          uploader_id: string;
        };
        Insert: {
          abandoned_at?: string | null;
          assignment_id: string;
          byte_size?: number | null;
          cleanup_claimed_at?: string | null;
          created_at?: string;
          id?: string;
          mime?: string | null;
          order_id: string;
          ready_at?: string | null;
          request_id: string;
          sha256?: string | null;
          state?: string;
          storage_key?: string | null;
          uploader_id: string;
        };
        Update: {
          abandoned_at?: string | null;
          assignment_id?: string;
          byte_size?: number | null;
          cleanup_claimed_at?: string | null;
          created_at?: string;
          id?: string;
          mime?: string | null;
          order_id?: string;
          ready_at?: string | null;
          request_id?: string;
          sha256?: string | null;
          state?: string;
          storage_key?: string | null;
          uploader_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_proof_uploads_assignment_id_order_id_uploader_id_fkey';
            columns: ['assignment_id', 'order_id', 'uploader_id'];
            isOneToOne: false;
            referencedRelation: 'order_assignments';
            referencedColumns: ['id', 'order_id', 'teammate_id'];
          },
        ];
      };
      order_report_bounties: {
        Row: {
          amount_eur_cents: number;
          customer_id: string;
          paid_at: string | null;
          paid_by: string | null;
          payment_note: string | null;
          recorded_at: string;
          report_id: string;
          status: string;
        };
        Insert: {
          amount_eur_cents: number;
          customer_id: string;
          paid_at?: string | null;
          paid_by?: string | null;
          payment_note?: string | null;
          recorded_at?: string;
          report_id: string;
          status?: string;
        };
        Update: {
          amount_eur_cents?: number;
          customer_id?: string;
          paid_at?: string | null;
          paid_by?: string | null;
          payment_note?: string | null;
          recorded_at?: string;
          report_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_report_bounties_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_report_bounties_paid_by_fkey';
            columns: ['paid_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_report_bounties_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: true;
            referencedRelation: 'order_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      order_report_evidence: {
        Row: {
          byte_size: number;
          created_at: string;
          id: string;
          mime: string;
          report_id: string;
          sha256: string;
          storage_key: string;
        };
        Insert: {
          byte_size: number;
          created_at?: string;
          id: string;
          mime: string;
          report_id: string;
          sha256: string;
          storage_key: string;
        };
        Update: {
          byte_size?: number;
          created_at?: string;
          id?: string;
          mime?: string;
          report_id?: string;
          sha256?: string;
          storage_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_report_evidence_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'order_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      order_reports: {
        Row: {
          assignment_id: string;
          bounty_eur_cents: number;
          created_at: string;
          customer_id: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          description: string;
          id: string;
          order_id: string;
          status: string;
          teammate_id: string;
          type: string;
        };
        Insert: {
          assignment_id: string;
          bounty_eur_cents?: number;
          created_at?: string;
          customer_id: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          description: string;
          id: string;
          order_id: string;
          status?: string;
          teammate_id: string;
          type: string;
        };
        Update: {
          assignment_id?: string;
          bounty_eur_cents?: number;
          created_at?: string;
          customer_id?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          description?: string;
          id?: string;
          order_id?: string;
          status?: string;
          teammate_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_reports_assignment_id_order_id_teammate_id_fkey';
            columns: ['assignment_id', 'order_id', 'teammate_id'];
            isOneToOne: false;
            referencedRelation: 'order_assignments';
            referencedColumns: ['id', 'order_id', 'teammate_id'];
          },
          {
            foreignKeyName: 'order_reports_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_reports_decided_by_fkey';
            columns: ['decided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_reports_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_reports_teammate_id_fkey';
            columns: ['teammate_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_reviews: {
        Row: {
          assignment_id: string;
          created_at: string;
          customer_id: string;
          order_id: string;
          rating: number;
          tags: string[];
          teammate_id: string;
          text: string;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          customer_id: string;
          order_id: string;
          rating: number;
          tags?: string[];
          teammate_id: string;
          text?: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          customer_id?: string;
          order_id?: string;
          rating?: number;
          tags?: string[];
          teammate_id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_reviews_assignment_id_order_id_teammate_id_fkey';
            columns: ['assignment_id', 'order_id', 'teammate_id'];
            isOneToOne: false;
            referencedRelation: 'order_assignments';
            referencedColumns: ['id', 'order_id', 'teammate_id'];
          },
          {
            foreignKeyName: 'order_reviews_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_reviews_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'teammate_earning_entries';
            referencedColumns: ['order_id'];
          },
          {
            foreignKeyName: 'order_reviews_teammate_id_fkey';
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
          admin_cancel_note: string | null;
          admin_refund_reason: string | null;
          admin_refunded_at: string | null;
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
          wallet_eur_cents: number;
        };
        Insert: {
          accepted_at?: string | null;
          admin_cancel_note?: string | null;
          admin_refund_reason?: string | null;
          admin_refunded_at?: string | null;
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
          wallet_eur_cents?: number;
        };
        Update: {
          accepted_at?: string | null;
          admin_cancel_note?: string | null;
          admin_refund_reason?: string | null;
          admin_refunded_at?: string | null;
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
          wallet_eur_cents?: number;
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
          bio: string;
          country: string;
          created_at: string;
          currency: string | null;
          id: string;
          image: string;
          languages: string[];
          name: string;
          updated_at: string;
        };
        Insert: {
          bio?: string;
          country?: string;
          created_at?: string;
          currency?: string | null;
          id: string;
          image?: string;
          languages?: string[];
          name?: string;
          updated_at?: string;
        };
        Update: {
          bio?: string;
          country?: string;
          created_at?: string;
          currency?: string | null;
          id?: string;
          image?: string;
          languages?: string[];
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
      stripe_events: {
        Row: {
          id: string;
          received_at: string;
          type: string;
        };
        Insert: {
          id: string;
          received_at?: string;
          type: string;
        };
        Update: {
          id?: string;
          received_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      support_ai_daily_usage: {
        Row: {
          calls: number;
          day: string;
        };
        Insert: {
          calls?: number;
          day: string;
        };
        Update: {
          calls?: number;
          day?: string;
        };
        Relationships: [];
      };
      support_ai_identity_usage: {
        Row: {
          calls: number;
          day: string;
          identity_key: string;
        };
        Insert: {
          calls?: number;
          day: string;
          identity_key: string;
        };
        Update: {
          calls?: number;
          day?: string;
          identity_key?: string;
        };
        Relationships: [];
      };
      support_conversations: {
        Row: {
          admin_seen_at: string | null;
          claimed_by: string | null;
          created_at: string;
          email: string;
          guest_token_hash: string | null;
          id: string;
          image: string;
          name: string;
          reference: string;
          role: string;
          status: string;
          updated_at: string;
          user_id: string | null;
          user_seen_at: string;
          waiting_since: string | null;
        };
        Insert: {
          admin_seen_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          email?: string;
          guest_token_hash?: string | null;
          id?: string;
          image?: string;
          name?: string;
          reference?: string;
          role: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          user_seen_at?: string;
          waiting_since?: string | null;
        };
        Update: {
          admin_seen_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          email?: string;
          guest_token_hash?: string | null;
          id?: string;
          image?: string;
          name?: string;
          reference?: string;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          user_seen_at?: string;
          waiting_since?: string | null;
        };
        Relationships: [];
      };
      support_messages: {
        Row: {
          admin_id: string | null;
          admin_image: string;
          admin_name: string;
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          sender: string;
        };
        Insert: {
          admin_id?: string | null;
          admin_image?: string;
          admin_name?: string;
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          sender: string;
        };
        Update: {
          admin_id?: string | null;
          admin_image?: string;
          admin_name?: string;
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          sender?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'support_conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      teammate_applications: {
        Row: {
          account_id: string | null;
          country: string;
          decided_at: string | null;
          decided_by: string | null;
          decided_by_name: string;
          discord: string;
          email: string;
          game: string;
          hours: string;
          id: string;
          link: string;
          name: string;
          rank: string;
          reason: string;
          reference: string;
          region: string;
          role: string;
          services: string[];
          status: string;
          submitted_at: string;
          why: string;
        };
        Insert: {
          account_id?: string | null;
          country?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decided_by_name?: string;
          discord: string;
          email: string;
          game: string;
          hours: string;
          id?: string;
          link?: string;
          name: string;
          rank: string;
          reason?: string;
          reference?: string;
          region: string;
          role?: string;
          services: string[];
          status?: string;
          submitted_at?: string;
          why?: string;
        };
        Update: {
          account_id?: string | null;
          country?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decided_by_name?: string;
          discord?: string;
          email?: string;
          game?: string;
          hours?: string;
          id?: string;
          link?: string;
          name?: string;
          rank?: string;
          reason?: string;
          reference?: string;
          region?: string;
          role?: string;
          services?: string[];
          status?: string;
          submitted_at?: string;
          why?: string;
        };
        Relationships: [];
      };
      teammate_earning_entries: {
        Row: {
          assignment_id: string;
          completed_at: string;
          deposit_percent: number;
          held_usd_cents: number;
          net_usd_cents: number;
          order_id: string;
          payout_usd_cents: number;
          prior_completed_count: number;
          proof_ids: string[];
          request_id: string;
          result: Json;
          source_snapshot: Json;
          teammate_id: string;
          trust_tier: string;
        };
        Insert: {
          assignment_id: string;
          completed_at: string;
          deposit_percent: number;
          held_usd_cents: number;
          net_usd_cents: number;
          order_id: string;
          payout_usd_cents: number;
          prior_completed_count: number;
          proof_ids: string[];
          request_id: string;
          result: Json;
          source_snapshot: Json;
          teammate_id: string;
          trust_tier: string;
        };
        Update: {
          assignment_id?: string;
          completed_at?: string;
          deposit_percent?: number;
          held_usd_cents?: number;
          net_usd_cents?: number;
          order_id?: string;
          payout_usd_cents?: number;
          prior_completed_count?: number;
          proof_ids?: string[];
          request_id?: string;
          result?: Json;
          source_snapshot?: Json;
          teammate_id?: string;
          trust_tier?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'teammate_earning_entries_assignment_id_order_id_teammate_i_fkey';
            columns: ['assignment_id', 'order_id', 'teammate_id'];
            isOneToOne: false;
            referencedRelation: 'order_assignments';
            referencedColumns: ['id', 'order_id', 'teammate_id'];
          },
          {
            foreignKeyName: 'teammate_earning_entries_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'teammate_earning_entries_teammate_id_fkey';
            columns: ['teammate_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      teammate_order_access: {
        Row: {
          approved_games: string[];
          discord_id: string | null;
          discord_verified_at: string | null;
          enabled_games: string[];
          gg_access: boolean;
          priority_adjustment: number;
          priority_adjustment_expires_at: string | null;
          priority_adjustment_reason: string;
          priority_adjustment_set_at: string | null;
          priority_adjustment_set_by: string;
          priority_base: number;
          priority_base_set_at: string | null;
          priority_base_set_by: string;
          priority_forgiven_at: string | null;
          suspended: boolean;
          suspended_at: string | null;
          suspended_by: string | null;
          suspended_reason: string;
          user_id: string;
          voice_opt_in: boolean;
        };
        Insert: {
          approved_games?: string[];
          discord_id?: string | null;
          discord_verified_at?: string | null;
          enabled_games?: string[];
          gg_access?: boolean;
          priority_adjustment?: number;
          priority_adjustment_expires_at?: string | null;
          priority_adjustment_reason?: string;
          priority_adjustment_set_at?: string | null;
          priority_adjustment_set_by?: string;
          priority_base?: number;
          priority_base_set_at?: string | null;
          priority_base_set_by?: string;
          priority_forgiven_at?: string | null;
          suspended?: boolean;
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspended_reason?: string;
          user_id: string;
          voice_opt_in?: boolean;
        };
        Update: {
          approved_games?: string[];
          discord_id?: string | null;
          discord_verified_at?: string | null;
          enabled_games?: string[];
          gg_access?: boolean;
          priority_adjustment?: number;
          priority_adjustment_expires_at?: string | null;
          priority_adjustment_reason?: string;
          priority_adjustment_set_at?: string | null;
          priority_adjustment_set_by?: string;
          priority_base?: number;
          priority_base_set_at?: string | null;
          priority_base_set_by?: string;
          priority_forgiven_at?: string | null;
          suspended?: boolean;
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspended_reason?: string;
          user_id?: string;
          voice_opt_in?: boolean;
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
      teammate_presence: {
        Row: {
          last_active_at: string | null;
          last_seen_at: string | null;
          online: boolean;
          online_since: string | null;
          set_offline_by: string | null;
          set_offline_reason: string;
          user_id: string;
        };
        Insert: {
          last_active_at?: string | null;
          last_seen_at?: string | null;
          online?: boolean;
          online_since?: string | null;
          set_offline_by?: string | null;
          set_offline_reason?: string;
          user_id: string;
        };
        Update: {
          last_active_at?: string | null;
          last_seen_at?: string | null;
          online?: boolean;
          online_since?: string | null;
          set_offline_by?: string | null;
          set_offline_reason?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abandon_order_proof_upload: {
        Args: { p_proof_id: string };
        Returns: Json;
      };
      accept_handover: { Args: { p_token_hash: string }; Returns: Json };
      accept_order: { Args: { p_order_id: string }; Returns: Json };
      admin_account_dto: {
        Args: { p_user: string; p_viewer: string };
        Returns: Json;
      };
      admin_accounts: { Args: never; Returns: Json };
      admin_adjust_priority: {
        Args: {
          p_duration: string;
          p_points: number;
          p_reason: string;
          p_user: string;
        };
        Returns: Json;
      };
      admin_application_dto: {
        Args: {
          p: Database['public']['Tables']['teammate_applications']['Row'];
        };
        Returns: Json;
      };
      admin_applications: { Args: never; Returns: Json };
      admin_apply_role: {
        Args: {
          p_actor: string;
          p_actor_name: string;
          p_role: string;
          p_target: string;
        };
        Returns: Json;
      };
      admin_audit: { Args: { p_limit?: number }; Returns: Json };
      admin_caller: {
        Args: never;
        Returns: {
          id: string;
          name: string;
        }[];
      };
      admin_cancel_order: {
        Args: { p_order_id: string; p_reason: string };
        Returns: Json;
      };
      admin_clear_adjustment: { Args: { p_user: string }; Returns: Json };
      admin_create_creator: {
        Args: { p_channel: string; p_code: string; p_name: string };
        Returns: Json;
      };
      admin_create_handover: { Args: { p_order_id: string }; Returns: Json };
      admin_creators: { Args: never; Returns: Json };
      admin_customers: { Args: never; Returns: Json };
      admin_wallet_adjust: {
        Args: {
          p_amount_eur_cents: number;
          p_reason: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      admin_decide_application: {
        Args: {
          p_application_id: string;
          p_decision: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_forgive_misses: { Args: { p_user: string }; Returns: Json };
      admin_log: {
        Args: {
          p_action: string;
          p_actor: string;
          p_actor_name: string;
          p_detail: string;
          p_target: string;
        };
        Returns: undefined;
      };
      admin_order_report_decide: {
        Args: { p_decision: string; p_reason: string; p_report_id: string };
        Returns: Json;
      };
      admin_order_reports: { Args: never; Returns: Json };
      admin_orders: { Args: { p_limit?: number }; Returns: Json };
      admin_presence: { Args: never; Returns: Json };
      admin_presence_check_in: { Args: { p_online?: boolean }; Returns: Json };
      admin_priority: { Args: never; Returns: Json };
      admin_priority_dto: {
        Args: { p_now: string; p_user: string };
        Returns: Json;
      };
      admin_priority_target: { Args: { p_user: string }; Returns: string };
      admin_refund_order: {
        Args: { p_order_id: string; p_reason: string };
        Returns: Json;
      };
      admin_reset_priority: { Args: { p_user: string }; Returns: Json };
      admin_set_access: {
        Args: { p_games: string[]; p_gg: boolean; p_user_id: string };
        Returns: Json;
      };
      admin_set_blocked: {
        Args: { p_blocked: boolean; p_reason?: string; p_user_id: string };
        Returns: Json;
      };
      admin_creator_payout_pay: {
        Args: {
          p_creator_id: string;
          p_method: string;
          p_month: string;
          p_reference: string;
        };
        Returns: Json;
      };
      admin_payout_hold: {
        Args: { p_line_id: string; p_reason: string };
        Returns: Json;
      };
      admin_payout_pay: {
        Args: { p_line_id: string; p_method: string; p_reference: string };
        Returns: Json;
      };
      admin_payout_pay_all: {
        Args: { p_method: string; p_reference: string };
        Returns: Json;
      };
      admin_payout_release: { Args: { p_line_id: string }; Returns: Json };
      admin_payouts: { Args: never; Returns: Json };
      admin_set_creator_active: {
        Args: { p_active: boolean; p_id: string };
        Returns: Json;
      };
      admin_set_priority: {
        Args: { p_base: number; p_user: string };
        Returns: Json;
      };
      admin_set_role: {
        Args: { p_role: string; p_user_id: string };
        Returns: Json;
      };
      admin_set_suspended: {
        Args: { p_reason?: string; p_suspended: boolean; p_user_id: string };
        Returns: Json;
      };
      admin_set_teammate_offline: {
        Args: { p_reason: string; p_user: string };
        Returns: Json;
      };
      admin_support_command: {
        Args: { p_action: string; p_conversation_id: string; p_text?: string };
        Returns: Json;
      };
      admin_support_inbox: {
        Args: { p_conversation_id?: string };
        Returns: Json;
      };
      admin_teammate_adjust: {
        Args: {
          p_amount_usd_cents: number;
          p_reason: string;
          p_teammate_id: string;
        };
        Returns: Json;
      };
      admin_teammates: { Args: never; Returns: Json };
      authorize_order_proof_upload: {
        Args: { p_assignment_id: string; p_order_id: string };
        Returns: Json;
      };
      begin_order_proof_upload: {
        Args: {
          p_assignment_id: string;
          p_order_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      cancel_queued_order: { Args: { p_order_id: string }; Returns: Json };
      claim_approved_application: {
        Args: { p_user: string };
        Returns: undefined;
      };
      claim_payment_settlements: {
        Args: { p_limit?: number };
        Returns: {
          amount_eur_cents: number;
          amount_minor: number;
          attempts: number;
          created_at: string;
          currency: string;
          intent_id: string;
          last_error: string | null;
          order_id: string;
          payment_method_type: string;
          refund_reason: string | null;
          refunded_at: string | null;
          settle: string;
          state: string;
          stripe_payment_intent_id: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'order_payments';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_stale_order_proof_uploads: {
        Args: { p_limit?: number };
        Returns: Json;
      };
      complete_order: {
        Args: {
          p_assignment_id: string;
          p_order_id: string;
          p_proof_ids: string[];
          p_request_id: string;
        };
        Returns: Json;
      };
      completion_trust: {
        Args: { p_prior_completed_count: number };
        Returns: Json;
      };
      create_paid_order: {
        Args: {
          p_amount_minor: number;
          p_currency: string;
          p_intent_id: string;
          p_method: string;
          p_payment_intent: string;
          p_state: string;
        };
        Returns: Json;
      };
      customer_active_order: { Args: never; Returns: Json };
      customer_checkout_status: {
        Args: { p_intent_id: string };
        Returns: Json;
      };
      customer_order: { Args: { p_order_id: string }; Returns: Json };
      customer_order_history: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      customer_refund_credits: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      customer_rewards: { Args: never; Returns: Json };
      desk_check_in: { Args: { p_last_active?: string }; Returns: Json };
      desk_set_online: { Args: { p_online: boolean }; Returns: Json };
      finalize_order_proof_upload: {
        Args: {
          p_byte_size: number;
          p_mime: string;
          p_proof_id: string;
          p_sha256: string;
        };
        Returns: Json;
      };
      finish_payment_settlement: {
        Args: { p_error?: string; p_order_id: string; p_state: string };
        Returns: undefined;
      };
      get_order_chat: {
        Args: { p_assignment_id?: string; p_order_id: string };
        Returns: Json;
      };
      get_order_proof: {
        Args: { p_order_id: string; p_proof_id: string };
        Returns: Json;
      };
      handover_info: { Args: { p_token_hash: string }; Returns: Json };
      home_recent_matches: { Args: never; Returns: Json };
      list_order_chat_flags: { Args: never; Returns: Json };
      list_order_proofs: { Args: { p_order_id: string }; Returns: Json };
      order_chat_append: {
        Args: {
          p_assignment_id: string;
          p_body: string;
          p_event?: string;
          p_image: string;
          p_name: string;
          p_request_id: string;
          p_sender: string;
        };
        Returns: Json;
      };
      order_chat_block_rule: { Args: { p_body: string }; Returns: string };
      order_chat_can_receive_topic: {
        Args: { p_topic: string };
        Returns: boolean;
      };
      order_chat_flag_dto: {
        Args: {
          p_flag: Database['public']['Tables']['order_chat_flags']['Row'];
        };
        Returns: Json;
      };
      order_chat_invalidate: {
        Args: { p_assignment_id: string };
        Returns: undefined;
      };
      order_chat_message_dto: {
        Args: {
          p_message: Database['public']['Tables']['order_chat_messages']['Row'];
        };
        Returns: Json;
      };
      order_chat_system_events: {
        Args: { p_order: Database['public']['Tables']['orders']['Row'] };
        Returns: undefined;
      };
      order_chat_viewer: {
        Args: {
          p_assignment_id: string;
          p_order: Database['public']['Tables']['orders']['Row'];
        };
        Returns: string;
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
      order_proof_dto: {
        Args: { p: Database['public']['Tables']['order_proof_uploads']['Row'] };
        Returns: Json;
      };
      order_proof_observer: {
        Args: {
          p_actor: string;
          p_order: Database['public']['Tables']['orders']['Row'];
        };
        Returns: boolean;
      };
      order_proof_player: {
        Args: {
          p_actor: string;
          p_order: Database['public']['Tables']['orders']['Row'];
        };
        Returns: boolean;
      };
      order_report_create: {
        Args: {
          p_description: string;
          p_evidence: Json;
          p_order_id: string;
          p_report_id: string;
          p_type: string;
        };
        Returns: Json;
      };
      order_report_customer_dto: {
        Args: {
          p_report: Database['public']['Tables']['order_reports']['Row'];
        };
        Returns: Json;
      };
      order_review: {
        Args: {
          p_order_id: string;
          p_rating: number;
          p_tags?: string[];
          p_text?: string;
        };
        Returns: Json;
      };
      order_review_dto: {
        Args: {
          p_review: Database['public']['Tables']['order_reviews']['Row'];
        };
        Returns: Json;
      };
      order_sweep: { Args: { p_limit: number }; Returns: number };
      order_teammate_dto: {
        Args: { p_order: Database['public']['Tables']['orders']['Row'] };
        Returns: Json;
      };
      presence_desk_result: { Args: { p_user: string }; Returns: Json };
      presence_public_count: { Args: never; Returns: number };
      presence_teammate_ready: { Args: { p_user: string }; Returns: boolean };
      priority_penalty: {
        Args: { p_now: string; p_user: string };
        Returns: number;
      };
      profile_languages_valid: {
        Args: { p_languages: string[] };
        Returns: boolean;
      };
      record_payment_refund: {
        Args: { p_payment_intent: string; p_reason?: string };
        Returns: Json;
      };
      refresh_discord_link: { Args: { p_user: string }; Returns: undefined };
      reroll_order: { Args: { p_order_id: string }; Returns: Json };
      resolve_order_chat_flag: {
        Args: { p_flag_id: string; p_status: string };
        Returns: Json;
      };
      run_order_proof_cleanup: { Args: never; Returns: undefined };
      send_order_chat_message: {
        Args: {
          p_assignment_id: string;
          p_body: string;
          p_order_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      set_order_chat_typing: {
        Args: { p_assignment_id: string; p_order_id: string };
        Returns: Json;
      };
      set_teammate_queue_settings: {
        Args: { p_enabled_games: string[]; p_voice_opt_in: boolean };
        Returns: Json;
      };
      submit_teammate_application: {
        Args: {
          p_country: string;
          p_discord: string;
          p_email: string;
          p_game: string;
          p_hours: string;
          p_link: string;
          p_name: string;
          p_rank: string;
          p_region: string;
          p_role: string;
          p_services: string[];
          p_why: string;
        };
        Returns: Json;
      };
      support_add_user_message: {
        Args: { p_body: string; p_conversation_id: string; p_limit?: number };
        Returns: Json;
      };
      support_online_admins: { Args: never; Returns: Json };
      support_take_ai_slot: {
        Args: {
          p_identity_key: string;
          p_identity_limit: number;
          p_limit: number;
        };
        Returns: boolean;
      };
      sweep_expired_orders: { Args: { p_limit?: number }; Returns: Json };
      sync_account_owner: {
        Args: { p_owner: boolean; p_user_id: string };
        Returns: undefined;
      };
      teammate_current_assignment: { Args: never; Returns: Json };
      teammate_earnings: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      teammate_leaderboard: { Args: { p_now: string }; Returns: Json };
      teammate_order_queue: { Args: never; Returns: Json };
      teammate_queue_personal_eligible: {
        Args: {
          p_order: Database['public']['Tables']['orders']['Row'];
          p_user: string;
        };
        Returns: boolean;
      };
      teammate_payout_details: { Args: never; Returns: Json };
      teammate_queue_settings: { Args: never; Returns: Json };
      teammate_save_payout_details: {
        Args: {
          p_account: string;
          p_address: string;
          p_country: string;
          p_date_of_birth: string;
          p_legal_name: string;
          p_method: string;
          p_tax_number: string;
        };
        Returns: Json;
      };
      teammate_stats: { Args: never; Returns: Json };
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
