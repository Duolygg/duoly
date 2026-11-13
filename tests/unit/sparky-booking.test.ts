import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/server/home/live', () => ({
  homeLive: async () => ({
    stats: { onlineByGame: { val: 4, lol: 2 }, matchSeconds: 90 },
  }),
}));

import {
  gameNamed,
  gameToken,
  offerBooking,
  tilesFor,
  type BookingArgs,
} from '../../src/server/support/booking';
import { readTicket } from '../../src/server/support/booking-ticket';
import { runTool, type ToolContext } from '../../src/server/support/tools';
import { answerMetadata, answerWithAi } from '../../src/server/support/ai';
import type { SupportPerson } from '../../src/server/support/sparky';
import { calculateQuote } from '../../src/server/pricing';
import { parseBookingPreferences } from '../../src/contracts/booking-link';
import { seatRule } from '../../src/contracts/seats';

const base: Omit<BookingArgs, 'game'> = {
  goal: null,
  service: null,
  rank: null,
  region: null,
  quantity: null,
  voice: null,
};
const guest: SupportPerson = { role: 'guest', name: 'Guest' };
const kai: SupportPerson = {
  role: 'teammate',
  accountRole: 'teammate',
  userId: '00000000-0000-4000-8000-0000000000aa',
  name: 'Kai',
};
const ctx = (person: SupportPerson): ToolContext => ({ person, lookup: null });

async function ticketFor(args: Partial<BookingArgs> & { game: string }) {
  const result = await offerBooking({ ...base, ...args });
  if (result.kind !== 'ticket') throw new Error(JSON.stringify(result));
  return result.ticket;
}

describe('offer_booking ticket', () => {
  it('prices every tile exactly like checkout prices the link it opens', async () => {
    const ticket = await ticketFor({
      game: 'Valorant',
      goal: 'ranked',
      rank: 'Platinum',
      region: 'EU',
      voice: true,
    });
    expect(ticket.game).toMatchObject({ id: 'val', name: 'Valorant' });
    expect(ticket.options.map((o) => o.quantity)).toEqual([1, 3, 5]);
    for (const option of ticket.options) {
      // The link is what checkout reads; price it from the link alone.
      const url = new URL(option.href, 'https://duoly.gg');
      expect(url.origin).toBe('https://duoly.gg');
      expect(url.searchParams.get('agent')).toBe('sparky');
      const { values, invalid } = parseBookingPreferences(
        url.searchParams,
        'val',
        ticket.service.id,
      );
      expect(invalid).toEqual([]);
      expect(values).toMatchObject({
        rank: 'Platinum',
        region: 'EU',
        qty: option.quantity,
      });
      const checkout = calculateQuote(
        {
          gameId: 'val',
          serviceId: url.searchParams.get('service')!,
          units: values.qty!,
          seats: seatRule('val', ticket.service.id).default,
          server: values.region!,
          rank: values.rank!,
        },
        { eurToUsd: 1, customerCurrency: 'EUR' },
      );
      expect(option.amountMinor).toBe(checkout.customer.amountMinor);
      expect(option.fullMinor).toBe(checkout.subtotalEurMinor);
      expect(option.discountPercent).toBe(checkout.quantityDiscountPercent);
    }
    // Five carries the quantity discount; the ticket starts on one unless asked.
    expect(ticket.options.at(-1)!.discountPercent).toBe(20);
    expect(ticket.selected).toBe(1);
    expect(ticket.online).toBe(4);
    expect(readTicket(ticket)).toEqual(ticket);
  });

  it('asks for the rank first when the price depends on it', async () => {
    const result = await offerBooking({ ...base, game: 'League' });
    expect(result.kind).toBe('needs');
    expect(result.forModel).toMatchObject({ needs: ['rank'] });
  });

  it('understands everyday names for games and ranks', async () => {
    expect(gameToken('League')).toBe('lol');
    expect(gameToken('CS2')).toBe('cs2');
    expect(gameToken('valorant')).toBe('val');
    const ticket = await ticketFor({
      game: 'league of legends',
      rank: 'plat 2',
      region: 'EUW',
      quantity: 4,
    });
    expect(ticket.rank).toBe('Platinum');
    expect(ticket.options.map((o) => o.quantity)).toEqual([1, 4, 5]);
    expect(ticket.selected).toBe(4);
  });

  it('drops a region the service does not have instead of linking it', async () => {
    const ticket = await ticketFor({
      game: 'val',
      rank: 'Gold',
      region: 'Mars',
    });
    expect(ticket.region).toBeNull();
    expect(ticket.options[0]!.href).not.toContain('region=');
  });

  it('turns unknown games into an error the model can explain', async () => {
    const result = await offerBooking({ ...base, game: 'Tetris' });
    expect(result.kind).toBe('invalid');
  });

  it('works for flat priced coaching without a rank', async () => {
    const ticket = await ticketFor({ game: 'val', goal: 'coaching' });
    expect(ticket.service.category).toBe('training');
    expect(ticket.rank).toBeNull();
  });

  it('keeps tile choices stable', () => {
    expect(tilesFor(null)).toEqual([1, 3, 5]);
    expect(tilesFor(3)).toEqual([1, 3, 5]);
    expect(tilesFor(2)).toEqual([1, 2, 5]);
  });
});

