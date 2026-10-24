const TOKEN = /^[A-Za-z0-9_-]{24}$/;

export function validHandoverToken(token: string): boolean {
  return TOKEN.test(token);
}

export async function handoverTokenHash(token: string): Promise<string> {
  if (!validHandoverToken(token)) throw new Error('invalid handover token');
  const bytes = new TextEncoder().encode(token);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function handoverUrl(origin: string, token: string): string {
  if (!validHandoverToken(token)) throw new Error('invalid handover token');
  return new URL(`/claim/${encodeURIComponent(token)}`, origin).toString();
}
