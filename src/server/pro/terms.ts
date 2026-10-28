/**
 * Terms of Service with the Duoly PRO section (ledger #39, MONEY-RULES 8.4). Used only while
 * PRO_ENABLED is on; Fabian's original text stays the source otherwise. Draft wording for the
 * owner's lawyer to review before PRO goes live (docs/product/pro.md, open points).
 */
type Block = string | { note?: string; list?: string[] };
interface Section {
  id: string;
  title: string;
  blocks: Block[];
}
interface Terms {
  sections: Section[];
  [key: string]: unknown;
}

const OLD_NOTE_TAIL = 'There is no charge after each game, no subscription and nothing hidden.';
const NEW_NOTE_TAIL =
  'There is no charge after each game and nothing hidden. Booking never needs a subscription: Duoly PRO is optional (see Duoly PRO below).';

export const PRO_TERMS_SECTION: Section = {
  id: 'pro',
  title: 'Duoly PRO',
  blocks: [
    'Duoly PRO is an optional monthly membership for €4.99 a month. You can always book without it.',
    {
      list: [
        '**10% off every order.** Taken off the price after bundle discounts and before your Duoly balance is used. It doesn’t combine with the creator link discount: if both apply, you get one 10% discount.',
        '**Free re-rolls.** No limit of two re-rolls per order. Re-rolls still only work in the first 5 minutes after a teammate accepts.',
        '**Priority matching** for PRO members is coming soon.',
        '**Free trial.** New members get the first 7 days free, once per account and once per card. Unless you cancel before the trial ends, PRO renews at €4.99 a month.',
        '**Cancel anytime** with Manage PRO on your dashboard. PRO stays on until the end of the period you already paid for and doesn’t renew after that.',
        '**Failed payment.** If a renewal payment fails, your PRO perks stay on for 3 days while you update your card. After that they pause until the payment goes through.',
        '**Withdrawal.** You can withdraw from the membership within 14 days of signing up by writing to hello@duoly.gg.',
        'The membership fee doesn’t earn cashback and doesn’t count towards your level.',
      ],
    },
  ],
};

export function termsWithPro<T extends Terms>(terms: T): T {
  const sections = terms.sections.map((section) =>
    section.id === 'payment'
      ? {
          ...section,
          blocks: section.blocks.map((block) =>
            typeof block === 'object' && block.note
              ? { ...block, note: block.note.replace(OLD_NOTE_TAIL, NEW_NOTE_TAIL) }
              : block,
          ),
        }
      : section,
  );
  const at = sections.findIndex((section) => section.id === 'payment');
  sections.splice(at < 0 ? sections.length : at + 1, 0, PRO_TERMS_SECTION);
  return { ...terms, sections };
}
