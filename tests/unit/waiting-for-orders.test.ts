import { expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LiveDesk from '../../src/components/admin/LiveDesk.jsx';
import Teammate from '../../src/components/teammate/Teammate.jsx';

const headset = 'class="tmw-stage"';

it('shows the same "Waiting for orders" empty state on the admin Live Desk as on the teammate desk', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const desk: any = new LiveDesk({ api: { get: async () => ({ ok: false }) } });
  expect(renderToStaticMarkup(desk.render())).toContain('Loading the queue');
  desk.state = { ...desk.state, loaded: true };
  const admin = renderToStaticMarkup(desk.render());
  expect(admin).toContain(headset);
  expect(admin).toContain('Waiting for orders!');
  expect(admin).toContain('New orders appear here the second they’re paid.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teammate: any = new Teammate({
    csrf: 'token',
    discordLinked: true,
    user: { name: 'Fabian' },
    access: { games: ['lol'], gg: false },
  });
  const v = teammate.renderVals();
  const mine = renderToStaticMarkup(
    React.createElement(React.Fragment, null, teammate.renderWaiting(v)),
  );
  expect(mine).toContain(headset);
  expect(mine).toContain('Waiting for orders!');
  expect(mine).toContain('As soon as an eligible order is available');
});
