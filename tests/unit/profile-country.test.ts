import { describe, expect, it } from 'vitest';
import { profileCountry } from '../../src/server/teammates/profile-country';

describe('profileCountry', () => {
  it('resolves the lowercase country code stored on live profiles', () => {
    expect(profileCountry('at')).toEqual({ code: 'at', name: 'Austria' });
  });

  it.each(['AT', 'At', ' at ', 'Austria', 'austria'])(
    'resolves supported code or catalog name %s',
    (value) => {
      expect(profileCountry(value)).toEqual({ code: 'at', name: 'Austria' });
    },
  );

  it.each([null, undefined, '', ' ', 'zz', 'Atlantis', '/at', 'AUT'])(
    'omits unknown or absent country %s',
    (value) => {
      expect(profileCountry(value)).toBeNull();
    },
  );

  it.each([
    ['ag', 'Antigua and Barbuda'],
    ['Antigua & Barbuda', 'Antigua and Barbuda'],
    ['ba', 'Bosnia and Herzegovina'],
  ])('uses readable copy for %s', (value, name) => {
    expect(profileCountry(value)?.name).toBe(name);
  });
});
