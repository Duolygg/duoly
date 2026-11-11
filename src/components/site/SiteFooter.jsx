import { useEffect, useRef, useState } from 'react';
import { FOOTER_COLUMNS } from '../../site/nav';
import BundledImage from '../shared/BundledImage';

// The one footer for every page (Fabian 2026-10-30): the homepage design with "Made in Vienna",
// the live Vienna clock and the link columns. Home.jsx and SiteLayout.astro both render this, so
// the pages can't drift apart again. bottomSpace leaves room for a sticky bar (the homepage's order
// bar needs 120 px); topSpace is the gap above it on the other pages.

// Vienna time and whether the team is awake (08:00 to midnight). Null before the first tick, so the
// server render and the first client render match.
export function viennaClock(now) {
  if (!now)
    return {
      hm: '--:--',
      s: '--',
      status: 'Checking Vienna time…',
      dot: '#8E84AB',
    };
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(new Date(now))
    .forEach((p) => {
      parts[p.type] = p.value;
    });
  const awake = parseInt(parts.hour, 10) % 24 >= 8;
  return {
    hm: (parts.hour === '24' ? '00' : parts.hour) + ':' + parts.minute,
    s: parts.second,
    status: awake
      ? 'Our team is online'
      : 'Team’s asleep, support still live 24/7',
    dot: awake ? '#5EEAA8' : '#F0A6FF',
  };
}

export default function SiteFooter({ bottomSpace = 64, topSpace = 0 }) {
  const [now, setNow] = useState(null);
  const root = useRef(null);
  // The clock reads the right time from its first render on, but it only re-renders while the
  // footer is actually on screen. Ticking it once a second from load cost a React render plus a
  // style and paint pass every second of the page's life, for seconds nobody was looking at:
  // on the homepage the footer sits past six screens of content. Scrolling to it resumes the
  // tick in the same frame the observer fires, so it never shows a stale second.
  useEffect(() => {
    let timer = 0;
    let onScreen = true;
    const tick = () => setNow(Date.now());
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const sync = () => {
      const run = onScreen && document.visibilityState === 'visible';
      if (!run) return stop();
      tick();
      if (!timer) timer = window.setInterval(tick, 1000);
    };
    tick();
    const element = root.current;
    let observer = null;
    if (element && typeof IntersectionObserver !== 'undefined') {
      onScreen = false;
      observer = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      });
      observer.observe(element);
    }
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      stop();
    };
  }, []);
  const clock = viennaClock(now);
  return (
    <footer
      ref={root}
      className="site-footer"
      style={{
        marginTop: topSpace + 'px',
        borderTop: '1px solid rgba(196, 170, 255, .08)',
      }}
    >
      <div
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '40px 24px 0',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '28px 40px',
            padding: '28px 32px',
            borderRadius: '26px',
            background: '#120B22',
            border: '1px solid rgba(196, 170, 255, .1)',
          }}
        >
          <div
            style={{
              flex: '1 1 420px',
              minWidth: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <img
              src="/assets/flags/at.png"
              alt="Austrian flag"
              width="64"
              height="64"
              style={{
                flex: '0 0 auto',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                display: 'block',
                boxShadow: '0 10px 30px rgba(200, 16, 46, .35)',
              }}
            />
            <div style={{ minWidth: '0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#F0A6FF',
                  letterSpacing: '.02em',
                }}
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#F0A6FF"
                    d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
                  />
                </svg>
                Made in Vienna, Austria
              </div>
              <p
                style={{
                  margin: '6px 0 0',
                  fontFamily:
                    "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif",
                  fontSize: '22px',
                  fontWeight: '700',
                  letterSpacing: '-.02em',
                  lineHeight: '1.25',
                  color: '#FFFFFF',
                }}
              >
                “Mozart took years to finish a symphony. You’ll be in a match in
                2 minutes.”
              </p>
            </div>
          </div>
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              paddingLeft: '28px',
              borderLeft: '1px solid rgba(196, 170, 255, .12)',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#8E84AB',
              }}
            >
              Local time · Vienna
            </span>
            <span
              style={{
                fontFamily:
                  "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif",
                fontSize: '44px',
                fontWeight: '700',
                letterSpacing: '-.03em',
                lineHeight: '1',
                color: '#FFFFFF',
              }}
            >
              {clock.hm}:{clock.s}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: '#A79DC4',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: clock.dot,
                }}
              />
              {clock.status}
            </span>
          </div>
        </div>
      </div>
      <div
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '40px 24px ' + bottomSpace + 'px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '28px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <BundledImage
            src="/assets/brand/logo-wordmark.webp"
            alt="Duoly"
            width="144"
            height="54"
            loading="lazy"
            decoding="async"
            style={{ width: '144px', height: '54px' }}
          />
          <span
            style={{ fontSize: '13px', color: '#7C7199', maxWidth: '360px' }}
          >
            © 2026 Duoly. Not affiliated with Riot Games, Valve, Epic Games,
            Activision Blizzard, EA, Ubisoft, NetEase, Mojang or The Pokémon
            Company.
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '40px',
            fontSize: '14px',
          }}
        >
          {FOOTER_COLUMNS.map((col) => (
            <div
              key={col.title}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <span style={{ fontWeight: '600', color: '#FFFFFF' }}>
                {col.title}
              </span>
              {col.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  rel={l.href.startsWith('http') ? 'noopener' : undefined}
                  style={{ textDecoration: 'none' }}
                >
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
