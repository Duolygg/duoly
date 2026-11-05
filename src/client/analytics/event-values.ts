/** Structured Stripe error.type/error.code only. Never pass an error message. */
export function analyticsErrorSlug(value: unknown): string {
  if (typeof value !== 'string') return 'unknown';
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'unknown'
  );
}
