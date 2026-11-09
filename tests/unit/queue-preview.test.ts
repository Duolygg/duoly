import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Home from '../../src/components/home/Home.jsx';
import QueuePreview from '../../src/components/home/QueuePreview.jsx';
import MatchStage, {
  ChatPanel,
  OrderCard,
  QueueSteps,
  QueueTimer,
  ReviewThanks,
  clock,
} from '../../src/components/account/MatchStage.jsx';

const h = React.createElement;
const game = {
  name: 'League of Legends',
  img: '/assets/games/league-of-legends.png',
};
const order = {
  ref: 'DL-1',
  title: 'Duo Pro',
  games: 3,
  region: 'EUW',
  ign: 'Alex#EUW',
  voice: true,
  paid: { method: 'Card' },
};
const user = { name: 'Alex', image: '/assets/avatars/avatar-1.png' };
const mate = { name: 'Mia', image: '/assets/avatars/avatar-2.png' };
const at = (html: string, s: string) => html.indexOf(s);
// the review form after the customer filled it in (QueuePreview state.rv)
const rated = {
  rating: 5,
  hover: 0,
  tags: ['Great comms', 'Patient'],
  text: 'Super calm, explained every rotation. Thanks!',
  tip: 5,
  custom: '',
  err: '',
};

describe('shared order room pieces', () => {
  it('the order room renders every piece from MatchStage.jsx', () => {
    const room = readFileSync('src/components/account/QueueRoom.jsx', 'utf8');
    for (const piece of [
      '<MatchStage',
      '<QueueTimer waited={waited} />',
      '<QueueSteps steps={v.steps} />',
      '<OrderCard',
      '<ChatPanel',
      '<ReviewForm',
      '<ReviewThanks',
      '<CoveredPanel',
      '<ProofPanel',
      '<PrivateProofs orderId={o.id} mode="customer" />',
    ])
      expect(room).toContain(piece);
    // the order room keeps its own handlers
    expect(room).toContain('onSend={this.send}');
    expect(room).toContain('onDraft={this.setDraft}');
    expect(room).toContain('onEdit={this.editRv}');
    expect(room).toContain('onSend={this.sendReview}');
    expect(room).toContain(
      "onReroll={() => this.setState({ modal: 'reroll', modalErr: '' })}",
    );
    expect(room).toContain('onReport={(type) => this.openReport(type)}');
  });

  it('stage: cycling face while searching, the teammate on a match', () => {
    const searching = renderToStaticMarkup(
      h(MatchStage, {
        phase: 'searching',
        mate: null,
        order,
        game,
        user,
        cycle: 3,
      }),
    );
    expect(searching).toContain('Duo Pro ×3');
    expect(searching).toContain('Searching…');
    expect(searching).toContain('qorbit');
    const matched = renderToStaticMarkup(
      h(MatchStage, { phase: 'matched', order, game, user, mate, burst: 1 }),
    );
    expect(matched).toContain('Mia');
    expect(matched).toContain('Rank-verified');
    expect(matched).toContain('qburst');
  });

  it('timer, steps, order card, chat and review thanks', () => {
    expect(clock(67000)).toBe('1:07');
    expect(clock(-5)).toBe('0:00');
    const timer = renderToStaticMarkup(h(QueueTimer, { waited: 84000 }));
    expect(timer).toContain('IN QUEUE');
    expect(timer).toContain('1:24');
    const steps = renderToStaticMarkup(
      h(QueueSteps, {
        steps: [
          ['Paid', true, false],
          ['In queue', false, true],
          ['Playing', false, false],
          ['Done', false, false],
        ],
      }),
    );
    expect(steps).toMatch(/aria-current="step"[^>]*>[\s\S]*In queue/);
    const card = renderToStaticMarkup(
      h(OrderCard, {
        order,
        game,
        total: '€8.07',
        free: false,
        mate,
        ignLabel: 'Riot ID',
      }),
    );
    expect(card).toContain('Your order');
    expect(card).toContain('€8.07');
    expect(card).toContain('Your teammate · rank-verified');
    const chatProps = {
      mate,
      order,
      ignLabel: 'Riot ID',
      draft: '',
      warn: '',
      onDraft: () => {},
      onSend: () => {},
    };
    const chat = renderToStaticMarkup(
      h(ChatPanel, {
        ...chatProps,
        phase: 'matched',
        chat: [{ id: 'a', from: 'teammate', text: 'Hey!', at: 0 }],
        typing: true,
        listRef: undefined,
      }),
    );
    expect(chat).toContain('Chat with Mia');
    expect(chat).toContain('Hey!');
    expect(chat).toContain('Mia is typing');
    expect(chat).toContain('Message Mia…');
    const closed = renderToStaticMarkup(
      h(ChatPanel, {
        ...chatProps,
        phase: 'done',
        chat: [],
        typing: false,
        listRef: undefined,
      }),
    );
    expect(closed).toContain('Order finished · chat closed');
    expect(closed).not.toContain('Message Mia…');
    const thanks = renderToStaticMarkup(
      h(ReviewThanks, { name: 'Mia', rating: 5, tip: null, children: null }),
    );
    expect(thanks).toContain('THANK YOU');
    expect(thanks).toContain('Rated 5 out of 5');
    expect(thanks).toContain('You rated Mia 5/5');
    expect(thanks).not.toContain('Trustpilot');
    // the order room adds the Trustpilot invite after every review, low ratings included
    for (const rating of [1, 5]) {
      const invited = renderToStaticMarkup(
        h(ReviewThanks, {
          name: 'Mia',
          rating,
          tip: null,
          reviewUrl: 'https://www.trustpilot.com/evaluate/duoly.gg',
          children: null,
        }),
      );
      expect(invited).toContain(
        'href="https://www.trustpilot.com/evaluate/duoly.gg"',
      );
      expect(invited).toContain('Write a review on Trustpilot');
    }
  });
});

