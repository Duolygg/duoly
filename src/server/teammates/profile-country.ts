import { COUNTRIES } from '../../design-reference/lib/countries.js';

/** Resolve stored ISO codes and legacy names from the same profile picker catalog. */
export function profileCountry(value: string | null | undefined): {
  code: string;
  name: string;
} | null {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  const country = COUNTRIES.find(
    ([code, name]) => code === key || name?.toLowerCase() === key,
  );
  const [code, name] = country ?? [];
  return code && name ? { code, name: name.replaceAll('&', 'and') } : null;
}
