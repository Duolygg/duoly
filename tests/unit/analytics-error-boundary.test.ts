import { afterEach, expect, test, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AnalyticsErrorBoundary from '../../src/components/shared/AnalyticsErrorBoundary';
import { ERROR_EVENT } from '../../src/client/analytics/track';

afterEach(() => vi.unstubAllGlobals());

test('healthy children render without extra markup', () => {
  expect(
    renderToStaticMarkup(
      createElement(
        AnalyticsErrorBoundary,
        { source: 'home' },
        createElement('span', null, 'Healthy'),
      ),
    ),
  ).toBe('<span>Healthy</span>');
});

test('a caught error reports its source once and renders nothing by default', () => {
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  const error = new Error('render failed');
  const boundary = new AnalyticsErrorBoundary({
    source: 'queue-room',
    children: 'child',
  });
  boundary.state = AnalyticsErrorBoundary.getDerivedStateFromError();
  expect(() => boundary.componentDidCatch(error)).not.toThrow();
  expect(boundary.render()).toBeNull();
  expect(dispatchEvent).toHaveBeenCalledTimes(1);
  const event = dispatchEvent.mock.calls[0]![0] as CustomEvent;
  expect(event.type).toBe(ERROR_EVENT);
  expect(event.detail).toEqual({ error, source: 'queue-room' });
});

test('a supplied fallback is used only after an error', () => {
  const boundary = new AnalyticsErrorBoundary({
    source: 'checkout',
    children: 'child',
    fallback: 'fallback',
  });
  expect(boundary.render()).toBe('child');
  boundary.state = AnalyticsErrorBoundary.getDerivedStateFromError();
  expect(boundary.render()).toBe('fallback');
});
