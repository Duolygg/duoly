/* global window, document, URL, navigator, ResizeObserver, setTimeout, clearTimeout */
// This source is inlined into the resource; it has no browser dependencies.
const tool = '__TOOL__';
const app = document.getElementById('app');
let card,
  state,
  input = {},
  ready = false,
  serial = 0;
const pending = new Map();
const htmlEscape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const copy = (value) =>
  htmlEscape(
    String(value ?? '')
      .replace(/[\u2013\u2014]/g, '-')
      .replaceAll('&', 'and'),
  );
const icon = (slug, cls = 'gi') =>
  `<img class="${cls}" src="https://duoly.gg/assets/games/${htmlEscape(slug)}.png" alt="">`;
const globe =
  '<svg viewBox="0 0 20 20" fill="none" stroke="#d6bbff" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.2 2.2 2.2 12.8 0 15M10 2.5c-2.2 2.2-2.2 12.8 0 15"/></svg>';
const controller =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="1.8"><rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7 10.5v3M5.5 12h3"/><circle cx="16" cy="11" r=".9" fill="#fff"/><circle cx="18" cy="13" r=".9" fill="#fff"/></svg>';
function gem(rank, id) {
  const colors = {
    Iron: '#a3a9b4',
    Bronze: '#d0915e',
    Silver: '#dfe7f1',
    Gold: '#ffd27a',
    Platinum: '#4fd1c5',
    Diamond: '#c99bff',
    Ascendant: '#5eeaa8',
    Immortal: '#ff5c7a',
    Radiant: '#fff6b8',
  };
  const color = colors[rank] || '#d6bbff';
  return `<svg viewBox="0 0 24 24"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".6"/></linearGradient></defs><path d="M12 2l8 5v10l-8 5-8-5V7z" fill="url(#${id})"/><path d="M12 6.5l4.2 2.6v5.8L12 17.5l-4.2-2.6V9.1z" fill="#0b0518" opacity=".32"/></svg>`;
}
const brand =
  '<div class="brand"><img src="https://duoly.gg/assets/brand/logo-mascots.webp" alt="Duoly"><span>duoly</span></div>';
const arrow =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
function send(method, params, id) {
  window.parent.postMessage(
    { jsonrpc: '2.0', method, params, ...(id === undefined ? {} : { id }) },
    '*',
  );
}
function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Host did not respond.'));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    send(method, params, id);
  });
}
function price(option, quantity = state.quantity) {
  const rows =
    state.rank && option.prices[state.rank]
      ? [option.prices[state.rank]]
      : Object.values(option.prices);
  return rows.map((row) => row[quantity - 1]).sort((a, b) => a[0] - b[0])[0];
}
function money(minor) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: card.currency,
  }).format(minor / 100);
}
function link(option) {
  const match = card.data.matches?.find((m) => m.id === option?.id);
  const url = new URL(
    match?.bookUrl ?? card.data.bookUrl ?? 'https://duoly.gg/',
  );
  url.searchParams.set('game', card.game.id);
  if (option) url.searchParams.set('service', option.id);
  if (state.rank) url.searchParams.set('rank', state.rank);
  else url.searchParams.delete('rank');
  const serverKey = card.game.id === 'mc' ? 'server' : 'region';
  url.searchParams.delete(card.game.id === 'mc' ? 'region' : 'server');
  if (state.region) url.searchParams.set(serverKey, state.region);
  else url.searchParams.delete(serverKey);
  for (const key of [
    'edition',
    'role',
    'character',
    'voice',
    'mood',
    'seats',
  ]) {
    const value = card.input[key];
    const compatible =
      key === 'role'
        ? option?.roles?.includes(value)
        : key === 'character'
          ? !!option?.characterLabel
          : key === 'edition'
            ? card.game.id === 'mc'
            : key === 'seats'
              ? value >= option?.seats?.min && value <= option?.seats?.max
              : true;
    if (value !== undefined && compatible)
      url.searchParams.set(key, String(value));
    else url.searchParams.delete(key);
  }
  if (state.quantityChosen) url.searchParams.set('qty', String(state.quantity));
  else url.searchParams.delete('qty');
  url.hash = 'modes-h';
  return url.href;
}
const label = (text, help = '') =>
  `<div class="lbl"><span>${text}</span><em>${help}</em></div>`;
