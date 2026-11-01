import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildCheckout,
  CheckoutRequestSchema,
} from '../../src/server/payments/checkout';
import { ORDER_MOODS, TeammateOrderSchema } from '../../src/contracts/orders';
import { toOriginalTeammateOrder } from '../../src/components/teammate/teammate-data.js';
import { MOODS, moodOf } from '../../src/components/shared/moods.jsx';
import {
  moodFact,
  openPost,
  type PostOrder,
} from '../../src/server/discord/order-posts';

const lol = {
  gameId: 'lol',
  serviceId: 'duo2',
  units: 3,
  server: 'EUW',
  rank: 'Platinum',
  ign: 'Tester#EUW',
};
const social = {
  gameId: 'social',
  serviceId: 'sleep',
  units: 2,
  server: 'Europe',
  ign: 'hiroko',
};
const teammateOrder = {
  id: '11111111-1111-4111-8111-111111111111',
  public_reference: 'DL-48301',
  status: 'queued',
  game: 'lol',
  service: 'duo2',
  title: 'Duo',
  units: 1,
  unit: 'game',
  gg: false,
  rank: '',
  region: 'EUW',
  ign: 'Player',
  note: '',
  voice: false,
  customer_name: 'Player',
  customer_image: '',
  customer_country: '',
  payout_usd_cents: 399,
  current_assignment_id: null,
};

