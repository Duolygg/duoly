import Profile from '../../design-reference/components/Profile.jsx';
import type { Profile as ProfileData, Viewer } from '../../contracts/account';
export default function LiveProfile({
  viewer,
  profile,
  csrf,
}: {
  viewer: Viewer;
  profile: ProfileData;
  csrf: string;
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
      discord={null}
      discordResult=""
      accountOnly
      onSave={onSave}
    />
  );
}
