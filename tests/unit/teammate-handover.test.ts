import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTeammateFetch } from '../../src/components/teammate/teammate-data';
import { OrderResponseSchemas } from '../../src/contracts/orders';

// A teammate hands over the order they're playing (migration 20261102150000).
const id = '11111111-1111-4111-8111-111111111111';
const token = 'AbCdEfGhIjKlMnOpQrStUv12';

afterEach(() => vi.unstubAllGlobals());

describe('teammate handover', () => {
  it('makes a one-time claim link through the live endpoint', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://duoly.gg' } });
    const transport = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/api/teammate/orders/' + id + '/handover');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ csrf: 'token' });
      return Response.json({
        token,
        expiresAt: '2026-11-02T13:15:00.000+00:00',
      });
    });
    const api = createTeammateFetch({ csrf: 'token', fetcher: transport });
    const res = await api('/api/orders/' + id, {
      method: 'POST',
      body: JSON.stringify({ action: 'handover' }),
    });
    expect(await res.json()).toEqual({
      url: 'https://duoly.gg/claim/' + token,
      expiresAt: Date.parse('2026-11-02T13:15:00.000+00:00'),
    });
  });

  it('cancels the link', async () => {
    const transport = vi.fn(async (url: string) => {
      expect(url).toBe('/api/teammate/orders/' + id + '/handover-cancel');
      return Response.json({ revoked: true });
    });
    const api = createTeammateFetch({ csrf: 'token', fetcher: transport });
    const res = await api('/api/orders/' + id, {
      method: 'POST',
      body: JSON.stringify({ action: 'handover-cancel' }),
    });
    expect(await res.json()).toEqual({ revoked: true });
  });

  it('accepts only a well-formed token from the server', () => {
    const schema = OrderResponseSchemas.teammateHandover;
    expect(
      schema.safeParse({ token, expiresAt: '2026-11-02T13:15:00Z' }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ token: 'short', expiresAt: '2026-11-02T13:15:00Z' })
        .success,
    ).toBe(false);
  });

  it('the migration keeps the rules: in progress only, 15 minutes, same access, not busy', () => {
    const sql = readFileSync(
      'supabase/migrations/20261102150000_teammate_handover.sql',
      'utf8',
    );
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain('Only an order you’re playing can be handed over.');
    expect(sql).toContain("end_reason = 'handed_over'");
    expect(sql).toContain('Finish your current order first.');
    expect(sql).toContain(
      '((a.gg_access and v_order.gg) or (not v_order.gg and v_order.game = any(a.approved_games)))',
    );
    // the link dies with the teammate's part of the order
    expect(sql).toContain(
      'after update of status, queued_at, current_assignment_id on public.orders',
    );
    expect(sql).toContain(
      'grant execute on function public.teammate_create_handover(uuid), public.teammate_revoke_handover(uuid) to authenticated',
    );
  });
});
