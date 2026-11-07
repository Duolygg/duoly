import { randomBytes, createHash } from 'node:crypto';

// 32 bytes have 43 base64url characters; the final two bits must be zero.
const TOKEN = /^dos_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export function validStatusToken(token: string): boolean {
  return token.length === 47 && TOKEN.test(token);
}
export function createStatusToken(): string {
  return 'dos_' + randomBytes(32).toString('base64url');
}
export async function statusTokenHash(token: string): Promise<string> {
  if (!validStatusToken(token)) throw new Error('Invalid status code');
  return createHash('sha256').update(token).digest('hex');
}
