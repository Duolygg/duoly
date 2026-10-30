/** Column default of profiles.name (migration 20261021230000) until the user saves a name. */
export const DEFAULT_PROFILE_NAME = 'Player';

interface ProviderIdentity {
  provider: string;
  identity_data?: Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/**
 * The name shown for the signed-in viewer. A saved profile name always wins; while the
 * profile still has the default, the name from the sign-in provider is used instead
 * (Discord display name, Google full name), current provider first. Reads provider
 * identity data, not user_metadata, which the user can rewrite through the auth API.
 * Email sign-ups have no provider name, so they fall back to the part of the email before
 * the @ (without a +tag), like the dashboard always meant to. Only the viewer sees it.
 */
export function displayName(
  profileName: string,
  identities: ProviderIdentity[] = [],
  provider?: string,
  email?: string | null,
): string {
  if (profileName !== DEFAULT_PROFILE_NAME) return profileName;
  const ordered = [...identities].sort(
    (a, b) => Number(b.provider === provider) - Number(a.provider === provider),
  );
  const fit = (value: unknown) => [...text(value)].slice(0, 32).join('').trim();
  for (const { identity_data: data = {} } of ordered) {
    const claims = data.custom_claims as Record<string, unknown> | undefined;
    for (const candidate of [claims?.global_name, data.full_name, data.name]) {
      const name = fit(candidate);
      if (name.length >= 2) return name;
    }
  }
  const local = fit((email ?? '').split('@')[0]?.split('+')[0]);
  return local.length >= 2 ? local : profileName;
}
