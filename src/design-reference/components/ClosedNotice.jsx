import React from 'react';
import { DISCORD_INVITE, SUPPORT_EMAIL } from '../../site/nav';

// Honest state for forms that are not connected yet (no sample submissions).
export default function ClosedNotice({ title, text }) {
  return (
    <div role="status" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h2 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-.03em', color: '#FFFFFF' }}>{title}</h2>
      <p style={{ margin: 0, color: '#A79DC4', lineHeight: 1.55 }}>{text}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <a href={DISCORD_INVITE} rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 18px', borderRadius: '12px', background: '#5865F2', color: '#FFFFFF', fontWeight: 700, textDecoration: 'none' }}>Join our Discord</a>
        <a href={'mailto:' + SUPPORT_EMAIL} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: '1px solid rgba(214, 187, 255, .2)', color: '#F3EEFF', fontWeight: 600, textDecoration: 'none' }}>{SUPPORT_EMAIL}</a>
      </div>
    </div>
  );
}
