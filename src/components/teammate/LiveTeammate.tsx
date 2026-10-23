import Teammate from './Teammate.jsx';
import type { Viewer } from '../../contracts/account';

/** Fabian's original teammate screen on the real session and command APIs. */
export default function LiveTeammate({
  viewer,
  csrf,
  discordLinked,
  discordEnabled,
  discordResult,
  chatEnabled,
}: {
  viewer: Viewer;
  csrf: string;
  discordLinked: boolean;
  discordEnabled: boolean;
  discordResult?: string;
  chatEnabled: boolean;
}) {
  const onSignOut = async () => {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf }),
    });
    if (response.ok) window.location.assign('/');
  };
  return (
    <Teammate
      user={viewer}
      csrf={csrf}
      discordLinked={discordLinked}
      discordEnabled={discordEnabled}
      discordResult={discordResult}
      chatEnabled={chatEnabled}
      onSignOut={onSignOut}
    />
  );
}
