import Profile from '../../design-reference/components/Profile.jsx';
import type {
  DiscordLink,
  DiscordResult,
  Profile as ProfileData,
  Viewer,
} from '../../contracts/account';
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
      profile={{ ...profile, bio: '', languages: [] }}
      home="/dashboard"
      languages={[]}
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
