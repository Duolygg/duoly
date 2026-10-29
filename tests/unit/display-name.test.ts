import { describe, expect, it } from 'vitest';
import { displayName } from '../../src/server/auth/display-name';

const google = {
  provider: 'google',
  identity_data: { full_name: 'Fabian Example', name: 'Fabian Example' },
};
const discord = {
  provider: 'discord',
  identity_data: {
    full_name: 'fabdo',
    custom_claims: { global_name: 'Fabdo' },
  },
};

describe('viewer display name', () => {
  it('keeps a name the user saved', () => {
    expect(displayName('Fabi', [google], 'google')).toBe('Fabi');
  });

  it('uses the sign-in provider name while the profile has the default', () => {
    expect(displayName('Player', [google], 'google')).toBe('Fabian Example');
    expect(displayName('Player', [discord], 'discord')).toBe('Fabdo');
  });

  it('prefers the provider used for this sign-in', () => {
    expect(displayName('Player', [google, discord], 'discord')).toBe('Fabdo');
    expect(displayName('Player', [discord, google], 'google')).toBe(
      'Fabian Example',
    );
  });

  it('falls back to the default without a usable provider name', () => {
    expect(displayName('Player', [], 'email')).toBe('Player');
    expect(displayName('Player')).toBe('Player');
    expect(
      displayName('Player', [
        { provider: 'google', identity_data: { name: ' x ' } },
      ]),
    ).toBe('Player');
  });

  it('tidies whitespace and keeps the profile length limit', () => {
    expect(
      displayName('Player', [
        {
          provider: 'google',
          identity_data: { full_name: '  Fabian \n  B  ' },
        },
      ]),
    ).toBe('Fabian B');
    const long = 'A'.repeat(40);
    expect(
      displayName('Player', [
        { provider: 'google', identity_data: { name: long } },
      ]),
    ).toHaveLength(32);
  });
});
