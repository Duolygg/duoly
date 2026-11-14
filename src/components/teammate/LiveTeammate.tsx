import AnalyticsErrorBoundary from '../shared/AnalyticsErrorBoundary';
import type { ComponentProps } from 'react';
import Teammate from './Teammate.jsx';
import type { Viewer } from '../../contracts/account';
import type { TeammateStatsResponse } from '../../contracts/reviews';

/** Fabian's original teammate screen on the real session and command APIs. */
function LiveTeammateContent({
  viewer,
  csrf,
  discordLinked,
  discordEnabled,
  discordResult,
  chatEnabled,
  connectPayouts = false,
  presence = null,
  initialStats = null,
}: {
  viewer: Viewer;
  csrf: string;
  discordLinked: boolean;
  discordEnabled: boolean;
  discordResult?: string;
  chatEnabled: boolean;
  /** Stripe Connect payouts (CONNECT_PAYOUTS_ENABLED). */
  connectPayouts?: boolean;
  /** Presence read while rendering the page, so the desk doesn't start out "Offline". */
  presence?: { online: boolean; onlineSince: number | null } | null;
  /** Earnings and reviews read while rendering, so money never starts at $0.00. */
  initialStats?: TeammateStatsResponse | null;
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
      connectPayouts={connectPayouts}
      presence={presence}
      initialStats={initialStats}
      onSignOut={onSignOut}
    />
  );
}

export default function LiveTeammate(
  props: ComponentProps<typeof LiveTeammateContent>,
) {
  return (
    <AnalyticsErrorBoundary source="teammate">
      <LiveTeammateContent {...props} />
    </AnalyticsErrorBoundary>
  );
}
