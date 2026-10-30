import { useEffect, useState, type CSSProperties } from 'react';
import {
  BRACKET_COLORS,
  bracketLabel,
  TeammatePerformanceSchema,
  type Bracket,
  type TeammatePerformance,
} from '../../contracts/performance';

// The teammate's own performance ranking (GET /api/teammate/performance). Everything is computed in
// the database every 12 hours; this card only shows it. Styles follow the desk's cards.

const REFRESH_MS = 5 * 60_000;
const card: CSSProperties = {
  marginTop: '24px',
  padding: '22px',
  borderRadius: '22px',
  background: '#120B22',
  border: '1px solid rgba(196, 170, 255, .08)',
};
const label: CSSProperties = { fontSize: '13px', color: '#8E84AB' };
const big: CSSProperties = {
  fontFamily: "'Bricolage Grotesque', sans-serif",
  fontSize: '26px',
  fontWeight: 700,
  letterSpacing: '-.02em',
  color: '#FFFFFF',
};

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div
      style={{
        height: '8px',
        borderRadius: '999px',
        background: 'rgba(196, 170, 255, .1)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          borderRadius: '999px',
          background: color,
        }}
      />
    </div>
  );
}

export function BracketBadge({ bracket }: { bracket: Bracket | null }) {
  const color = bracket ? BRACKET_COLORS[bracket] : '#8E84AB';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '12.5px',
        fontWeight: 700,
        color,
        background: bracket ? `${color}1F` : 'rgba(196, 170, 255, .08)',
        border: `1px solid ${bracket ? `${color}55` : 'rgba(196, 170, 255, .14)'}`,
      }}
    >
      {bracketLabel(bracket)}
    </span>
  );
}

const ago = (iso: string) => {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - Date.parse(iso)) / 60_000),
  );
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
};

export function PerformanceView({ data }: { data: TeammatePerformance }) {
  const me = data.me ?? null;
  const run = data.run;
  const req = data.requirements;
  const bracket = data.ranked && me ? me.bracket : null;
  const metrics = me
    ? [
        ['Completed orders', String(me.completedOrders), ''],
        [
          'Customer satisfaction',
          me.avgRating !== null ? `★ ${me.avgRating.toFixed(2)}` : 'No reviews',
          `${me.reviews} ${me.reviews === 1 ? 'review' : 'reviews'}`,
        ],
        [
          'Retention rate',
          `${Math.round(me.retentionRate * 100)}%`,
          'customers who came back',
        ],
        [
          'Returning customers',
          String(me.returningCustomers),
          `of ${me.customers} ${me.customers === 1 ? 'customer' : 'customers'}`,
        ],
      ]
    : [];
  const next = data.next ?? null;
  const target = next?.score ?? null;
  const score = me?.score ?? null;
  return (
    <section aria-labelledby="perf-h" style={card}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <h2
          id="perf-h"
          style={{
            margin: 0,
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: '20px',
            color: '#FFFFFF',
          }}
        >
          Performance ranking
        </h2>
        <BracketBadge bracket={bracket} />
      </div>

      {!run ? (
        <p style={{ margin: '12px 0 0', ...label }}>
          The first ranking runs soon. It updates every 12 hours.
        </p>
      ) : (
        <>
          {data.ranked && me ? (
            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: '6px 18px',
              }}
            >
              <span style={big}>{score?.toFixed(1)}</span>
              <span style={label}>
                overall score · rank {me.rank} of {run.eligible}
              </span>
            </div>
          ) : (
            <p
              style={{ margin: '12px 0 0', color: '#CFC4EA', fontSize: '14px' }}
            >
              Not ranked yet
              {me?.reason
                ? `: ${me.reason.toLowerCase()} in the last ${run.windowDays} days.`
                : '.'}
            </p>
          )}

          {metrics.length ? (
            <dl
              style={{
                margin: '18px 0 0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
              }}
            >
              {metrics.map(([name, value, sub]) => (
                <div
                  key={name}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: '#090414',
                    border: '1px solid rgba(196, 170, 255, .06)',
                  }}
                >
                  <dt style={label}>{name}</dt>
                  <dd
                    style={{
                      margin: '4px 0 0',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                    }}
                  >
                    {value}
                  </dd>
                  {sub ? (
                    <dd
                      style={{
                        margin: '2px 0 0',
                        fontSize: '12px',
                        color: '#8E84AB',
                      }}
                    >
                      {sub}
                    </dd>
                  ) : null}
                </div>
              ))}
            </dl>
          ) : null}

          {data.ranked && me ? (
            <div style={{ marginTop: '18px' }}>
              {next && next.bracket ? (
                target !== null && score !== null ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        ...label,
                      }}
                    >
                      <span>Next: {bracketLabel(next.bracket)}</span>
                      <span>
                        {score >= target
                          ? 'Tied, keep it up'
                          : `${(target - score).toFixed(1)} points to go`}
                      </span>
                    </div>
                    <Bar
                      value={target > 0 ? (score / target) * 100 : 100}
                      color={BRACKET_COLORS[next.bracket]}
                    />
                  </>
                ) : (
                  <p style={{ margin: 0, ...label }}>
                    {bracketLabel(next.bracket)} opens up once more teammates
                    are ranked.
                  </p>
                )
              ) : (
                <p style={{ margin: 0, ...label }}>
                  You are in the top 1%. Stay there.
                </p>
              )}
            </div>
          ) : me && req ? (
            <div style={{ marginTop: '18px', display: 'grid', gap: '12px' }}>
              {(
                [
                  ['Completed orders', me.completedOrders, req.orders],
                  ['Reviews', me.reviews, req.reviews],
                  ['Different customers', me.customers, req.customers],
                ] as const
              )
                .filter(([, , need]) => need > 0)
                .map(([name, have, need]) => (
                  <div key={name}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        ...label,
                      }}
                    >
                      <span>{name}</span>
                      <span>
                        {Math.min(have, need)} of {need}
                      </span>
                    </div>
                    <Bar value={(have / need) * 100} color="#D6BBFF" />
                  </div>
                ))}
            </div>
          ) : null}

          <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#6F6690' }}>
            Retention {run.weights.retention}%, satisfaction{' '}
            {run.weights.satisfaction}%, completed orders {run.weights.orders}%,
            over the last {run.windowDays} days. Updated every 12 hours, last{' '}
            {ago(run.at)}.
          </p>
        </>
      )}
    </section>
  );
}

export default function PerformanceCard() {
  const [data, setData] = useState<TeammatePerformance | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/teammate/performance', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const parsed = TeammatePerformanceSchema.safeParse(
          await response.json(),
        );
        if (active && parsed.success) setData(parsed.data);
      } catch {
        /* keep the last ranking */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  // Hidden until the ranking exists (and before the migration is applied).
  return data ? <PerformanceView data={data} /> : null;
}