describe('homepage order room preview', () => {
  const frame = (frozen?: Record<string, unknown>) =>
    renderToStaticMarkup(h(QueuePreview, frozen ? { frozen } : {}));

  it('opens on the search with the order card beside it, in a duoly.gg/queue window', () => {
    const html = frame();
    expect(html).toContain('Watch your order, live.');
    expect(html).toContain('duoly.gg/queue/DL-48321');
    expect(html).toContain('Finding your teammate');
    // a Pokémon Unite order on the Asia servers, with the real catalog price
    expect(html).toContain('rank-verified Pokémon Unite teammates');
    expect(html).toContain('Duo Pro ×3');
    expect(html).toContain('Asia');
    expect(html).toContain('€9.42');
    expect(html).toMatch(/Trainer name<\/dt><dd[^>]*>Alex</);
    expect(html).toContain('IN QUEUE');
    expect(html).toContain('Your order');
    expect(html).toMatch(/Paid with<\/dt><dd[^>]*>PayPal</);
    expect(html).not.toContain('Chat with');
    // a picture: hidden from screen readers (described once) and not focusable
    expect(html).toContain('class="qp-body" aria-hidden="true" inert=""');
    expect(html).toContain('Preview of the order room');
  });

  it('on a match: teammate, chat with messages and typing, order card under the stage', () => {
    const html = frame({
      phase: 'matched',
      typing: true,
      chat: [
        { id: 'p0', from: 'teammate', text: 'Hey! Sending the invite.', at: 0 },
      ],
    });
    expect(html).toContain('itskeikooo is on it!');
    expect(html).toContain('/assets/avatars/itskeikooo.jpg');
    expect(html).toContain('/assets/flags/svg/jp.svg" alt="Japan"');
    expect(html).toContain('Message itskeikooo');
    expect(html).toContain('Chat with itskeikooo');
    expect(html).toContain('Hey! Sending the invite.');
    expect(html).toContain('itskeikooo is typing');
    // You're covered: re-roll with its countdown, both reports with the bounty, under the chat
    expect(html).toContain('You’re covered');
    expect(html).toContain('4:31 left. 2 of 2 re-rolls left.');
    expect(html).toContain('Asked to pay or chat outside Duoly?');
    expect(html).toContain(
      'Report itskeikooo with proof and get €50 once we confirm it.',
    );
    expect(at(html, 'Chat with itskeikooo')).toBeLessThan(
      at(html, 'You’re covered'),
    );
    expect(at(html, 'itskeikooo is on it!')).toBeLessThan(
      at(html, 'id="q-order-h"'),
    );
    expect(at(html, 'id="q-order-h"')).toBeLessThan(
      at(html, 'Chat with itskeikooo'),
    );
  });

  it('when done: GG, the review form, every step ticked and the chat closed', () => {
    const html = frame({ phase: 'done' });
    expect(html).toContain('GG!');
    expect(html).toContain(
      'Your 3 games with itskeikooo are done. How was it?',
    );
    expect(html).toContain('Rate your session with itskeikooo');
    expect(html).toContain('Tap to rate');
    expect(html).toContain('Queue again');
    expect(html).toContain('Order finished · chat closed');
    expect(html).toContain('Locked now that your session is underway');
    expect(html).not.toContain('aria-current="step"');
  });

  it('when done: the teammate’s proof under the covered panel, as the order room shows it', () => {
    const html = frame({
      phase: 'done',
      matchedAt: Date.UTC(2026, 10, 2, 10, 30),
    });
    expect(html).toContain('Proof from your teammate');
    expect(html).toContain('Private evidence');
    for (const n of [1, 2, 3]) {
      expect(html).toContain('/assets/demo/proof-pu-' + n + '.svg');
      expect(html).toContain('Open evidence image ' + n);
    }
    expect(html).toContain('2026-11-02 10:01:00+00:00');
    expect(at(html, 'You’re covered')).toBeLessThan(
      at(html, 'Proof from your teammate'),
    );
    expect(frame({ phase: 'matched' })).not.toContain(
      'Proof from your teammate',
    );
  });

  it('shows the customer rating and picking a tip, like the order room', () => {
    const html = frame({ phase: 'done', rv: rated });
    expect(html).toContain('Amazing!');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Great comms</);
    expect(html).toContain('Super calm, explained every rotation.');
    expect(html).toContain('Leave a tip for itskeikooo');
    expect(html).toContain('100% goes to itskeikooo');
    expect(html).toMatch(/aria-checked="true"[^>]*>€5</);
    expect(html).toContain('Send rating and €5 tip');
  });

  it('then the thank-you with the tip', () => {
    const html = frame({ phase: 'done', rv: rated, reviewed: true });
    expect(html).toContain('You rated itskeikooo 5/5 and left a €5 tip.');
    expect(html).toContain('100% of your tip goes to itskeikooo.');
    expect(html).not.toContain('Leave a tip for');
  });

  it('sits right after the three steps in "How it works"', () => {
    const html = renderToStaticMarkup(h(Home, { recentMatches: [] }));
    expect(at(html, 'Accept the invite')).toBeLessThan(
      at(html, 'Watch your order, live.'),
    );
    expect(at(html, 'Watch your order, live.')).toBeLessThan(
      at(html, 'Pay your way'),
    );
  });
});