const migration = readFileSync(
  'supabase/migrations/20261101120000_order_moods.sql',
  'utf8',
);
const perks = readFileSync(
  'supabase/migrations/20261026160000_perks.sql',
  'utf8',
);
const foundation = readFileSync(
  'supabase/migrations/20261022093000_order_foundation.sql',
  'utf8',
);
const createPaidOrder = (sql: string) =>
  sql.match(
    /create or replace function public\.create_paid_order\([\s\S]*?end \$function\$;/,
  )![0];
const teammateDto = (sql: string) =>
  sql.match(/function public\.order_teammate_dto\([\s\S]*?\n\$\$;/)![0];
const duePosts = (sql: string) =>
  sql.match(
    /create or replace function public\.discord_order_posts_due\([\s\S]*?\n\$function\$;/,
  )![0];

const postOrder: PostOrder = {
  reference: 'DL-48321',
  game: 'lol',
  title: 'Duo Pro',
  units: 3,
  unit: 'game',
  rank: 'Platinum II',
  region: 'EUW',
  voice: true,
  gg: false,
  payoutUsdCents: 1086,
  queuedAt: Date.parse('2026-11-01T12:00:00Z'),
  cancelsAt: Date.parse('2026-11-01T12:05:00Z'),
};
const postText = (o: PostOrder) =>
  JSON.stringify(
    openPost(o, 'https://duoly.gg/claim/abcdefghijklmnopqrstuvwx', {
      site: 'https://duoly.gg',
    }),
  );

describe('order moods: checkout', () => {
  it('accepts the four moods and nothing else', () => {
    for (const mood of ORDER_MOODS)
      expect(CheckoutRequestSchema.safeParse({ ...lol, mood }).success).toBe(
        true,
      );
    expect(
      CheckoutRequestSchema.safeParse({ ...lol, mood: 'toxic' }).success,
    ).toBe(false);
    expect(CheckoutRequestSchema.safeParse({ ...lol, mood: '' }).success).toBe(
      false,
    );
  });

  it('puts the mood on the intent row only when one was picked', () => {
    const picked = buildCheckout(
      CheckoutRequestSchema.parse({ ...lol, mood: 'tryhard' }),
    );
    expect(picked.row).toMatchObject({ mood: 'tryhard' });
    const none = buildCheckout(CheckoutRequestSchema.parse(lol));
    expect(none.row).not.toHaveProperty('mood');
  });

  it('never gives a Social session a mood', () => {
    const built = buildCheckout(
      CheckoutRequestSchema.parse({ ...social, mood: 'fun' }),
    );
    expect(built.row).not.toHaveProperty('mood');
  });
});

describe('order moods: teammate side', () => {
  it('reads the mood from the teammate DTO, before and after the migration', () => {
    expect(TeammateOrderSchema.safeParse(teammateOrder).success).toBe(true);
    expect(
      TeammateOrderSchema.safeParse({ ...teammateOrder, mood: null }).success,
    ).toBe(true);
    expect(
      TeammateOrderSchema.safeParse({ ...teammateOrder, mood: 'teach' })
        .success,
    ).toBe(true);
    expect(
      TeammateOrderSchema.safeParse({ ...teammateOrder, mood: 'angry' })
        .success,
    ).toBe(false);
  });

  it('passes the mood to the desk and leaves it out when there is none', () => {
    expect(
      toOriginalTeammateOrder({ ...teammateOrder, mood: 'chill' }),
    ).toMatchObject({ mood: 'chill' });
    expect(
      toOriginalTeammateOrder({ ...teammateOrder, mood: null }),
    ).not.toHaveProperty('mood');
  });

  it('has a name, line, colour and icon for every mood the server accepts', () => {
    expect(MOODS.map((m) => m.id)).toEqual([...ORDER_MOODS]);
    for (const id of ORDER_MOODS) {
      const mood = moodOf(id)!;
      expect(mood.name.length).toBeGreaterThan(0);
      expect(mood.line.length).toBeGreaterThan(0);
      expect(mood.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(mood.paths.length).toBeGreaterThan(0);
    }
    expect(moodOf('nope')).toBeNull();
  });
});

describe('order moods: Discord order posts', () => {
  it('shows the mood next to rank, server and voice', () => {
    expect(postText({ ...postOrder, mood: 'tryhard' })).toContain(
      '🔥 **Tryhard**',
    );
    expect(postText({ ...postOrder, mood: 'teach' })).toContain(
      '🎓 **Teach me**',
    );
  });

  it('shows nothing for no mood or an unknown one', () => {
    const plain = postText(postOrder);
    expect(postText({ ...postOrder, mood: null })).toBe(plain);
    expect(postText({ ...postOrder, mood: 'toString' })).toBe(plain);
    expect(moodFact(undefined)).toBe('');
  });

  it('uses the same mood names as the checkout', () => {
    for (const m of MOODS) expect(moodFact(m.id)).toContain(`**${m.name}**`);
  });
});

describe('order moods migration (static; real SQL suites are separate)', () => {
  it('changes discord_order_posts_due only by adding the mood', () => {
    expect(duePosts(migration)).toBe(
      duePosts(perks).replace(
        "'voice', o.voice,\n",
        "'voice', o.voice, 'mood', o.mood,\n",
      ),
    );
  });

  it('adds a nullable mood limited to the four moods on intents and orders', () => {
    const allowed = ORDER_MOODS.map((m) => `'${m}'`).join(',');
    for (const table of ['checkout_intents', 'orders'])
      expect(migration).toContain(
        `alter table public.${table} add column mood text\n  constraint ${table}_mood_check check (mood in (${allowed}))`,
      );
    expect(migration).not.toMatch(/mood text not null/i);
  });

  it('changes create_paid_order only by copying the mood from the intent', () => {
    const before = createPaidOrder(perks);
    const after = createPaidOrder(migration);
    expect(after).toBe(
      before
        .replace(
          'ign, note, voice,\n      customer_name',
          'ign, note, voice, mood,\n      customer_name',
        )
        .replace(
          'i.ign, i.note, i.voice,\n',
          'i.ign, i.note, i.voice, i.mood,\n',
        ),
    );
    expect(after).not.toBe(before);
  });

  it('adds mood to the teammate DTO and touches no grants or customer view', () => {
    expect(teammateDto(migration)).toBe(
      teammateDto(foundation).replace(
        "'voice', p_order.voice,\n",
        "'voice', p_order.voice,\n    'mood', p_order.mood,\n",
      ),
    );
    expect(migration).not.toMatch(/\bgrant\b|\brevoke\b/i);
    expect(migration).not.toContain('order_customer_dto');
    expect(migration.trim().startsWith('--')).toBe(true);
    expect(migration).toContain('\nbegin;\n');
    expect(migration.trim().endsWith('commit;')).toBe(true);
  });
});
