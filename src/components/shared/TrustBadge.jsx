const STYLES = {
  trusted: {
    color: '#9EE6FF',
    background: 'rgba(158, 230, 255, .12)',
    border: '1px solid rgba(158, 230, 255, .28)',
  },
  legend: {
    color: '#FFD27A',
    background: 'rgba(255, 210, 122, .12)',
    border: '1px solid rgba(255, 210, 122, .3)',
  },
};

export function trustBadgeForCompleted(completed) {
  if (completed >= 1000) return { id: 'legend', name: 'Legend' };
  if (completed >= 100) return { id: 'trusted', name: 'Trusted' };
  return null;
}

export default function TrustBadge({ badge }) {
  if (!badge || !STYLES[badge.id]) return null;
  return (
    <span
      data-trust-badge={badge.id}
      style={{
        ...STYLES[badge.id],
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        flex: '0 0 auto',
        padding: '2px 7px',
        borderRadius: '999px',
        fontSize: '10.5px',
        fontWeight: '800',
        lineHeight: '1.35',
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">◆</span>
      {badge.name}
    </span>
  );
}
