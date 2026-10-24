import Profile from './Profile.jsx';
import { PROFILE_LANGUAGES } from '../../contracts/account';
import type {
  DiscordLink,
  DiscordResult,
  Profile as ProfileData,
  Viewer,
} from '../../contracts/account';
// Original lib/roles.js HOME: where "Back to ..." leads for each role.
const HOME = {
  customer: '/dashboard',
  teammate: '/teammate',
  admin: '/admin',
} as const;
export default function LiveProfile({
  viewer,
  profile,
  csrf,
  discord,
  discordResult,
  discordEnabled,
}: {
  viewer: Viewer;
  profile: ProfileData;
  csrf: string;
  discord: DiscordLink | null;
  discordResult: DiscordResult | '';
  discordEnabled: boolean;
}) {
  const onSave = (body: unknown) =>
    fetch('/api/me/profile', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(body && typeof body === 'object' ? body : {}),
        csrf,
      }),
    });
  return (
    <Profile
      user={{ ...viewer, providerImage: null }}
      profile={profile}
      home={HOME[viewer.role]}
      languages={PROFILE_LANGUAGES}
      discord={discord}
      discordResult={discordResult}
      discordEnabled={discordEnabled}
      csrf={csrf}
      accountOnly
      allowUpload
      onSave={onSave}
    />
  );
}
