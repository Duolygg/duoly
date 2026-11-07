import { describe, expect, it, vi } from 'vitest';
import { orderStatusResult, nextStep } from '../../src/server/mcp/order-status';
const token = 'dos_' + 'A'.repeat(43);
const fixture = {
  status: 'queued',
  game: 'val',
  service: 'duo2',
  title: 'Duo Pro',
  quantity: { value: 3, unit: 'game' },
  rank: 'Gold',
  region: 'EU',
  paidEurMinor: 1617,
  accepted: false,
  teammateDisplayName: null,
  bookedAt: '2026-11-07T10:00:00Z',
  searchingAt: '2026-11-07T10:00:00Z',
  acceptedAt: null,
  completedAt: null,
  team: null,
  roomUrl: 'https://duoly.gg/queue/00000000-0000-4000-8000-000000000001',
};
function storage(data: unknown = fixture) {
  return vi.fn(async (name: string, ...args: [Record<string, unknown>]) => ({
    data:
      name === 'mcp_take_rate_limit' && args.length
        ? { allowed: true, retry_after: 0 }
        : data,
    error: null,
  }));
}
describe('private read-only order status', () => {
  it('hashes the code and emits one lean summary plus allowlisted data', async () => {
    const rpc = storage();
    const result = await orderStatusResult({ token }, rpc);
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.structuredContent).toMatchObject({
      status: 'queued',
      accepted: false,
    });
    expect(result.structuredContent).not.toHaveProperty('roomUrl');
    expect(result._meta?.['gg.duoly/card']).toMatchObject({
      roomUrl: fixture.roomUrl,
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      'mcp_take_rate_limit',
      'mcp_order_status',
    ]);
    expect(rpc.mock.calls[1]?.[1]).toEqual({
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });
  it.each([
    'email',
    'customer_id',
    'id',
    'payment',
    'chat',
    'ign',
    'note',
    'image',
    'public_reference',
  ])('rejects a storage projection contaminated with %s', async (key) => {
    const result = await orderStatusResult(
      { token },
      storage({ ...fixture, [key]: 'SECRET' }),
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result.structuredContent).toBeUndefined();
  });
  it('gives the same refusal for malformed, unknown, expired and revoked codes', async () => {
    const rpc = storage(null);
    const results = await Promise.all(
      ['bad', token, 'dos_' + 'B'.repeat(42) + 'A'].map((t) =>
        orderStatusResult({ token: t }, rpc),
      ),
    );
    expect(new Set(results.map((r) => r.content[0]?.text)).size).toBe(1);
    expect(results.every((r) => r.isError && !r.structuredContent)).toBe(true);
  });
  it('fails closed on quota outage or denial before status storage', async () => {
    for (const response of [
      { data: null, error: {} },
      { data: { allowed: false, retry_after: 60 }, error: null },
      { data: {}, error: null },
    ]) {
      const rpc = vi.fn().mockResolvedValue(response);
      expect((await orderStatusResult({ token }, rpc)).isError).toBe(true);
      expect(rpc).toHaveBeenCalledTimes(1);
    }
  });
  it.each([
    ['queued', false, null, 'Wait in your Duoly order room'],
    ['in_progress', true, null, 'Open your Duoly order room to coordinate'],
    ['completed', true, null, 'Session complete; review it on Duoly'],
    ['cancelled', false, null, 'Open Duoly for cancellation details'],
    [
      'in_progress',
      true,
      'waiting',
      'Your teammate accepted; waiting for the remaining seats',
    ],
    [
      'completed',
      true,
      'started',
      'This seat finished; the team session continues',
    ],
  ])(
    'uses honest next steps for %s / %s / %s',
    (status, accepted, team, expected) => {
      expect(
        nextStep({ status, accepted, team: team ? { status: team } : null }),
      ).toBe(expected);
    },
  );
  it('accepts a filled team seat without claiming that the team has started', async () => {
    const data = {
      ...fixture,
      status: 'in_progress',
      accepted: true,
      teammateDisplayName: 'Mira',
      acceptedAt: '2026-11-07T10:01:00Z',
      team: {
        status: 'waiting',
        seats: 2,
        filled: 1,
        startedAt: null,
        endedAt: null,
        members: [
          { status: 'in_progress', name: 'Mira', thisSeat: true },
          { status: 'queued', name: null, thisSeat: false },
        ],
      },
    };
    const result = await orderStatusResult({ token }, storage(data));
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.nextStep).toContain(
      'waiting for the remaining seats',
    );
    expect(result.structuredContent?.team?.filled).toBe(1);
    const contaminated = {
      ...data,
      team: {
        ...data.team,
        members: [
          { ...data.team.members[0], email: 'SECRET' },
          data.team.members[1],
        ],
      },
    };
    expect(
      (await orderStatusResult({ token }, storage(contaminated))).isError,
    ).toBe(true);
  });
  it('rejects inconsistent filled-seat counts instead of publishing fictional progress', async () => {
    const team = {
      status: 'waiting',
      seats: 2,
      filled: 2,
      startedAt: null,
      endedAt: null,
      members: [
        { status: 'queued', name: null, thisSeat: true },
        { status: 'queued', name: null, thisSeat: false },
      ],
    };
    expect(
      (await orderStatusResult({ token }, storage({ ...fixture, team })))
        .isError,
    ).toBe(true);
  });
  it('does not retain a name after reroll or cancellation', async () => {
    const result = await orderStatusResult(
      { token },
      storage({
        ...fixture,
        status: 'cancelled',
        accepted: false,
        teammateDisplayName: 'Old name',
      }),
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Old name');
  });
});
