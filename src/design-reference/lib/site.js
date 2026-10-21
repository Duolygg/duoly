// Who runs Duoly and how to reach us. Used by the Terms, Privacy and Contact pages (and their legal notice).
// TODO before launch: fill in the legal company name, registered address and register number. An
// Austrian website needs these in its legal notice (Impressum, § 5 ECG / § 25 MedienG). Empty fields
// are left out of the pages; nothing here is made up.
export const SITE = {
  name: 'Duoly',
  domain: 'duoly.gg',
  company: '',          // e.g. 'Duoly e.U.' or 'Duoly GmbH'
  owner: '',            // person responsible (for a sole trader / e.U.)
  address: '',          // street, postcode, Vienna, Austria
  register: '',         // e.g. 'FN 123456a, Handelsgericht Wien' (if registered)
  vat: '',              // e.g. 'ATU12345678'
  city: 'Vienna, Austria',
  supportEmail: '',     // e.g. 'support@duoly.gg' once that mailbox exists; until then the pages point to the contact form
  privacyEmail: '',     // e.g. 'privacy@duoly.gg'; falls back to supportEmail, then the contact form
  discordInvite: '',    // e.g. 'https://discord.gg/xxxx'; the Discord card shows only when set
  replyTime: 'usually within a few minutes while the team is online, and within 24 hours otherwise'
};

// The legal pages' "last updated" date (change it whenever the Terms or Privacy text changes).
export const LEGAL_UPDATED = '18 October 2026';
