import type { AstroCookies } from 'astro';
import { CurrencySchema } from '../contracts/account';
import { customerUsdRate, eurToUsd } from './fx';

/**
 * The currency a signed-in customer sees, as the homepage picks it: the account's, then the one
 * picked (or auto-detected) on this browser, else EUR. With USD comes the customer rate.
 */
export async function viewerCurrency(
  cookies: AstroCookies,
  accountCurrency: string | null | undefined,
): Promise<{ cur: 'EUR' | 'USD'; usdRate?: number }> {
  const picked = CurrencySchema.safeParse(
    accountCurrency ??
      cookies.get('duoly-currency')?.value ??
      cookies.get('duoly-currency-auto')?.value,
  );
  const cur = picked.success ? picked.data : 'EUR';
  return cur === 'USD'
    ? { cur, usdRate: customerUsdRate((await eurToUsd()).rate) }
    : { cur };
}
