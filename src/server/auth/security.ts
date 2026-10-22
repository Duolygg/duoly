import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { EmailSchema } from '../../contracts/account';

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function createCsrf(): string {
  return randomBytes(32).toString('hex');
}
export function verifyCsrf(
  request: Request,
  origin: string,
  cookie: string | undefined,
  token: unknown,
): boolean {
  return (
    request.method === 'POST' &&
    new URL(request.url).origin === origin &&
    request.headers.get('origin') === origin &&
    typeof cookie === 'string' &&
    /^[a-f0-9]{64}$/.test(cookie) &&
    typeof token === 'string' &&
    equal(cookie, token)
  );
}
function sign(payload: string, key: string): string {
  if (key.length < 32) throw new Error('Auth signing key is not configured.');
  return createHmac('sha256', key).update(payload).digest('base64url');
}
export function sealPendingEmail(
  email: string,
  csrf: string,
  key: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      email: EmailSchema.parse(email),
      csrf,
      expires: now + 600_000,
    }),
  ).toString('base64url');
  return payload + '.' + sign(payload, key);
}
export function readPendingEmail(
  value: string | undefined,
  csrf: string,
  key: string,
  now = Date.now(),
): string | undefined {
  try {
    if (!value || value.length > 2048) return;
    const parts = value.split('.');
    if (
      parts.length !== 2 ||
      !parts[0] ||
      !parts[1] ||
      !equal(sign(parts[0], key), parts[1])
    )
      return;
    const data: unknown = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString(),
    );
    if (
      !data ||
      typeof data !== 'object' ||
      !('csrf' in data) ||
      data.csrf !== csrf ||
      !('expires' in data) ||
      typeof data.expires !== 'number' ||
      data.expires <= now ||
      data.expires > now + 600_000 ||
      !('email' in data)
    )
      return;
    return EmailSchema.parse(data.email);
  } catch {
    return;
  }
}
export async function readBoundedBody(
  request: Request,
  maxBytes = 4096,
): Promise<Record<string, unknown>> {
  const kind = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (
    !['application/json', 'application/x-www-form-urlencoded'].includes(
      kind ?? '',
    ) ||
    !request.body
  )
    throw new Error('Unsupported request.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Request too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (kind === 'application/json') {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid object.');
    return value as Record<string, unknown>;
  }
  const result: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const [key, value] of new URLSearchParams(text)) {
    if (Object.hasOwn(result, key)) throw new Error('Duplicate field.');
    result[key] = value;
  }
  return result;
}
