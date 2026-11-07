import { describe, expect, it } from 'vitest';
import {
  createStatusToken,
  validStatusToken,
  statusTokenHash,
} from '../../src/server/orders/status-token';

describe('per-order AI capabilities', () => {
  it('generates independent 256-bit canonical base64url secrets', () => {
    const tokens = Array.from({ length: 100 }, createStatusToken);
    expect(new Set(tokens).size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^dos_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
      expect(validStatusToken(token)).toBe(true);
      expect(Buffer.from(token.slice(4), 'base64url')).toHaveLength(32);
    }
  });
  it('rejects malformed and noncanonical tokens before hashing', async () => {
    for (const token of [
      '',
      'DL-1042',
      'dos_' + 'a'.repeat(43),
      'dos_' + 'A'.repeat(42),
      'dos_' + 'A'.repeat(44),
      'dos_' + 'A'.repeat(42) + '/',
      'dos_' + 'A'.repeat(43) + '\n',
    ]) {
      expect(validStatusToken(token)).toBe(false);
      await expect(statusTokenHash(token)).rejects.toThrow(
        'Invalid status code',
      );
    }
  });
  it('hashes the entire token deterministically without retaining plaintext', async () => {
    const token = 'dos_' + 'A'.repeat(43);
    const { createHash } = await import('node:crypto');
    expect(await statusTokenHash(token)).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(await statusTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});
