import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toOriginalPresence } from '../../src/components/teammate/teammate-data';
import { AFK_OFFLINE_REASON } from '../../src/components/teammate/desk-keeper';

// Offline after 4 hours without activity (migration 20261105160000_presence_afk_offline.sql).
const sql = readFileSync(
  'supabase/migrations/20261105160000_presence_afk_offline.sql',
  'utf8',
);

describe('AFK offline', () => {
  it('passes the countdown through, and still reads answers without it', () => {
    const base = {
      online: true,
      online_since: '2026-11-05T10:00:00+00:00',
      forced_offline: null,
    };
    expect(toOriginalPresence({ ...base, afk_in: 290 }).afkIn).toBe(290);
    expect(toOriginalPresence({ ...base, afk_in: null }).afkIn).toBeNull();
    expect(toOriginalPresence(base).afkIn).toBeNull();
    expect(() => toOriginalPresence({ ...base, afk_in: -1 })).toThrow();
  });
  it('goes offline after 4 hours idle, never while busy, with the reason the desk words', () => {
    expect(sql).toContain("select interval '4 hours'");
    expect(sql).toContain(
      `set_offline_reason='${AFK_OFFLINE_REASON}',set_offline_by=null`,
    );
    expect(sql).toMatch(
      /last_active_at=case when public\.presence_busy\(v_actor\) then v_now/,
    );
    expect(sql).toMatch(
      /presence_busy[\s\S]*o\.status = 'in_progress'[\s\S]*order_streamer_bookings/,
    );
    expect(sql).toContain("coalesce(p_last_active,'epoch'::timestamptz)");
  });
});
