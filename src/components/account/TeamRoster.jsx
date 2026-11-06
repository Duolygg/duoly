// Team orders (20261106190000_team_orders): every seat of the customer's team, who took it and
// where it stands. The customer switches any one teammate right here (in the first 5 minutes after
// the whole team is in), and rates each one on their own seat order once they're done.
const MUTED = '#A79DC4';
const GREEN = '#5EEAA8';
const PINK = '#F0A6FF';

/** What a seat is doing, in the team's own words. */
function seatLine(m, team) {
  if (m.status === 'queued')
    return team.status === 'started' ? 'Finding a new teammate…' : 'Searching…';
  if (m.status === 'in_progress')
    return team.status === 'waiting' ? 'Joined · ready' : 'Playing';
  if (m.status === 'completed') return 'Done';
  return team.status === 'started' || team.status === 'done'
    ? 'Not replaced · refunded'
    : 'Not filled';
}

const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

export default function TeamRoster({ team, orderId, now = 0, onSwitch }) {
  if (!team) return null;
  return (
    <section
      aria-label={
        'Your team: ' + team.filled + ' of ' + team.seats + ' seats taken'
      }
      style={{ marginTop: '22px', textAlign: 'left' }}
    >
      <p
        style={{
          margin: '0 0 10px',
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        Your team · {team.filled} of {team.seats}
      </p>
      <ul
        style={{
          margin: '0',
          padding: '0',
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '8px',
        }}
      >
        {team.members.map((m) => {
          const taken = !!m.name;
          const first = taken ? String(m.name).split(' ')[0] : '';
          const rate =
            m.status === 'completed' && !m.reviewed && m.orderId !== orderId
              ? '/queue/' + m.orderId
              : '';
          // the same window and limit reroll_order checks; the server has the last word
          const switchLeft =
            onSwitch &&
            team.status === 'started' &&
            m.status === 'in_progress' &&
            m.switchUntil &&
            m.switchesLeft > 0
              ? m.switchUntil - now
              : 0;
          return (
            <li
              key={m.seat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '14px',
                background: taken ? '#1B1033' : 'rgba(27, 16, 51, .45)',
                border:
                  '1px ' +
                  (taken ? 'solid' : 'dashed') +
                  ' rgba(214, 187, 255, ' +
                  (taken ? '.18' : '.14') +
                  ')',
              }}
            >
              {taken ? (
                <img
                  src={m.image || '/assets/avatars/avatar-3.png'}
                  alt=""
                  width="32"
                  height="32"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flex: '0 0 auto',
                  }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    flex: '0 0 auto',
                    border: '1.5px dashed rgba(214, 187, 255, .3)',
                  }}
                />
              )}
              <span style={{ flex: '1', minWidth: '0', lineHeight: '1.3' }}>
                <span
                  style={{
                    display: 'block',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {taken ? first : 'Seat ' + m.seat}
                </span>
                {rate ? (
                  <a
                    href={rate}
                    style={{
                      fontSize: '12.5px',
                      color: GREEN,
                      fontWeight: 600,
                    }}
                  >
                    Rate {first}
                  </a>
                ) : (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      color:
                        m.status === 'in_progress'
                          ? GREEN
                          : m.status === 'queued'
                            ? PINK
                            : MUTED,
                    }}
                  >
                    {seatLine(m, team)}
                  </span>
                )}
                {switchLeft > 0 ? (
                  // under the status, so narrow cards keep the whole name
                  <button
                    type="button"
                    onClick={() => onSwitch(m)}
                    aria-label={
                      'Switch ' + first + ', ' + clock(switchLeft) + ' left'
                    }
                    title={clock(switchLeft) + ' left to switch ' + first}
                    style={{
                      display: 'block',
                      marginTop: '2px',
                      padding: '0',
                      border: 'none',
                      background: 'transparent',
                      color: '#D6BBFF',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                      cursor: 'pointer',
                      transform: 'none',
                    }}
                  >
                    Switch · {clock(switchLeft)}
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