function header(eyebrow, title) {
  return `<div class="top">${card.game ? icon(card.game.slug) : '<div class="gi" style="background:linear-gradient(135deg,#9b5cff,#f07bd8);display:grid;place-items:center">' + controller + '</div>'}<div><div class="eyebrow">${copy(eyebrow)}</div><h3>${copy(title)}</h3></div>${brand}</div><div class="hr"></div>`;
}
function cta(option, text, wide = false) {
  return `<a class="cta${wide ? ' wide' : ''}" href="${htmlEscape(link(option))}" target="_blank" rel="noopener" data-open>${text} ${arrow}</a>`;
}
function totals(option, coaching = false) {
  const [total, original] = price(option),
    saving = original - total;
  const budget =
    card.input.budget && card.input.currency
      ? Math.floor(card.input.budget * 100) - total
      : -1;
  return `<div class="bar"><div class="tot"><small>${state.rank || !option.ranks.length ? 'Total' : 'From'}${coaching ? ` · ${state.quantity} ${option.unit}${state.quantity > 1 ? 's' : ''}` : ''}</small><div class="row"><b id="total" data-minor="${total}">${money(total)}</b>${saving > 0 ? `<s>${money(original)}</s><span class="save">Save ${money(saving)}</span>` : ''}${coaching && budget >= 0 ? `<span class="save">Your budget ${money(Math.floor(card.input.budget * 100))} · ${money(budget)} under</span>` : ''}</div>${!coaching || state.quantity > 1 ? `<span class="per">${money(Math.round(total / state.quantity))} per ${option.unit}</span>` : ''}${card.currency === 'USD' ? '<span class="per">USD estimate</span>' : ''}</div>${cta(option, coaching ? 'Book session' : 'Book on Duoly')}</div>`;
}
function setup() {
  const ranks = [...new Set(card.options.flatMap((s) => s.ranks))];
  const regions = [...new Set(card.options.flatMap((s) => s.regions))];
  return `<div class="sec">${label('Your setup')}<div class="setup">${ranks.length ? `<button class="chip" data-rail="rank" aria-expanded="${state.rail === 'rank'}">${gem(state.rank, 'chipgem')}${copy(state.rank || 'Choose rank')}<span class="x">Change</span></button>` : ''}${regions.length ? `<button class="chip" data-rail="region" aria-expanded="${state.rail === 'region'}">${globe}${copy(state.region || 'Choose region')}<span class="x">Change</span></button>` : ''}<span class="from-chat">${card.input.rank || card.input.region || card.input.server ? 'From your message' : 'Choose your setup'}</span></div><div class="rail ${state.rail === 'rank' ? 'show' : ''}">${ranks.map((r) => `<button class="rk ${state.rank === r ? 'on' : ''}" data-rank="${htmlEscape(r)}">${gem(r, 'rank' + ranks.indexOf(r))}<small>${copy(r)}</small></button>`).join('')}</div><div class="regs ${state.rail === 'region' ? 'show' : ''}">${regions.map((r) => `<button class="sel ${state.region === r ? 'on' : ''}" data-region="${htmlEscape(r)}">${copy(r)}</button>`).join('')}</div></div>`;
}
function packs(option) {
  return `<div class="sec">${label(option.unit === 'hour' ? 'Hours' : 'Games', 'Choose a bundle')}<div class="packs">${[
    1, 3, 5, 10,
  ]
    .map((q) => {
      const p = price(option, q);
      return `<button class="pack sel ${q === state.quantity ? 'on' : ''}" aria-pressed="${q === state.quantity}" data-quantity="${q}"><b>${q}<small>${option.unit}${q > 1 ? 's' : ''}</small></b>${p[2] > 0 ? `<i>-${p[2]}%</i>` : ''}</button>`;
    })
    .join('')}</div></div>`;
}
function finder() {
  const options = card.options.filter(
      (s) => !state.rank || !s.ranks.length || s.ranks.includes(state.rank),
    ),
    selected = options.find((s) => s.id === state.service) ?? options[0];
  const coaching = options.every((s) => s.category === 'training');
  let html = header(
    `${card.game.name} · ${coaching ? 'Coaching' : 'Play together'}`,
    coaching ? 'Build your next skill' : 'Climb with a teammate',
  );
  if (!selected)
    return (
      html +
      '<p class="status">No sessions fit this budget. Increase the budget or change the goal.</p>'
    );
  html += setup();
  if (coaching) {
    html += `<div class="sec">${label('Pick a session')}<div class="opts">${options.map((s) => `<button class="opt sel ${s.id === selected.id ? 'on' : ''}" aria-pressed="${s.id === selected.id}" data-service="${htmlEscape(s.id)}"><span class="radio"></span><b>${copy(s.name)}</b><span class="opt-description" title="${copy(s.description)}">${copy(s.description)}</span><small>${money(price(s)[0])} for ${state.quantity} ${s.unit}${state.quantity > 1 ? 's' : ''}</small></button>`).join('')}</div><div class="incl">What is included</div><ul class="learn checklist"><li>${copy(selected.description)}</li></ul></div>`;
  } else {
    html += `<div class="sec">${label('Your teammate', `Price per ${selected.unit} at your rank`)}<div class="tiers">${options.map((s, i) => `<button class="tier sel ${s.id === selected.id ? 'on' : ''} ${s.id === 'duo3' ? 'apex' : i === 1 ? 'pro' : ''}" aria-pressed="${s.id === selected.id}" data-service="${htmlEscape(s.id)}"><span class="radio"></span><span class="tag">${s.id === 'duo3' ? 'Top tier' : s.badge || (price(s, 1)[0] === Math.min(...options.map((o) => price(o, 1)[0])) ? 'Lowest price' : 'Teammate')}</span><div class="tn">${copy(s.name)}</div><div class="who">${copy(s.tier)}</div><div class="pr"><b>${state.rank || !s.ranks.length ? '' : 'From '}${money(price(s, 1)[0])}</b><span>/ ${s.unit}</span></div></button>`).join('')}</div></div>`;
  }
  html += (coaching ? '' : packs(selected)) + totals(selected, coaching);
  html += `<div class="fine"><span>${coaching ? 'Never share your game password. Coaches play on their own accounts.' : 'Secure checkout on duoly.gg. A teammate accepts from the queue.'}</span><span>Account perks can lower your total at checkout.</span></div>`;
  return html;
}
function ticket() {
  const option = card.options[0];
  let html = header('Ready to book', `Your ${card.game.name} session`);
  if (!option)
    return (
      html +
      '<p class="status">Choose a service and remaining options on Duoly.</p>' +
      cta(null, 'Continue to checkout', true)
    );
  const [total, original] = price(option),
    saving = original - total;
  const incomplete =
    (!state.rank && option.ranks.length) ||
    !state.region ||
    !card.input.quantity;
  html += `<div class="ticket"><div class="tk-top">${icon(card.game.slug, 'g')}<div><div class="eyebrow">${option.category === 'training' ? 'Coaching' : 'Play together'}</div><h4>${copy(option.name)}, ${state.quantity} ${option.unit}${state.quantity > 1 ? 's' : ''}</h4><div class="tags">${[
    state.rank,
    state.region,
  ]
    .filter(Boolean)
    .map((t) => `<span class="tg">${copy(t)}</span>`)
    .join(
      '',
    )}</div></div></div><div class="perf"><i></i></div><div class="lines"><div><span>${state.quantity} ${option.unit}${state.quantity > 1 ? 's' : ''} at ${money(price(option, 1)[0])}</span><b>${money(original)}</b></div>${saving > 0 ? `<div class="disc"><span>${state.quantity}-${option.unit} bundle</span><b>-${money(saving)}</b></div>` : ''}<div class="sum"><span>${incomplete ? 'From' : 'Total'}</span><b id="total" data-minor="${total}">${money(total)}</b></div><p class="note2">Base price before account perks.${incomplete ? ' Choose remaining options on Duoly.' : ''}${card.currency === 'USD' ? ' USD estimate.' : ''}</p></div></div>`;
  html +=
    '<div class="steps"><div class="track"><i></i></div>' +
    ['Picked', 'Checkout', 'Accepted', 'Play']
      .map(
        (s, i) =>
          `<div class="st ${i === 0 ? 'done' : i === 1 ? 'now' : ''}"><i>${i === 0 ? '✓' : i + 1}</i><span>${s}</span></div>`,
      )
      .join('') +
    '</div>';
  html +=
    cta(option, 'Continue to checkout', true) +
    `<div class="link-row"><code>${copy(`duoly.gg/${card.game.slug}`)}</code><input hidden readonly aria-label="Booking link" value="${htmlEscape(link(option))}"><button class="copy" data-copy>Copy link</button></div>`;
  return html;
}
function picker() {
  return (
    header('Find a teammate', 'What are we playing?') +
    `<div class="games">${card.data.games.map((g) => `<button class="gm" data-game="${htmlEscape(g.id)}" aria-pressed="${g.id === state.game}"><div class="tile sel ${g.id === state.game ? 'on' : ''}" style="--h:#8b5cf6">${icon(g.slug, '')}<span class="ok"></span></div><span>${copy(g.name)}</span></button>`).join('')}</div><div class="modes">${[
      ['duo', 'Play together'],
      ['ranked', 'Ranked climb'],
      ['coaching', 'Coaching'],
      ['casual', 'Casual games'],
    ]
      .map(
        ([id, name]) =>
          `<button class="mode sel ${id === state.goal ? 'on' : ''}" data-goal="${id}" aria-pressed="${id === state.goal}">${name}</button>`,
      )
      .join(
        '',
      )}</div><div class="fine">${state.game ? 'Choose a mode to see matching sessions.' : 'Pick a game, then choose how to play.'}</div>`
  );
}
function render() {
  app.innerHTML =
    card.tool === 'list_games'
      ? picker()
      : card.tool === 'create_booking_link'
        ? ticket()
        : finder();
}
async function receive(result, retried = false) {
  if (result.isError) {
    app.innerHTML =
      '<p class="status">' +
      copy(
        result.content?.[0]?.text || 'Options unavailable. Try again in chat.',
      ) +
      '</p>';
    return;
  }
  const next = result._meta?.['gg.duoly/card'];
  // ext-apps #696: affected hosts retain full results on the tools/call proxy.
  // Retry this read-only tool once instead of charging model context for UI data.
  if (!next && !retried) {
    try {
      return await receive(
        await request('tools/call', { name: tool, arguments: input }),
        true,
      );
    } catch {
      // The readable answer and booking link remain available in chat.
    }
  }
  if (!next) {
    app.innerHTML =
      '<p class="status">Options could not be loaded. Use the booking link in the chat.</p>';
    return;
  }
  card = next;
  state = {
    rank: card.input.rank,
    region: card.input.region ?? card.input.server,
    quantity: card.input.quantity ?? 1,
    quantityChosen: card.input.quantity !== undefined,
    service: card.input.service ?? card.options[0]?.id,
    rail: null,
  };
  render();
}
app.addEventListener('click', async (e) => {
  const button = e.target.closest('button,a');
  if (!button || !card) return;
  if (button.hasAttribute('data-open')) {
    if (!ready) return;
    e.preventDefault();
    try {
      await request('ui/open-link', { url: button.href });
    } catch {
      button.removeAttribute('data-open');
      button.textContent = 'Open on Duoly';
    }
    return;
  }
  if (button.hasAttribute('data-copy')) {
    const field = app.querySelector('.link-row input');
    try {
      await navigator.clipboard.writeText(field.value);
      button.textContent = 'Copied';
    } catch {
      field.hidden = false;
      app.querySelector('.link-row code').hidden = true;
      field.focus();
      field.select();
      button.textContent = 'Select and copy';
    }
    return;
  }
  const d = button.dataset;
  if (d.rail) state.rail = state.rail === d.rail ? null : d.rail;
  if (d.rank) {
    state.rank = d.rank;
    state.rail = null;
  }
  if (d.region) {
    state.region = d.region;
    state.rail = null;
  }
  if (d.quantity) {
    state.quantity = Number(d.quantity);
    state.quantityChosen = true;
  }
  if (d.service) state.service = d.service;
  if (d.game) state.game = d.game;
  if (d.goal) {
    state.goal = d.goal;
    if (state.game) {
      button.disabled = true;
      try {
        receive(
          await request('tools/call', {
            name: 'find_session',
            arguments: { game: state.game, goal: state.goal },
          }),
        );
        return;
      } catch {
        button.disabled = false;
        app.querySelector('.fine').textContent =
          'Ask in chat for sessions in this game and mode.';
        return;
      }
    }
  }
  render();
});
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data || e.data.jsonrpc !== '2.0') return;
  const m = e.data;
  if (pending.has(m.id)) {
    const p = pending.get(m.id);
    clearTimeout(p.timer);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result);
    return;
  }
  if (m.method === 'ui/notifications/tool-input')
    input = m.params?.arguments ?? {};
  if (m.method === 'ui/notifications/tool-result') receive(m.params ?? {});
  if (m.method === 'ui/notifications/tool-cancelled')
    app.innerHTML =
      '<p class="status">Session search cancelled. Try again in chat.</p>';
  if (m.method === 'ui/resource-teardown') {
    window.parent.postMessage({ jsonrpc: '2.0', id: m.id, result: {} }, '*');
  }
});
function measureSize() {
  const doc = document.documentElement,
    scroll = doc?.scrollHeight ?? 0;
  // The document never shrinks below the iframe viewport, so report the
  // content edge unless real overflow makes the document taller.
  return {
    height: Math.ceil(
      scroll > (doc?.clientHeight ?? 0)
        ? scroll
        : (app.getBoundingClientRect?.().bottom ?? 0),
    ),
  };
}
function reportSize() {
  if (ready) send('ui/notifications/size-changed', measureSize());
}
new ResizeObserver(reportSize).observe(app);
window.addEventListener('resize', reportSize);
document.addEventListener?.('load', reportSize, true);
document.fonts?.ready.then(reportSize);
request('ui/initialize', {
  protocolVersion: '2026-01-26',
  appInfo: { name: 'Duoly cards', version: '1.0.0' },
  appCapabilities: {},
  ...measureSize(),
})
  .then(() => {
    ready = true;
    send('ui/notifications/initialized', {});
    reportSize();
  })
  .catch(() => {
    app.innerHTML =
      '<p class="status">This host could not connect the card. Use the booking link in the chat.</p>';
  });
// Tool input is retained for diagnostics without inferring any player selections.
void tool;
void input;
