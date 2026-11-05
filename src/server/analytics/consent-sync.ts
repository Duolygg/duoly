import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentState } from '../../contracts/consent';

/** Only pass a service-role client: browser roles cannot access this snapshot. */
export async function recordAnalyticsConsent(
  client: SupabaseClient | null,
  userId: string,
  state: ConsentState,
): Promise<void> {
  try {
    if (!client) throw new Error('Service client unavailable.');
    const { error } = await client.from('analytics_consent').upsert(
      {
        user_id: userId,
        analytics: state.analytics,
        marketing: state.marketing,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
  } catch {
    // Do not log identity, consent values or provider error payloads.
    console.error('Analytics consent snapshot could not be recorded.');
  }
}
