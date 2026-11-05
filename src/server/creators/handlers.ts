import type { APIRoute } from 'astro';
import { mutation } from '../auth/handlers';
import { adminFor, paymentsConfig } from '../payments/config';
import { checkCreatorCode, type CreatorCodeReader } from './code';
import { CheckoutRequestSchema } from '../payments/checkout';
import { creatorPricePreview } from './preview';
import { eurToUsd } from '../fx';
import { proEnabled } from '../pro/config';
import { isProMember } from '../pro/status';

// Bounded, per-account burst protection, in addition to authenticated CSRF and body limits.
// Like other application limits this is not a replacement for edge abuse protection.
const checks = new Map<string, { at: number; count: number }>();
export function allowCreatorCheck(id: string, now = Date.now()): boolean {
  const previous = checks.get(id);
  if (previous && now - previous.at < 60_000) return ++previous.count <= 12;
  checks.delete(id);
  if (checks.size >= 2000) checks.delete(checks.keys().next().value!);
  checks.set(id, { at: now, count: 1 });
  return true;
}
export const check: APIRoute = async (context) => {
  const { account, body, failure } = await mutation(context, 1024);
  if (failure || !body) return failure!;
  const result = (reason: string, status: number) =>
    account.json(
      { valid: false, displayName: null, discountPercent: 0, reason },
      status,
    );
  try {
    const identity = await account.identity();
    if (!identity || identity.viewer.role !== 'customer')
      return result('Sign in as a customer to check a code.', 401);
    if (!allowCreatorCheck(identity.viewer.id))
      return result('Too many checks. Try again in a minute.', 429);
    const config = paymentsConfig();
    if (!config) return result('Could not check the code. Try again.', 503);
    const admin = adminFor(config);
    const reader: CreatorCodeReader = {
      rpc: admin.rpc.bind(admin) as unknown as CreatorCodeReader['rpc'],
      name: async (code) => {
        const found = await admin
          .from('creators')
          .select('name')
          .eq('code', code)
          .eq('active', true)
          .maybeSingle();
        if (found.error) throw new Error('creator lookup unavailable');
        return found.data?.name ?? null;
      },
    };
    const selection = CheckoutRequestSchema.safeParse(body.selection);
    if (!selection.success) return result('Check your booking details.', 400);
    const checked = await checkCreatorCode(
      reader,
      identity.viewer.id,
      body.creatorCode,
      selection.data.serviceId === 'stream' || selection.data.freePerk === true,
    );
    if (!checked.valid) return account.json(checked);
    const pro = proEnabled() && (await isProMember(admin, identity.viewer.id));
    const preview = creatorPricePreview(
      selection.data,
      pro,
      (await eurToUsd()).rate,
      body.currency === 'USD' ? 'USD' : 'EUR',
    );
    return account.json({ ...checked, preview });
  } catch {
    return result('Could not check the code. Try again.', 503);
  }
};
