import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ChatConversation,
  type ChatRoom,
} from '../../src/components/chat/OrderChat';
import { ChatPanel } from '../../src/components/account/MatchStage.jsx';
import QueuePreview from '../../src/components/home/QueuePreview.jsx';
import {
  DISCORD_INVITE,
  DISCORD_INVITE_MESSAGE,
  isDiscordInvite,
} from '../../src/site/nav';

const h = React.createElement;
const sql = readFileSync(
  'supabase/migrations/20261105180000_chat_discord_invite.sql',
  'utf8',
);
const card = 'Voice comms on Discord';

describe('order chat Discord invite', () => {
  it('the migration sends the same text the chat turns into a card', () => {
    expect(sql).toContain(`'${DISCORD_INVITE_MESSAGE}'`);
    expect(DISCORD_INVITE).toBe('https://discord.gg/KuVyByUyV4');
    expect(isDiscordInvite(DISCORD_INVITE_MESSAGE)).toBe(true);
    expect(isDiscordInvite('Order complete · GG!')).toBe(false);
  });

  it('is sent once per customer, under a durable marker the chat cap cannot prune', () => {
    expect(sql).toMatch(
      /create table public\.order_chat_discord_invites \(\s*customer_id uuid primary key/,
    );
    expect(sql).toContain('on conflict (customer_id) do nothing');
    expect(sql).toContain('returning customer_id into v_invited');
    expect(sql).toMatch(
      /if v_invited is not null then[\s\S]*'discord_invite'\);/,
    );
    // only inside the accepted-once branch, and only while the order is being played
    const accepted = sql.indexOf('if not v_room.accepted_emitted then');
    const invite = sql.indexOf("'discord_invite');");
    const completed = sql.indexOf("if p_order.status = 'completed'");
    expect(accepted).toBeGreaterThan(0);
    expect(invite).toBeGreaterThan(accepted);
    expect(invite).toBeLessThan(completed);
    expect(sql).toContain(
      "check (system_event in ('accepted','completed','reviewed','handed_over','discord_invite'))",
    );
    // private: no client reads or writes the marker
    expect(sql).toContain(
      'revoke all on table public.order_chat_discord_invites from public, anon, authenticated, service_role;',
    );
  });

  it('the order chat shows the system message as a Discord card with the invite link', () => {
    const room: ChatRoom = {
      order_id: '00000000-0000-4000-8000-000000000001',
      assignment_id: '00000000-0000-4000-8000-000000000002',
      viewer: 'customer',
      writable: true,
      participant: {
        role: 'teammate',
        name: 'Luna',
        image: '/assets/avatars/avatar-3.png',
      },
      messages: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          sequence: 1,
          kind: 'system',
          sender: 'system',
          name: 'Duoly',
          image: '',
          body: DISCORD_INVITE_MESSAGE,
          created_at: '2026-11-05T10:00:00Z',
          request_id: null,
        },
        {
          id: '00000000-0000-4000-8000-000000000004',
          sequence: 2,
          kind: 'user',
          sender: 'teammate',
          name: 'Luna',
          image: '/assets/avatars/avatar-3.png',
          body: 'my server: ' + DISCORD_INVITE,
          created_at: '2026-11-05T10:01:00Z',
          request_id: '00000000-0000-4000-8000-000000000005',
        },
      ],
      typing: [],
      archives: [],
    };
    const html = renderToStaticMarkup(
      h(ChatConversation, { room, view: 'customer' }),
    );
    expect(html).toContain(card);
    expect(html).toContain(`href="${DISCORD_INVITE}"`);
    expect(html).toContain('/assets/social/discord-white.png');
    // a user message with the link stays a plain bubble: only the system can send the card
    expect(html.split(card)).toHaveLength(2);
    expect(html).toContain('my server: ' + DISCORD_INVITE);
  });

  it('the order room chat shows it as a card too, and other system messages as before', () => {
    const html = renderToStaticMarkup(
      h(ChatPanel, {
        mate: { name: 'Mia', image: '/assets/avatars/avatar-2.png' },
        order: { ign: 'Alex', voice: true },
        phase: 'matched',
        ignLabel: 'Riot ID',
        chat: [
          {
            id: 's1',
            from: 'system',
            text: 'Mia accepted the order · Duo Pro ×3',
            at: 0,
          },
          { id: 's2', from: 'system', text: DISCORD_INVITE_MESSAGE, at: 0 },
        ],
        typing: false,
        draft: '',
        warn: '',
        onDraft: () => {},
        onSend: () => {},
        listRef: undefined,
      }),
    );
    expect(html).toContain('Mia accepted the order · Duo Pro ×3');
    expect(html).toContain(card);
    expect(html).toContain(`href="${DISCORD_INVITE}"`);
    expect(html).not.toContain(DISCORD_INVITE_MESSAGE);
  });

  it('the homepage preview plays the invite once, right after the match', () => {
    const html = renderToStaticMarkup(
      h(QueuePreview, {
        frozen: {
          phase: 'matched',
          chat: [
            { id: 'p0', from: 'system', text: DISCORD_INVITE_MESSAGE, at: 0 },
          ],
        },
      }),
    );
    expect(html.split(card)).toHaveLength(2);
    const src = readFileSync('src/components/home/QueuePreview.jsx', 'utf8');
    expect(src.match(/DISCORD_INVITE_MESSAGE\]/g)).toHaveLength(1);
  });
});
