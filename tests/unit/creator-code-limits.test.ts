import { describe, expect, it } from 'vitest';
import { allowCreatorCheck } from '../../src/server/creators/handlers';
import { catalogueProps } from '../../src/contracts/analytics-events';

describe('creator code limits and analytics privacy', () => {
  it('allows twelve checks per account per minute and then resets', () => {
    for (let i = 0; i < 12; i++)
      expect(allowCreatorCheck('rate-fixture', 1000)).toBe(true);
    expect(allowCreatorCheck('rate-fixture', 1001)).toBe(false);
    expect(allowCreatorCheck('other-fixture', 1001)).toBe(true);
    expect(allowCreatorCheck('rate-fixture', 61000)).toBe(true);
  });
  it('catalogues only source and validity, dropping code and creator identifiers', () => {
    expect(
      catalogueProps('creator_code_applied', {
        source: 'typed',
        valid: true,
        code: 'ALPHA',
        displayName: 'Alpha',
        customer: 'uuid',
      }),
    ).toEqual({ source: 'typed', valid: true });
    expect(
      catalogueProps('creator_code_applied', { source: 'ALPHA', valid: 'yes' }),
    ).toEqual({});
  });
});
