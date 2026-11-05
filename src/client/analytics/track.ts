/**
 * The only API islands use to report product events and handled errors. It never imports
 * the SDK: it dispatches a window event that the analytics boot script (if loaded, on an
 * allowed page, after a consent choice) turns into a capture. Without analytics it does
 * nothing, so it is always safe to call.
 */
import type { EventName, EventProps } from '../../contracts/analytics-events';

export const TRACK_EVENT = 'duoly:track';
export const ERROR_EVENT = 'duoly:error';

export type TrackDetail = { name: string; props?: Record<string, unknown> };
export type ErrorDetail = { error: unknown; source: string };

export function track<E extends EventName>(
  name: E,
  props?: EventProps<E>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent<TrackDetail>(TRACK_EVENT, {
        detail: { name, props: props as Record<string, unknown> },
      }),
    );
  } catch {
    // Analytics must never break the page.
  }
}

/** Report a caught error (error boundaries, failed payment confirms). source: slug. */
export function reportError(error: unknown, source: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent<ErrorDetail>(ERROR_EVENT, { detail: { error, source } }),
    );
  } catch {
    // Analytics must never break the page.
  }
}
