/**
 * Reads public.background_switches, the only thing that decides who does each kind of background
 * work (docs/product/background-work.md). The app never writes this table: flipping a kind is an
 * owner UPDATE in the SQL editor, which is deliberately not a capability any API key has.
 *
 * Fail-safe in one direction only: a missing row, a missing table, an unknown mode or any error
 * all read as 'legacy', so nothing new happens before the owner has decided. The same fail-safe
 * runs in SQL (public.background_mode), which leaves duoly_dispatch doing the work rather than
 * leaving it to nobody.
 *
 * Deliberately not cached. A fire or an event hook costs one primary-key read of a four-row
 * table, and a rollback has to take effect at once, not after a TTL.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SWITCH_KINDS,
  SWITCH_MODES,
  type SwitchKind,
  type SwitchMode,
} from '../../contracts/background';

const legacy = (): Record<SwitchKind, SwitchMode> =>
  Object.fromEntries(SWITCH_KINDS.map((kind) => [kind, 'legacy'])) as Record<
    SwitchKind,
    SwitchMode
  >;

const mode = (value: unknown): SwitchMode | null =>
  typeof value === 'string' &&
  (SWITCH_MODES as readonly string[]).includes(value)
    ? (value as SwitchMode)
    : null;

/** The mode of one kind. Never throws. */
export async function backgroundMode(
  db: SupabaseClient,
  kind: SwitchKind,
): Promise<SwitchMode> {
  try {
    const { data, error } = await db
      .from('background_switches')
      .select('mode')
      .eq('kind', kind)
      .maybeSingle();
    if (error) return 'legacy';
    return mode((data as { mode?: unknown } | null)?.mode) ?? 'legacy';
  } catch {
    return 'legacy';
  }
}

/** All four modes in one read, for the reconcile endpoint and the admin views. */
export async function backgroundModes(
  db: SupabaseClient,
): Promise<Record<SwitchKind, SwitchMode>> {
  const modes = legacy();
  try {
    const { data, error } = await db
      .from('background_switches')
      .select('kind, mode');
    if (error || !Array.isArray(data)) return modes;
    for (const row of data as { kind?: unknown; mode?: unknown }[]) {
      const kind = SWITCH_KINDS.find((k) => k === row.kind);
      const value = mode(row.mode);
      if (kind && value) modes[kind] = value;
    }
    return modes;
  } catch {
    return modes;
  }
}
