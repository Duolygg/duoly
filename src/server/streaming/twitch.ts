/**
 * Asks Twitch whether a streamer's channel is live (Helix "Get Streams", app access token).
 * Server only. Needs TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET from a Twitch developer app;
 * without them nobody can go online for streaming (fails closed).
 * Migration 20261105150000_streamer_twitch_live.sql records the answers.
 */
const env = (name: string): string | undefined => {
  const value: unknown = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export interface TwitchConfig {
  clientId: string;
  clientSecret: string;
}

export function twitchConfig(): TwitchConfig | null {
  const clientId = env('TWITCH_CLIENT_ID');
  const clientSecret = env('TWITCH_CLIENT_SECRET');
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

type Fetch = typeof fetch;
let token: { key: string; value: string; until: number } | null = null;

async function appToken(config: TwitchConfig, f: Fetch): Promise<string> {
  const now = Date.now();
  if (token?.key === config.clientId && token.until > now) return token.value;
  const response = await f('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
    }),
    signal: AbortSignal.timeout(5000),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
  } | null;
  if (!response.ok || typeof body?.access_token !== 'string')
    throw new Error('Twitch token unavailable');
  const seconds = Number(body.expires_in);
  token = {
    key: config.clientId,
    value: body.access_token,
    // refresh a minute early
    until:
      now + Math.max(60, Number.isFinite(seconds) ? seconds - 60 : 3600) * 1000,
  };
  return token.value;
}

/** True when the channel is live right now, false when it isn't. Throws when Twitch can't be asked. */
export async function twitchIsLive(
  login: string,
  config: TwitchConfig | null = twitchConfig(),
  f: Fetch = fetch,
): Promise<boolean> {
  if (!config) throw new Error('Twitch is not configured');
  const ask = async (bearer: string) =>
    f(
      'https://api.twitch.tv/helix/streams?type=live&user_login=' +
        encodeURIComponent(login.toLowerCase()),
      {
        headers: {
          'Client-Id': config.clientId,
          Authorization: 'Bearer ' + bearer,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
  let response = await ask(await appToken(config, f));
  if (response.status === 401) {
    token = null;
    response = await ask(await appToken(config, f));
  }
  const body = (await response.json().catch(() => null)) as {
    data?: Array<{ user_login?: unknown; type?: unknown }>;
  } | null;
  if (!response.ok || !Array.isArray(body?.data))
    throw new Error('Twitch is unavailable');
  return body.data.some(
    (s) =>
      typeof s.user_login === 'string' &&
      s.user_login.toLowerCase() === login.toLowerCase() &&
      s.type === 'live',
  );
}

/** For tests. */
export function resetTwitchToken() {
  token = null;
}
