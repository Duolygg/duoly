/* global window, document, ResizeObserver, setTimeout, clearTimeout */
// Input exists only in memory until a single host-compatibility retry finishes.
// Never put a token in the DOM, storage, URLs, logs or analytics.
let inputToken = null,
  recovered = false;
const app = document.getElementById('app');
let ready = false,
  serial = 0;
const pending = new Map();
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const time = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
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
      reject(new Error('Host unavailable'));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    send(method, params, id);
  });
}
function size() {
  if (ready)
    send('ui/notifications/size-changed', {
      height: Math.ceil(app.getBoundingClientRect().bottom),
    });
}
async function receive(result) {
  if (
    !result.isError &&
    !result._meta?.['gg.duoly/card'] &&
    inputToken &&
    !recovered
  ) {
    recovered = true;
    const token = inputToken;
    inputToken = null;
    try {
      result = await request('tools/call', {
        name: 'get_order_status',
        arguments: { token },
      });
    } catch {
      result = { isError: true };
    }
  }
  inputToken = null;
  render(result);
}
function render(result) {
  const d = result._meta?.['gg.duoly/card'];
  if (result.isError || !d) {
    app.textContent = 'Order status unavailable. Ask your AI to check again.';
    size();
    return;
  }
  const done = d.status === 'completed',
    cancelled = d.status === 'cancelled',
    waiting = d.team?.status === 'waiting';
  const current = done ? 3 : d.accepted && !waiting ? 2 : 1;
  const name = d.teammateDisplayName;
  const label = cancelled
    ? 'Cancelled'
    : done
      ? 'Complete'
      : waiting
        ? 'Filling seats'
        : d.accepted
          ? 'Teammate found'
          : 'Searching';
  const title = cancelled
    ? 'This order was cancelled'
    : done
      ? 'GG. Session complete.'
      : waiting
        ? 'Building your team'
        : d.accepted
          ? `${name || 'Your teammate'} is in.`
          : 'Finding your teammate';
  const orb = d.accepted
    ? `<div class="burst"></div><div class="av ${done ? 'done-av' : ''}">${esc((name || '?').slice(0, 1).toUpperCase())}</div>`
    : '<div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div><div class="sweep"></div><div class="core q">?</div>';
  const elapsed = Math.max(
    0,
    Math.floor((Date.parse(d.updatedAt) - Date.parse(d.searchingAt)) / 1000),
  );
  const timer = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const steps = [
    'Booked',
    waiting ? 'Filling seats' : 'Searching',
    d.team ? 'Team ready' : 'Teammate found',
    'Done',
  ];
  const stamps = [
    time(d.bookedAt),
    waiting ? `${d.team.filled} of ${d.team.seats} taken` : time(d.searchingAt),
    time(d.acceptedAt),
    time(d.completedAt),
  ];
  const seats = d.team
    ? `<div class="seats" style="grid-template-columns:repeat(${d.team.seats},minmax(0,1fr))">${d.team.members
        .map((m) => {
          const taken = ['in_progress', 'completed'].includes(m.status);
          return `<div class="seat ${taken ? 'taken' : 'open'} ${m.thisSeat ? 'you' : ''}">${m.thisSeat ? '<span class="you-t">You</span>' : ''}${taken ? '<span class="ok"></span>' : ''}<div class="a">${taken ? esc((m.name || '?').slice(0, 1)) : '<span class="pulse"></span>'}</div><small>${taken ? esc(m.name || 'Teammate') : 'Finding player'}</small></div>`;
        })
        .join(
          '',
        )}</div>${waiting ? '<div class="rule">Nobody starts until every seat is taken</div>' : ''}`
    : '';
  const room = /^https:\/\/duoly\.gg\/queue\/[0-9a-f-]{36}$/.test(d.roomUrl)
    ? d.roomUrl
    : null;
  const cta = done
    ? 'Leave a review'
    : d.accepted && !waiting
      ? `Message ${name || 'your teammate'}`
      : 'Open your order room';
  app.innerHTML = `<article class="dw"><div class="top">${d.gameSlug && /^[a-z0-9-]+$/.test(d.gameSlug) ? `<img class="gi" src="https://duoly.gg/assets/games/${esc(d.gameSlug)}.png" alt="">` : ''}<div><div class="eyebrow">Your Duoly order</div><h3>${esc(d.gameName || d.game)} · ${esc(d.title)}</h3></div><div class="brand"><img src="https://duoly.gg/assets/brand/logo-mascots.webp" alt=""><span>duoly</span></div></div><div class="hr"></div>${d.team ? '' : `<div class="hero"><div class="orb">${orb}</div><div><div class="state-k ${done ? 'ok' : ''}">${esc(label)}</div><h2 class="headline">${esc(title)}</h2><p class="sub">${!d.accepted && !cancelled ? `Searching · <span class="timer">${timer}</span> so far<br>` : ''}${esc(d.nextStep)}</p></div></div>`}${seats}<div class="journey"><div class="steps"><div class="track"><i style="width:${(current / 3) * 100}%"></i></div>${steps.map((s, i) => `<div class="st ${i < current ? 'done' : i === current ? 'now' : ''}"><i>${i < current ? '✓' : i + 1}</i><small>${s}</small><em>${esc(stamps[i])}</em></div>`).join('')}</div></div><div class="strip"><div><div class="t">${esc(d.title)}</div><div class="tags"><span class="tg">${esc(d.quantity.value)} ${esc(d.quantity.unit)}${d.quantity.value > 1 ? 's' : ''}</span>${d.rank ? `<span class="tg">${esc(d.rank)}</span>` : ''}${d.region ? `<span class="tg">${esc(d.region)}</span>` : ''}</div></div><div class="paid"><b>${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(d.paidEurMinor / 100)}</b><small>Paid</small></div></div>${room ? `<div class="cta-row"><a class="cta" href="${esc(room)}" target="_blank" rel="noopener">${esc(cta)} ↗</a></div>` : ''}<div class="fine">${!d.accepted && !cancelled ? '<span>Duoly emails you the moment someone accepts</span>' : ''}<span>Updated ${esc(time(d.updatedAt))}</span><span>Read only. Email and card details stay private.</span></div></article>`;
  app.querySelector('a')?.addEventListener('click', (e) => {
    e.preventDefault();
    request('ui/open-link', { url: room }).catch(() => {
      app.querySelector('a').textContent = 'Open your order room on Duoly';
    });
  });
  size();
}
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || e.data?.jsonrpc !== '2.0') return;
  const m = e.data,
    p = pending.get(m.id);
  if (p) {
    clearTimeout(p.timer);
    pending.delete(m.id);
    if (m.error) p.reject(new Error('Host unavailable'));
    else p.resolve(m.result);
    return;
  }
  if (m.method === 'ui/notifications/tool-input' && !recovered)
    inputToken = /^dos_[A-Za-z0-9_-]{43}$/.test(m.params?.arguments?.token)
      ? m.params.arguments.token
      : null;
  if (m.method === 'ui/notifications/tool-result') receive(m.params ?? {});
  if (m.method === 'ui/notifications/tool-cancelled') {
    inputToken = null;
    recovered = true;
    app.textContent = 'Order check cancelled.';
    size();
  }
  if (m.method === 'ui/resource-teardown')
    window.parent.postMessage({ jsonrpc: '2.0', id: m.id, result: {} }, '*');
});
new ResizeObserver(size).observe(app);
window.addEventListener('resize', size);
document.fonts?.ready.then(size);
request('ui/initialize', {
  protocolVersion: '2026-01-26',
  appInfo: { name: 'Duoly order status', version: '1.0.0' },
  appCapabilities: {},
})
  .then(() => {
    ready = true;
    send('ui/notifications/initialized', {});
    size();
  })
  .catch(() => {
    app.textContent = 'Ask your AI to check your order again.';
  });
