import { CREATOR_RULES, normalizeRefCode } from '../../contracts/creators';

/** Undefined preserves the consent-gated link; an explicit empty value removes it. */
export function selectCreatorCode(
  typed: unknown,
  link: string | null,
): string | null {
  return typed === undefined ? link : normalizeRefCode(typed);
}

export interface CreatorCodeResult {
  valid: boolean;
  displayName: string | null;
  discountPercent: number;
  reason: string | null;
}
export type CreatorCodeReader = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  name: (code: string) => Promise<string | null>;
};
const refused = (reason: string): CreatorCodeResult => ({
  valid: false,
  displayName: null,
  discountPercent: 0,
  reason,
});

/** Same eligibility RPC as link checkout. Never writes attribution or exposes private rows. */
export async function checkCreatorCode(
  reader: CreatorCodeReader,
  customer: string,
  raw: unknown,
  excluded = false,
): Promise<CreatorCodeResult> {
  if (excluded)
    return refused('Creator discounts are not available for this booking.');
  const code = normalizeRefCode(raw);
  if (!code) return refused('That creator code is not available.');
  const displayName = await reader.name(code);
  // Unknown and inactive codes deliberately share one answer.
  if (!displayName) return refused('That creator code is not available.');
  const eligible = await reader.rpc('referral_first_order_discount_eligible', {
    p_customer: customer,
    p_code: code,
  });
  if (eligible.error) return refused('Could not check the code. Try again.');
  if (eligible.data !== true)
    return refused(
      'Creator discounts are for your first order only. Another checkout may already use it.',
    );
  return {
    valid: true,
    displayName,
    discountPercent: CREATOR_RULES.viewerDiscountPercent,
    reason: null,
  };
}
