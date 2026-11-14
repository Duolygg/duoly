/*
 * The public slugs of the signed-in customer's saved teammates (customer_favorite_slugs(),
 * 20261114120000_directory_cards.sql), so the directory can mark saved cards and show a "Your
 * saved teammates" row. Anyone who is not a signed-in customer, and any database without that
 * migration, gets an empty list: the directory then simply has no saved row.
 */
import type { AstroGlobal } from 'astro';
import { z } from 'zod';
import { accountContext } from '../auth/context';
import { fixturesEnabled } from './public-profiles';

const slugs = z.array(z.string().max(64)).max(200);

export async function loadSavedSlugs(Astro: AstroGlobal): Promise<string[]> {
  if (fixturesEnabled()) return [];
  const account = accountContext(Astro.request, Astro.cookies);
  if (!account.config || !account.client) return [];
  try {
    const identity = await account.identity();
    if (identity?.viewer.role !== 'customer') return [];
    /* Bound loosely, as the favorites handlers do: the generated types predate this function. */
    const rpc = account.client.rpc.bind(account.client) as unknown as (
      fn: string,
    ) => Promise<{ data: unknown; error: unknown }>;
    const { data, error } = await rpc('customer_favorite_slugs');
    if (error) return [];
    const parsed = slugs.safeParse(data);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
