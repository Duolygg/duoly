import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  capture: vi.fn(),
  flush: vi.fn(async () => {}),
}));
vi.mock('posthog-node', () => ({
  PostHog: class {
    capture = fake.capture;
    flush = fake.flush;
    on() {}
  },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));
import { answerWithAi } from '../../src/server/support/ai';
import type { SupportPerson } from '../../src/server/support/sparky';
const person: SupportPerson = {
  role: 'guest',
  name: 'PRIVATE NAME',
  userId: 'PRIVATE USER',
};
const conversationId = '019a1234-1234-7123-8123-123456789abc';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PUBLIC_ANALYTICS_ENABLED', 'true');
  vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const finalPayload = {
  output_text: JSON.stringify({ reply: 'PRIVATE ANSWER', handoff: false }),
  usage: { input_tokens: 23, output_tokens: 5 },
};
it.each([true, false, null])(
  'records real model calls and tools without content (consent %s)',
  async (consent) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          output: [
            {
              type: 'function_call',
              call_id: 'call-1',
              name: 'faq_search',
              arguments: JSON.stringify({ query: 'PRIVATE QUESTION' }),
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json(finalPayload));
    const answer = await answerWithAi({
      person,
      question: 'PRIVATE QUESTION',
      apiKey: 'test',
      fetcher,
      telemetry: {
        consent: consent === null ? null : { analytics: consent },
        conversationId,
      },
    });
    expect(answer.source).toBe('ai');
    const events = fake.capture.mock.calls.map(([event]) => event);
    expect(events.map((e) => e.event)).toEqual([
      '$ai_generation',
      '$ai_span',
      '$ai_generation',
    ]);
    expect(new Set(events.map((e) => e.properties.$ai_trace_id)).size).toBe(1);
    expect(events[1].properties.$ai_parent_id).toBe(
      events[0].properties.$ai_span_id,
    );
    expect(events[2].properties).toMatchObject({
      $ai_input_tokens: 23,
      $ai_output_tokens: 5,
      $ai_is_error: false,
    });
    expect(events[0].properties).not.toHaveProperty('$ai_input_tokens');
    for (const e of events) {
      expect(e.properties).not.toHaveProperty('$ai_input');
      expect(e.properties).not.toHaveProperty('$ai_tools');
      expect(e.properties).not.toHaveProperty('$ai_output_choices');
      if (!consent) {
        expect(e.distinctId).not.toBe(person.userId);
        expect(e.properties).not.toHaveProperty('$ai_session_id');
        expect(e.properties.$process_person_profile).toBe(false);
      }
    }
    expect(JSON.stringify(events)).not.toContain('PRIVATE QUESTION');
    expect(JSON.stringify(events)).not.toContain('PRIVATE ANSWER');
    if (consent)
      expect(events[0].properties.$ai_session_id).toBe(conversationId);
  },
);
it.each(['network', 'http', 'json'])(
  'records error metrics without invented usage: %s',
  async (failure) => {
    const fetcher = vi.fn();
    if (failure === 'network')
      fetcher.mockRejectedValue(new Error('PRIVATE ERROR'));
    else if (failure === 'http')
      fetcher.mockResolvedValue(new Response('PRIVATE ERROR', { status: 503 }));
    else fetcher.mockResolvedValue(new Response('not json', { status: 200 }));
    const answer = await answerWithAi({
      person,
      question: 'PRIVATE QUESTION',
      apiKey: 'test',
      fetcher,
    });
    expect(answer.source).toBe('fallback');
    expect(fake.capture).toHaveBeenCalledTimes(1);
    const event = fake.capture.mock.calls[0]![0];
    expect(event.properties.$ai_is_error).toBe(true);
    expect(event.properties).not.toHaveProperty('$ai_input_tokens');
    if (failure === 'network')
      expect(event.properties).not.toHaveProperty('$ai_http_status');
    else
      expect(event.properties.$ai_http_status).toBe(
        failure === 'http' ? 503 : 200,
      );
    expect(JSON.stringify(event)).not.toContain('PRIVATE ERROR');
  },
);
it('never sends admin AI telemetry', async () => {
  await answerWithAi({
    person: { ...person, accountRole: 'admin' },
    question: 'PRIVATE ADMIN QUESTION',
    apiKey: 'test',
    fetcher: vi.fn().mockResolvedValue(Response.json(finalPayload)),
  });
  expect(fake.capture).not.toHaveBeenCalled();
});
it('telemetry failure cannot change the answer', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fake.capture.mockImplementationOnce(() => {
    throw new Error('telemetry unavailable');
  });
  const answer = await answerWithAi({
    person,
    question: 'PRIVATE QUESTION',
    apiKey: 'test',
    fetcher: vi.fn().mockResolvedValue(Response.json(finalPayload)),
  });
  expect(answer.reply).toBe('PRIVATE ANSWER');
  expect(answer.source).toBe('ai');
});
import {
  generationProperties,
  sanitizeAiProperties,
} from '../../src/server/analytics/ai';
it('maps only actual usage, seconds and safe AI fields', () => {
  const props = generationProperties({
    traceId: '019a1234-1234-7123-8123-123456789abc',
    latency: 1.5,
    status: 200,
    error: false,
    toolNames: ['faq'],
    payload: {
      usage: {
        input_tokens: 12,
        output_tokens: 4,
        input_tokens_details: { cached_tokens: 3 },
      },
    },
  });
  expect(props).toMatchObject({
    $ai_input_tokens: 12,
    $ai_output_tokens: 4,
    $ai_cache_read_input_tokens: 3,
    $ai_latency: 1.5,
    $ai_http_status: 200,
    $ai_is_error: false,
  });
  const missing = generationProperties({
    traceId: '019a1234-1234-7123-8123-123456789abc',
    latency: 2,
    error: true,
    toolNames: [],
  });
  expect(missing).not.toHaveProperty('$ai_input_tokens');
  expect(missing).not.toHaveProperty('$ai_http_status');
  expect(
    sanitizeAiProperties('$ai_generation', {
      ...props,
      $ai_input: 'secret',
      $ai_tools: ['secret'],
      email: 'private',
    }),
  ).toEqual(props);
});
