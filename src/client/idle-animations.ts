/*
 * Pauses looping decorative animations while they are off screen.
 *
 * The homepage runs a lot of endless CSS animations: the recent-matches ticker, the teammate
 * carousel, the two payment-badge rows, the review strip, the pulsing "online" dots. Every one
 * of them keeps the renderer in a frame loop for the whole life of the page, and a frame is not
 * cheap on a mid-range phone: a trace of duoly.gg taken at the PageSpeed CPU speed showed a
 * steady 8 to 15 ms of style recalculation, paint, pre-paint and lazy-image intersection work
 * every 60 ms, from first paint until well past the point the page was interactive. Multiplied
 * by the throttling that is roughly 700 ms of total blocking time spent animating strips of
 * content six screens below the fold.
 *
 * An animation nobody can see looks the same whether it runs or not, so this pauses it and
 * resumes it when it comes near the viewport. It works off `document.getAnimations()` rather
 * than a list of selectors, so it covers animations declared in the design stylesheet and ones
 * set inline in the homepage JSX alike, and it only ever touches animations that repeat for
 * ever: one-shot entrances, spinners inside a pending button and the hero's drifting quotes are
 * left alone. Pausing holds an animation's current time, so a strip that comes back into view
 * carries on from where it stopped instead of jumping.
 */

/** Resume this far outside the viewport, so nothing is ever caught standing still. */
const MARGIN = '300px 0px';
/** A rescan is cheap, but not free; at most one per this many ms. */
const RESCAN_MS = 1500;

type Managed = { animations: Set<Animation>; visible: boolean };

export function startIdleAnimations(): () => void {
  if (
    typeof document === 'undefined' ||
    typeof IntersectionObserver === 'undefined' ||
    typeof document.getAnimations !== 'function'
  )
    return () => {};

  const byElement = new Map<Element, Managed>();
  const seen = new WeakSet<Animation>();

  const apply = (animation: Animation, managed: Managed) => {
    try {
      if (managed.visible) {
        if (animation.playState === 'paused') animation.play();
      } else if (animation.playState === 'running') animation.pause();
    } catch {
      /* A finished or cancelled animation refuses both; nothing to do. */
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const managed = byElement.get(entry.target);
        if (!managed) continue;
        managed.visible = entry.isIntersecting;
        for (const animation of managed.animations) apply(animation, managed);
      }
    },
    { rootMargin: MARGIN },
  );

  const scan = () => {
    for (const animation of document.getAnimations()) {
      if (seen.has(animation)) continue;
      seen.add(animation);
      const effect = animation.effect;
      // Only endless ones. getComputedTiming().iterations is Infinity for `infinite`.
      if (!(effect instanceof KeyframeEffect) || !effect.target) continue;
      if (effect.getComputedTiming().iterations !== Infinity) continue;
      const target = effect.target;
      let managed = byElement.get(target);
      if (!managed) {
        // Assume visible until the observer says otherwise, so nothing is paused by mistake.
        managed = { animations: new Set(), visible: true };
        byElement.set(target, managed);
        observer.observe(target);
      }
      managed.animations.add(animation);
      apply(animation, managed);
    }
    // Drop animations the page has replaced, so the sets do not grow with every re-render.
    for (const [target, managed] of byElement) {
      for (const animation of managed.animations)
        if (
          animation.playState === 'idle' ||
          animation.playState === 'finished'
        )
          managed.animations.delete(animation);
      if (!managed.animations.size) {
        observer.unobserve(target);
        byElement.delete(target);
      }
    }
  };

  // Re-scan after anything that can mount new animated markup, at most once per RESCAN_MS.
  let last = 0;
  let queued = 0;
  const rescan = () => {
    if (queued) return;
    const wait = Math.max(0, last + RESCAN_MS - Date.now());
    queued = window.setTimeout(() => {
      queued = 0;
      last = Date.now();
      scan();
    }, wait);
  };
  const events = ['scroll', 'pointerdown', 'keydown'] as const;
  const options = { passive: true, capture: true } as const;

  const begin = () => {
    last = Date.now();
    scan();
    for (const name of events) window.addEventListener(name, rescan, options);
  };
  // Hydration first: starting this during it would only make the long tasks it is meant to
  // shorten longer.
  const idle =
    typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(begin, { timeout: 1500 })
      : window.setTimeout(begin, 400);

  return () => {
    if (typeof window.cancelIdleCallback === 'function')
      window.cancelIdleCallback(idle);
    window.clearTimeout(idle);
    window.clearTimeout(queued);
    for (const name of events)
      window.removeEventListener(name, rescan, options);
    observer.disconnect();
    for (const managed of byElement.values()) {
      managed.visible = true;
      for (const animation of managed.animations) apply(animation, managed);
    }
    byElement.clear();
  };
}
