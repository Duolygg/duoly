import QueueRoom from './QueueRoom.jsx';
import type { Viewer } from '../../contracts/account';

/** The original order room (QueueRoom.jsx) on the real order, chat and proof APIs. */
export default function LiveQueueRoom({
  id,
  viewer,
  csrf,
  chatEnabled,
  reportsEnabled,
}: {
  id: string;
  viewer: Viewer;
  csrf: string;
  chatEnabled: boolean;
  reportsEnabled: boolean;
}) {
  return (
    <QueueRoom
      id={id}
      user={viewer}
      csrf={csrf}
      chatEnabled={chatEnabled}
      reportsEnabled={reportsEnabled}
    />
  );
}
