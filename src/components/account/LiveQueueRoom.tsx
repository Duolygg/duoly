import AnalyticsErrorBoundary from '../shared/AnalyticsErrorBoundary';
import type { ComponentProps } from 'react';
import QueueRoom from './QueueRoom.jsx';
import type { Viewer } from '../../contracts/account';

/** The original order room (QueueRoom.jsx) on the real order, chat and proof APIs. */
function LiveQueueRoomContent({
  id,
  viewer,
  csrf,
  chatEnabled,
  reportsEnabled,
  rerollLimit = 2,
  stripeKey = '',
}: {
  id: string;
  viewer: Viewer;
  csrf: string;
  chatEnabled: boolean;
  reportsEnabled: boolean;
  /** re-rolls per order; null = unlimited (PRO) */
  rerollLimit?: number | null;
  /** Stripe publishable key, for Play again's 3D Secure check ('' = payments off) */
  stripeKey?: string;
}) {
  return (
    <QueueRoom
      id={id}
      user={viewer}
      csrf={csrf}
      chatEnabled={chatEnabled}
      reportsEnabled={reportsEnabled}
      rerollLimit={rerollLimit}
      stripeKey={stripeKey}
    />
  );
}

export default function LiveQueueRoom(
  props: ComponentProps<typeof LiveQueueRoomContent>,
) {
  return (
    <AnalyticsErrorBoundary source="queue-room">
      <LiveQueueRoomContent {...props} />
    </AnalyticsErrorBoundary>
  );
}
