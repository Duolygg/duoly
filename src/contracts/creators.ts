import { z } from 'zod';
import { CREATOR } from '../design-reference/lib/creators.js';

/**
 * Creator program rules, shared by the server, the admin screens and the
 * public /creators page. The numbers are the original lib/creators.js
 * (duoly-admin/duoly@7f0299f); migration 20261025110000 repeats them in SQL
 * and tests/unit/creator-referrals.test.ts keeps both in sync.
 */
export interface CreatorTier {
  id: 'rising' | 'partner' | 'elite';
  name: string;
  from: number;
  commission: number;
}
const source = CREATOR as {
  viewerDiscount: number;
  attributionMonths: number;
  payoutMin: number;
  tiers: CreatorTier[];
};
export const CREATOR_RULES = {
  attributionMonths: source.attributionMonths,
  payoutMinEur: source.payoutMin,
  viewerDiscountPercent: source.viewerDiscount,
  tiers: source.tiers.map(({ id, name, from, commission }) => ({
    id,
    name,
    from,
    commission,
  })),
} as const;

/** How long the referral cookie from a ?ref= link lasts (owner decision pending, see docs). */
export const REF_COOKIE_DAYS = 30;

/** Creator codes: 3 to 20 letters or numbers, stored upper case (original example YOURNAME10). */
export const REF_CODE = /^[A-Z0-9]{3,20}$/;
export function normalizeRefCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const code = raw.trim().toUpperCase();
  return REF_CODE.test(code) ? code : null;
}

const csrf = z.string().min(1).max(128);

/** Body of POST /api/admin/creators: one command per request. */
export const AdminCreatorCommandSchema = z.discriminatedUnion('action', [
  z
    .object({
      csrf,
      action: z.literal('create'),
      code: z.string().trim().min(3).max(20),
      name: z.string().trim().min(2).max(60),
      channel: z.string().trim().max(160).optional(),
    })
    .strict(),
  z
    .object({
      csrf,
      action: z.literal('setActive'),
      creatorId: z.uuid(),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      csrf,
      action: z.literal('pay'),
      creatorId: z.uuid(),
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      method: z.enum(['bank', 'wise', 'paypal', 'other']),
      reference: z.string().trim().min(1).max(120),
    })
    .strict(),
]);
export type AdminCreatorCommand = z.infer<typeof AdminCreatorCommandSchema>;
