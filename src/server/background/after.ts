/**
 * "Do this after the response has gone out."
 *
 * On Vercel the function stays alive for the work through the platform's request context, which is
 * what `@vercel/functions`' `waitUntil` reads. Everywhere else (local dev, vitest, `astro dev`)
 * there is no context, so the work is awaited instead, which keeps the behaviour identical and the
 * tests deterministic.
 *
 * Read through the symbol rather than importing `@vercel/functions`, exactly like
 * `src/server/discord/role-hooks.ts` does: that import throws when there is no request context, and
 * a background hook may never change the answer a customer or a teammate gets.
 *
 * `waitUntil` is an optimization, never the registration boundary (oai-review F3, F18): everything
 * started here is either idempotent or has a durable backstop in `public.background_overdue()`.
 */
const vercelWaitUntil = (): ((promise: Promise<unknown>) => void) | null => {
  try {
    const context = (
      globalThis as {
        [key: symbol]:
          | { get?: () => { waitUntil?: (p: Promise<unknown>) => void } }
          | undefined;
      }
    )[Symbol.for('@vercel/request-context')];
    const waitUntil = context?.get?.()?.waitUntil;
    return typeof waitUntil === 'function' ? waitUntil : null;
  } catch {
    return null;
  }
};

/**
 * Runs `work` after the response. Never throws and never rejects: a hook that fails is a log line,
 * because the hourly fixer finds the same work from source state.
 */
export async function afterResponse(
  work: () => Promise<unknown>,
  log: (line: string) => void = (line) => console.warn(line),
): Promise<void> {
  const guarded = (async () => {
    try {
      await work();
    } catch (error) {
      log(
        `[background] a hook failed: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}`,
      );
    }
  })();
  const waitUntil = vercelWaitUntil();
  if (waitUntil) {
    waitUntil(guarded);
    return;
  }
  await guarded;
}
