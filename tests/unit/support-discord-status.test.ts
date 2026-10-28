import { describe, expect, it } from 'vitest';
import { supportDiscordStatus } from '../../src/server/support/admin-handlers';

describe('supportDiscordStatus', () => {
  it('marks the first claim or reply', () => {
    expect(supportDiscordStatus('claim', 'Mina', false)).toBe(
      '✅ **Mina** is on it',
    );
    expect(supportDiscordStatus('reply', 'Mina', false)).toBe(
      '✅ **Mina** is on it',
    );
    expect(supportDiscordStatus('reply', 'Mina', true)).toBeNull();
  });
  it('marks close and hand back', () => {
    expect(supportDiscordStatus('close', 'Mina', true)).toBe(
      '✔️ Closed by **Mina**',
    );
    expect(supportDiscordStatus('bot', 'Mina', true)).toBe(
      '↩️ **Mina** handed it back to Sparky',
    );
    expect(supportDiscordStatus('seen', 'Mina', true)).toBeNull();
  });
});
