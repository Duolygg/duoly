import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../auth/database.types';

/**
 * Narrow contract for the unapplied completion migration. The generated base
 * remains an exact snapshot of the hosted database. Regenerate that snapshot
 * after authorized migration activation, then remove this extension.
 * No raw financial-table access is exposed here.
 */
type CompletionDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      complete_order: {
        Args: {
          p_order_id: string;
          p_assignment_id: string;
          p_proof_ids: string[];
          p_request_id: string;
        };
        Returns: Json;
      };
      teammate_earnings: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
    };
  };
};
export type CompletionClient = SupabaseClient<CompletionDatabase>;
