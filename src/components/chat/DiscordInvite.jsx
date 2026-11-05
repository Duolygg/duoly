// The order chat's one-time system message inviting the customer to our Discord for voice comms
// (supabase/migrations/20261105180000_chat_discord_invite.sql). Shared by the order room's chat
// (account/MatchStage.jsx ChatPanel, also on the homepage preview) and the order chat
// (chat/OrderChat.tsx). Inline styles so it looks the same in both.
import React from 'react';
import { DISCORD_INVITE } from '../../site/nav';

export default function DiscordInvite() {
  return (
    <div
      className="dc-invite"
      style={{
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '4px 0',
        padding: '12px 14px',
        borderRadius: '16px',
        background: 'rgba(88, 101, 242, .14)',
        border: '1px solid rgba(88, 101, 242, .45)',
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 auto',
          display: 'grid',
          placeItems: 'center',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: '#5865F2',
        }}
      >
        <img
          src="/assets/social/discord-white.png"
          alt=""
          width="22"
          height="17"
          style={{ width: '22px', height: '17px', display: 'block' }}
        />
      </span>
      <span style={{ flex: '1', minWidth: '0', lineHeight: '1.35' }}>
        <span
          style={{
            display: 'block',
            fontSize: '13.5px',
            fontWeight: '700',
            color: '#FFFFFF',
          }}
        >
          Voice comms on Discord
        </span>
        <span style={{ display: 'block', fontSize: '12.5px', color: '#CFC4EA' }}>
          Join our server to talk with your teammate while you play.
        </span>
      </span>
      <a
        href={DISCORD_INVITE}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: '36px',
          padding: '0 14px',
          borderRadius: '10px',
          background: '#5865F2',
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: '700',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Join Discord
      </a>
    </div>
  );
}
