import { expect, it } from 'vitest';
import { analyticsErrorSlug } from '../../src/client/analytics/event-values';

it('bounds structured provider error codes without using messages', () => {
  expect(analyticsErrorSlug('Card_Error')).toBe('card_error');
  expect(analyticsErrorSlug(undefined)).toBe('unknown');
  expect(analyticsErrorSlug('a'.repeat(80))).toHaveLength(40);
  expect(analyticsErrorSlug('???')).toBe('unknown');
});
