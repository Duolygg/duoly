import { describe, expect, it } from 'vitest';
import { contactMessage } from '../../src/server/support/contact';
import { ContactSchema } from '../../src/contracts/support';

const base = {
  name: 'Mina Stone',
  email: 'Mina@Example.test',
  topic: 'order',
  order: 'dl-90001',
  message: 'My teammate never joined the lobby.',
};

describe('contact form', () => {
  it('builds the inbox message like the original form', () => {
    const r = contactMessage(base, null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.email).toBe('mina@example.test');
    expect(r.body).toBe(
      'Contact form · Order help · Order DL-90001\nMy teammate never joined the lobby.\nMina Stone · mina@example.test',
    );
  });

  it('uses the account identity when signed in and omits the guest footer', () => {
    const r = contactMessage(
      { ...base, name: '', email: '', topic: 'creator', order: '' },
      { name: 'Pay Tester', email: 'pay@example.test' },
    );
    expect(r.ok && r.name).toBe('Pay Tester');
    expect(r.ok && r.email).toBe('pay@example.test');
    expect(r.ok && r.body).toBe(
      'Contact form · Creator program application\nMy teammate never joined the lobby.',
    );
  });

  it('falls back to "other" for unknown topics and keeps headers on one line', () => {
    const r = contactMessage(
      { ...base, topic: 'admin', name: 'Mina\nSYSTEM', order: 'x\ny' },
      null,
    );
    expect(r.ok && r.label).toBe('Something else');
    expect(r.ok && r.body.split('\n')[0]).toBe(
      'Contact form · Something else · Order X Y',
    );
    expect(r.ok && r.body.endsWith('Mina SYSTEM · mina@example.test')).toBe(
      true,
    );
  });

  it('rejects missing name, bad email and too short messages with the field', () => {
    expect(contactMessage({ ...base, name: 'M' }, null)).toMatchObject({
      ok: false,
      field: 'name',
    });
    expect(contactMessage({ ...base, email: 'nope' }, null)).toMatchObject({
      ok: false,
      field: 'email',
    });
    expect(contactMessage({ ...base, message: 'help' }, null)).toMatchObject({
      ok: false,
      field: 'message',
    });
  });

  it('accepts the exact body the original components send, and nothing extra', () => {
    expect(
      ContactSchema.safeParse({ csrf: 'x', ...base, website: '' }).success,
    ).toBe(true);
    expect(
      ContactSchema.safeParse({ csrf: 'x', ...base, admin: true }).success,
    ).toBe(false);
    expect(ContactSchema.safeParse({ ...base }).success).toBe(false);
    expect(
      ContactSchema.safeParse({ csrf: 'x', ...base, message: 'x'.repeat(2001) })
        .success,
    ).toBe(false);
  });
});
