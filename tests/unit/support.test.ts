import { describe, expect, it, vi } from 'vitest';
import {
  CHIPS,
  buildGroundingContext,
  preparedReply,
  preparedAnswers,
  type SupportPerson,
} from '../../src/server/support/sparky';
import { answerWithAi, parseAiResponse } from '../../src/server/support/ai';
import { canSendMessage, dailyAiLimit } from '../../src/server/support/limits';

const guest: SupportPerson = { role: 'guest', name: 'Guest' };
const customer: SupportPerson = {
  role: 'customer',
  userId: 'customer-1',
  name: 'Mina Stone',
  email: 'mina@example.test',
  customer: {
    currentOrder: {
      id: 'order-mine',
      reference: 'DL-90001',
      title: 'Ranked Duo',
      game: 'Valorant',
      units: 3,
      status: 'queued',
      amountEurCents: 1299,
      queuedAt: '2026-10-23T18:00:00.000Z',
      teammateName: null,
      rerollUntil: null,
    },
    recentOrders: [
      {
        id: 'order-old',
        reference: 'DL-89990',
        title: 'Duo',
        game: 'League of Legends',
        units: 1,
        status: 'completed',
        amountEurCents: 499,
        queuedAt: '2026-10-20T18:00:00.000Z',
        teammateName: 'Ada',
        rerollUntil: null,
      },
    ],
  },
};
const teammate: SupportPerson = {
  role: 'teammate',
  userId: 'mate-1',
  name: 'Kai Player',
  email: 'kai@example.test',
  teammate: {
    assignment: {
      orderId: 'assignment-order',
      reference: 'DL-90002',
      title: 'Coaching',
      game: 'Valorant',
      units: 1,
      customerName: 'Customer One',
      acceptedAt: '2026-10-23T18:05:00.000Z',
    },
    completedOrders: 7,
    recordedEarningsUsdCents: 4200,
    approvedGames: ['Valorant'],
    discordConnected: true,
    suspended: false,
  },
};

describe('Sparky prepared replies', () => {
  it('keeps Fabian’s chips per audience', () => {
    expect(CHIPS.guest).toEqual([
      'How does Duoly work?',
      'How much does it cost?',
      'Is my account safe?',
      'Talk to a human',
    ]);
    expect(CHIPS.customer).toContain('Where’s my teammate?');
    expect(CHIPS.teammate).toContain('When do I get paid?');
  });

  it('renders chip answers with only the person’s fixture data', () => {
    const customerAnswer = preparedReply(customer, 'Where’s my teammate?');
    expect(customerAnswer.text).toContain('DL-90001');
    expect(customerAnswer.text).toContain('Ranked Duo');
    expect(customerAnswer.text).not.toContain('assignment-order');

    const teammateAnswer = preparedReply(
      teammate,
      'Why am I not getting orders?',
    );
    expect(teammateAnswer.text).toContain('Valorant');
    expect(teammateAnswer.text).not.toContain('DL-90001');

    expect(preparedReply(guest, 'How does Duoly work?').text).toContain(
      'choose your game',
    );
  });

  it('uses current payment facts and does not promise unfinished features', () => {
    const refund = preparedReply(customer, 'Cancel or refund').text;
    expect(refund).toContain('nothing is charged');
    expect(refund).toContain('hold is released');
    expect(refund).not.toMatch(/wallet|balance/i);

    const teammateAnswers = preparedAnswers(teammate).join('\n');
    expect(teammateAnswers).toMatch(/recorded earnings/i);
    expect(teammateAnswers).toMatch(/coming/i);
    expect(teammateAnswers).not.toMatch(/paid every Friday|weekly payout/i);
  });
});

describe('grounding context', () => {
  it('contains the asker’s data and excludes another person’s data', () => {
    const context = buildGroundingContext(customer);
    expect(context).toContain('order-mine');
    expect(context).toContain('DL-90001');
    expect(context).not.toContain('assignment-order');
    expect(context).not.toContain('kai@example.test');
  });

  it('contains prepared answers, FAQ and authoritative product facts', () => {
    const context = buildGroundingContext(guest);
    expect(context).toContain('PREPARED ANSWERS');
    expect(context).toContain('FAQ');
    expect(context).toContain('AUTHORITATIVE CURRENT FACTS');
  });
});

describe('AI response handling', () => {
  it('parses the required JSON response and rejects loose text', () => {
    expect(parseAiResponse('{"reply":"Short answer","handoff":false}')).toEqual(
      {
        reply: 'Short answer',
        handoff: false,
      },
    );
    expect(parseAiResponse('Sure, here you go')).toBeNull();
    expect(parseAiResponse('{"reply":"","handoff":false}')).toBeNull();
  });

  it('falls back to Fabian’s router and offers a human on AI failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    const answer = await answerWithAi({
      person: guest,
      question: 'How does Duoly work?',
      apiKey: 'test-key',
      fetcher,
    });
    expect(answer.source).toBe('fallback');
    expect(answer.reply).toContain('choose your game');
    expect(answer.chips).toContain('Talk to a human');
  });

  it('treats malformed model output as a fallback', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ output_text: 'not json' }), {
        status: 200,
      }),
    );
    const answer = await answerWithAi({
      person: guest,
      question: 'What is this?',
      apiKey: 'test-key',
      fetcher,
    });
    expect(answer.source).toBe('fallback');
    expect(answer.chips).toEqual(['Talk to a human']);
  });
});

describe('support limits', () => {
  it('limits a conversation to 12 user messages per minute', () => {
    const now = Date.parse('2026-10-23T18:00:00Z');
    const recent = Array.from({ length: 12 }, (_, index) => now - index * 1000);
    expect(canSendMessage(recent, now)).toBe(false);
    expect(canSendMessage(recent.slice(0, 11), now)).toBe(true);
    expect(canSendMessage([now - 61_000, ...recent.slice(0, 11)], now)).toBe(
      true,
    );
  });

  it('uses a safe configurable daily AI cap', () => {
    expect(dailyAiLimit(undefined)).toBe(500);
    expect(dailyAiLimit('25')).toBe(25);
    expect(dailyAiLimit('0')).toBe(500);
    expect(dailyAiLimit('999999')).toBe(10_000);
  });
});
