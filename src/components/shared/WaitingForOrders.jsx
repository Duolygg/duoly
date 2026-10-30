// The "Waiting for orders!" empty queue, shared by the teammate desk and the admin Live Desk so
// both look the same: a floating headset (its shadow breathes with it), a title and a line of copy.
// Extra pills or buttons go in as children. Styles: globals.css (tmw-*).
import React from 'react';

const DISPLAY = "'Bricolage Grotesque', sans-serif";

export default function WaitingForOrders({ text, children }) {
  return (
    <div
      className="tm-wait"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '28px 20px 32px',
        borderRadius: '22px',
        background: '#090414',
        border: '1px solid rgba(196, 170, 255, .08)',
      }}
    >
      <div aria-hidden="true" className="tmw-stage">
        <span className="tmw-shadow" />
        <svg className="tmw-hs" viewBox="0 0 132 112" width="132" height="112">
          <defs>
            <linearGradient id="tmh-band" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8B67E8" />
              <stop offset=".5" stopColor="#D9C6FF" />
              <stop offset="1" stopColor="#8B67E8" />
            </linearGradient>
            <linearGradient id="tmh-cup" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E9DDFF" />
              <stop offset=".55" stopColor="#B394FF" />
              <stop offset="1" stopColor="#6E48D2" />
            </linearGradient>
          </defs>
          {/* sound waves: fade in at the top of each float */}
          <g
            className="tmw-waves"
            fill="none"
            stroke="#D6BBFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M9 58 q-5 9 0 18" />
            <path d="M123 58 q5 9 0 18" />
          </g>
          {/* headband */}
          <path
            d="M30 66 V56 a36 36 0 0 1 72 0 V66"
            fill="none"
            stroke="url(#tmh-band)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M44 30 a30 30 0 0 1 22 -8"
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity=".55"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* mic boom */}
          <path
            d="M27 86 q4 16 30 15"
            fill="none"
            stroke="#9C7BF0"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="59" cy="101" r="4.5" fill="#D6BBFF" />
          {/* ear cups */}
          <rect
            x="16"
            y="56"
            width="24"
            height="36"
            rx="11"
            fill="url(#tmh-cup)"
          />
          <rect
            x="92"
            y="56"
            width="24"
            height="36"
            rx="11"
            fill="url(#tmh-cup)"
          />
          <rect x="35" y="61" width="7" height="26" rx="3.5" fill="#4B2E98" />
          <rect x="90" y="61" width="7" height="26" rx="3.5" fill="#4B2E98" />
          <rect
            x="21"
            y="61"
            width="4"
            height="13"
            rx="2"
            fill="#FFFFFF"
            opacity=".5"
          />
          <rect
            x="97"
            y="61"
            width="4"
            height="13"
            rx="2"
            fill="#FFFFFF"
            opacity=".5"
          />
        </svg>
      </div>

      <div
        style={{
          marginTop: '6px',
          fontFamily: DISPLAY,
          fontSize: '21px',
          fontWeight: '700',
          letterSpacing: '-.02em',
          color: '#FFFFFF',
        }}
      >
        Waiting for orders!
      </div>
      <p
        style={{
          margin: '6px 0 0',
          maxWidth: '360px',
          fontSize: '14px',
          lineHeight: '1.55',
          color: '#8E84AB',
          textWrap: 'balance',
        }}
      >
        {text}
      </p>
      {children}
    </div>
  );
}
