import { z } from 'zod';

/** What pro_my_status() returns (migration 20261026120000_pro_subscription.sql). */
export const ProStatusRowSchema = z.object({
  member: z.boolean(),
  // PRO comes free with Diamond (20261106160000); absent before that migration
  included: z.boolean().default(false),
  trial_eligible: z.boolean(),
  has_customer: z.boolean(),
  subscription: z
    .object({
      status: z.enum([
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused',
      ]),
      trial_end: z.string().nullable(),
      current_period_end: z.string().nullable(),
      cancel_at_period_end: z.boolean(),
      grace_until: z.string().nullable(),
    })
    .nullable(),
});

/** The browser view of a customer's PRO state. null everywhere while PRO_ENABLED is off. */
export interface ProView {
  member: boolean;
  /** PRO comes free with the Diamond level (it may also still have a paid subscription). */
  included: boolean;
  trialEligible: boolean;
  status: string | null;
  trialEnd: number | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  graceUntil: number | null;
  /** A subscription exists that needs the Customer Portal (failed payment, cancelled trial). */
  manage: boolean;
}

const ms = (iso: string | null) => (iso ? Date.parse(iso) : null);

export function toProView(raw: unknown): ProView | null {
  const parsed = ProStatusRowSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { member, included, trial_eligible, subscription } = parsed.data;
  const status = subscription?.status ?? null;
  // Free with Diamond and nothing paid: there is no subscription to manage.
  const paid = !included || status === 'trialing' || status === 'active';
  return {
    member,
    included,
    trialEligible: trial_eligible,
    status,
    trialEnd: ms(subscription?.trial_end ?? null),
    periodEnd: ms(subscription?.current_period_end ?? null),
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    graceUntil: ms(subscription?.grace_until ?? null),
    manage:
      (member && paid) ||
      status === 'past_due' ||
      status === 'unpaid' ||
      status === 'incomplete' ||
      status === 'paused',
  };
}

/** Signed-out visitors and customers before the first lookup see the offer. */
export const PRO_OFFER: ProView = {
  member: false,
  included: false,
  trialEligible: true,
  status: null,
  trialEnd: null,
  periodEnd: null,
  cancelAtPeriodEnd: false,
  graceUntil: null,
  manage: false,
};

const proDate = (value: number | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : '';

/** The monthly price: €9.99, or $9.99 for a customer who uses USD (charged in euros). */
export function proPrice(cur: 'EUR' | 'USD' = 'EUR'): string {
  return cur === 'USD' ? '$9.99' : '€9.99';
}

/** One line under the dashboard PRO heading for members and memberships that need the portal. */
export function proStatusLine(
  pro: ProView | null | undefined,
  price = '€9.99',
): string {
  if (!pro) return '';
  if (pro.included)
    return pro.manage && !pro.cancelAtPeriodEnd
      ? 'PRO is free with Diamond now. Cancel your paid PRO in Manage PRO so you’re not charged again.'
      : 'Free with your Diamond level, for as long as you stay Diamond.';
  if (pro.status === 'past_due')
    return pro.member && pro.graceUntil
      ? `Your last payment failed. PRO stays on until ${proDate(pro.graceUntil)}. Update your card to keep it.`
      : 'Your last payment failed. Update your card to switch PRO back on.';
  if (!pro.member)
    return pro.status === 'paused'
      ? `Your free trial has ended. Add a card in Manage PRO to switch PRO back on (${price}/month).`
      : pro.manage
        ? 'Update your card to switch PRO back on.'
        : '';
  if (pro.cancelAtPeriodEnd)
    return `PRO ends on ${proDate(pro.periodEnd ?? pro.trialEnd)}.`;
  if (pro.status === 'trialing')
    return `Free trial until ${proDate(pro.trialEnd)}. To keep PRO after that, add a card in Manage PRO: ${price}/month, cancel anytime.`;
  return pro.periodEnd ? `Renews on ${proDate(pro.periodEnd)}.` : '';
}