describe('order room preview prices', () => {
  it('shows the demo order in euros by default, priced from the catalog', () => {
    const html = renderToStaticMarkup(h(QueuePreview));
    expect(html).toContain('€9.42');
    expect(html).not.toContain('$');
  });

  it('follows the selected currency like the rest of the homepage', () => {
    // Home.jsx conv for USD at a 1.13 rate: 2.99 → 3.99 a game; 3 games minus 10% → 10.77
    const conv = (p: number) => Math.ceil(p * 1.13) - 0.01;
    const html = renderToStaticMarkup(
      h(QueuePreview, {
        cur: 'USD',
        conv,
        frozen: { phase: 'matched' },
      }),
    );
    expect(html).toContain('$10.77');
    expect(html).toContain('get $50 once we confirm it');
    const tipped = renderToStaticMarkup(
      h(QueuePreview, {
        cur: 'USD',
        conv,
        frozen: { phase: 'done', rv: { ...rated, tip: 5 } },
      }),
    );
    expect(tipped).toContain('Send rating and $5 tip');
    expect(html).not.toContain('€');
  });

  it('gets the currency and converter from the homepage', () => {
    const home = readFileSync('src/components/home/Home.jsx', 'utf8');
    expect(home).toContain('<QueuePreview cur={v.cur} conv={v.conv} />');
  });
});

describe('favorite heart in the preview', () => {
  const frame = (frozen: Record<string, unknown>) =>
    renderToStaticMarkup(h(QueuePreview, { frozen }));
  const pressed = (html: string) =>
    [...html.matchAll(/class="q-fav"[^>]*aria-pressed="(true|false)"/g)].map(
      (m) => m[1],
    );
  it('shows an empty heart on the teammate card once they accept', () => {
    expect(pressed(frame({ phase: 'searching' }))).toEqual([]);
    expect(pressed(frame({ phase: 'matched' }))).toEqual(['false']);
  });
  it('asks after a good review, then fills both hearts', () => {
    const asked = frame({ phase: 'done', rv: rated, reviewed: true });
    expect(asked).toContain('Want to play with');
    expect(pressed(asked)).toEqual(['false', 'false']);
    const hearted = frame({
      phase: 'done',
      rv: rated,
      reviewed: true,
      fav: true,
    });
    expect(hearted).not.toContain('Want to play with');
    expect(hearted).toContain('is in your favorites');
    expect(pressed(hearted)).toEqual(['true', 'true']);
  });
  it('uses the same block as the order room', () => {
    const room = readFileSync('src/components/account/QueueRoom.jsx', 'utf8');
    expect(room).toContain(
      '<FavoriteAsk name={name} rating={o.review.rating} fav={fav} />',
    );
    const preview = readFileSync(
      'src/components/home/QueuePreview.jsx',
      'utf8',
    );
    expect(preview).toContain('<FavoriteAsk');
  });
});