describe('stored tickets', () => {
  it('rejects anything that could leave Duoly or is malformed', async () => {
    const ticket = await ticketFor({ game: 'val', rank: 'Gold' });
    const evil = structuredClone(ticket);
    evil.options[0]!.href = '//evil.example/x';
    expect(readTicket(evil)).toBeNull();
    const evil2 = structuredClone(ticket);
    evil2.options[0]!.href = 'https://evil.example/';
    expect(readTicket(evil2)).toBeNull();
    const evil3 = structuredClone(ticket) as unknown as {
      game: { img: string };
    };
    evil3.game.img = 'javascript:alert(1)';
    expect(readTicket(evil3)).toBeNull();
    expect(readTicket(null)).toBeNull();
    expect(readTicket({ v: 2 })).toBeNull();
  });
});

describe('offer_booking as a Sparky tool', () => {
  it('returns the ticket next to a short output for the model', async () => {
    const result = await runTool(
      'offer_booking',
      JSON.stringify({ ...base, game: 'val', rank: 'Gold', region: 'EU' }),
      ctx(guest),
    );
    expect(result.status).toBe('ok');
    expect(result.ticket?.service.id).toBeTruthy();
    expect(JSON.stringify(result.output)).not.toContain('href');
  });

  it('is never offered to teammates', async () => {
    const result = await runTool(
      'offer_booking',
      JSON.stringify({ ...base, game: 'val', rank: 'Gold' }),
      ctx(kai),
    );
    expect(result.status).toBe('denied');
    expect(result.ticket).toBeUndefined();
  });

  it('refuses extra or missing arguments', async () => {
    const result = await runTool(
      'offer_booking',
      JSON.stringify({ game: 'val', price: 1 }),
      ctx(guest),
    );
    expect(result.status).toBe('invalid');
  });
});

const fnCall = (name: string, args: unknown) => ({
  type: 'function_call',
  call_id: `call_${name}`,
  name,
  arguments: JSON.stringify(args),
});
const final = (reply: string, handoff = false) => ({
  output: [
    {
      type: 'message',
      content: [
        { type: 'output_text', text: JSON.stringify({ reply, handoff }) },
      ],
    },
  ],
});
const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('Sparky shows the ticket under its reply', () => {
  it('attaches the ticket and stores it in the message metadata', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() =>
        ok({
          output: [
            fnCall('offer_booking', {
              ...base,
              game: 'val',
              goal: 'ranked',
              rank: 'Platinum',
              region: 'EU',
            }),
          ],
        }),
      )
      .mockImplementationOnce(() =>
        ok(final('Here is a ranked duo for Platinum on EU.')),
      );
    const answer = await answerWithAi({
      person: guest,
      question: 'need a valorant duo, plat EU, how much?',
      apiKey: 'test',
      fetcher,
    });
    expect(answer.booking?.game.id).toBe('val');
    expect(answerMetadata(answer).booking).toEqual(answer.booking);
    const first = JSON.parse(String(fetcher.mock.calls[0]![1].body));
    expect(first.instructions).toContain('call offer_booking');
  });

  it('shows no ticket next to a handoff', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() =>
        ok({
          output: [
            fnCall('offer_booking', { ...base, game: 'val', rank: 'Gold' }),
          ],
        }),
      )
      .mockImplementationOnce(() => ok(final('Getting a person.', true)));
    const answer = await answerWithAi({
      person: guest,
      question: 'I want a refund and a new booking',
      apiKey: 'test',
      fetcher,
    });
    expect(answer.booking).toBeUndefined();
  });

  it('gives teammates no booking rules', async () => {
    const fetcher = vi.fn().mockImplementationOnce(() => ok(final('Hi.')));
    await answerWithAi({
      person: kai,
      question: 'hello',
      apiKey: 'test',
      fetcher,
    });
    const first = JSON.parse(String(fetcher.mock.calls[0]![1].body));
    expect(first.instructions).not.toContain('offer_booking');
  });
});

describe('the game comes from the person, never from the model', () => {
  it('recognises names, short names and ids, without false hits', () => {
    expect(gameNamed('val', ['need a valorant duo'])).toBe(true);
    expect(gameNamed('lol', ['league duo pls'])).toBe(true);
    expect(gameNamed('lol', ['lol coach'])).toBe(true);
    expect(gameNamed('cs2', ['who plays CS2 now'])).toBe(true);
    expect(gameNamed('lol', ['how do I book a coach?'])).toBe(false);
    expect(gameNamed('ow', ['how do I book a coach?'])).toBe(false);
  });

  it('drops a ticket for a game they never named and asks instead', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() =>
        ok({
          output: [
            fnCall('offer_booking', { ...base, game: 'lol', goal: 'coaching' }),
          ],
        }),
      )
      .mockImplementationOnce(() =>
        ok(final('Which game would you like coaching for?')),
      );
    const answer = await answerWithAi({
      person: guest,
      question: 'how do I book a coach?',
      apiKey: 'test',
      fetcher,
    });
    expect(answer.booking).toBeUndefined();
    const second = JSON.parse(String(fetcher.mock.calls[1]![1].body));
    expect(JSON.stringify(second.input)).toContain('needs');
  });
});
