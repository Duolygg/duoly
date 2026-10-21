// Shared helpers for the admin dashboard.

// Turns a CSS declaration string ("color: red; margin-top: 4px") into a React style object.
export function css(str) {
  const out = {};
  String(str || '').split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!k) return;
    out[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val;
  });
  return out;
}

export const DISPLAY = "'Bricolage Grotesque', sans-serif";
export const C = {
  bg: '#090414', panel: '#120B22', raised: '#1B1033', line: 'rgba(196, 170, 255, .08)', line2: 'rgba(196, 170, 255, .14)',
  text: '#F3EEFF', white: '#FFFFFF', muted: '#A79DC4', dim: '#8E84AB', faint: '#6A6086',
  accent: '#D6BBFF', ink: '#17092E', green: '#5EEAA8', pink: '#F0A6FF', gold: '#FFD27A', cyan: '#9EE6FF', red: '#FF8A9B'
};

export const card = { borderRadius: '20px', background: C.panel, border: '1px solid ' + C.line };
export const h2 = { margin: '0', fontFamily: DISPLAY, fontSize: '20px', fontWeight: '700', letterSpacing: '-.02em', color: C.white };
export const th = { padding: '10px 12px', fontSize: '11.5px', fontWeight: '600', letterSpacing: '.06em', textTransform: 'uppercase', color: C.faint, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid ' + C.line };
export const td = { padding: '12px', fontSize: '14px', color: C.text, borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' };

export const eur = (n) => '€' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eur0 = (n) => '€' + Math.round(n).toLocaleString('en-US');
export const num = (n) => Math.round(n).toLocaleString('en-US');

export function ago(ts, now) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : d + ' days ago';
}
export const dateTime = (ts) => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const dateOnly = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Status pills: [background, text]
const PILL = {
  Queued: ['rgba(255, 210, 122, .12)', C.gold], 'In progress': ['rgba(158, 230, 255, .12)', C.cyan],
  Completed: ['rgba(94, 234, 168, .12)', C.green], Refunded: ['rgba(196, 170, 255, .12)', C.accent],
  Cancelled: ['rgba(142, 132, 171, .14)', C.dim], Disputed: ['rgba(255, 138, 155, .14)', C.red],
  Open: ['rgba(255, 138, 155, .14)', C.red], Resolved: ['rgba(94, 234, 168, .12)', C.green], Dismissed: ['rgba(142, 132, 171, .14)', C.dim],
  Pending: ['rgba(255, 210, 122, .12)', C.gold], Approved: ['rgba(94, 234, 168, .12)', C.green], Rejected: ['rgba(142, 132, 171, .14)', C.dim],
  Scheduled: ['rgba(158, 230, 255, .12)', C.cyan], Paid: ['rgba(94, 234, 168, .12)', C.green], 'On hold': ['rgba(255, 138, 155, .14)', C.red],
  online: ['rgba(94, 234, 168, .12)', C.green], offline: ['rgba(142, 132, 171, .14)', C.dim], Suspended: ['rgba(255, 138, 155, .14)', C.red],
  Active: ['rgba(94, 234, 168, .12)', C.green], Blocked: ['rgba(255, 138, 155, .14)', C.red]
};
export const pill = (status) => {
  const [bg, fg] = PILL[status] || ['rgba(196, 170, 255, .1)', C.muted];
  return { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', background: bg, color: fg, whiteSpace: 'nowrap' };
};
export const dot = (color) => ({ width: '6px', height: '6px', borderRadius: '50%', background: color, flex: '0 0 auto' });

export const btn = (kind) => {
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '40px', padding: '0 14px', borderRadius: '12px', fontSize: '13.5px', fontWeight: '600', whiteSpace: 'nowrap' };
  if (kind === 'primary') return { ...base, border: 'none', background: C.accent, color: C.ink, fontWeight: '700' };
  if (kind === 'danger') return { ...base, border: '1px solid rgba(255, 138, 155, .35)', background: 'rgba(255, 138, 155, .08)', color: C.red };
  if (kind === 'good') return { ...base, border: 'none', background: C.green, color: '#062A1B', fontWeight: '700' };
  return { ...base, border: '1px solid ' + C.line2, background: 'transparent', color: C.text };
};
export const chip = (active) => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '34px', padding: '0 12px', borderRadius: '999px', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap',
  ...(active ? { background: C.text, color: C.ink, border: '1px solid ' + C.text } : { background: 'transparent', color: '#CFC4EA', border: '1px solid ' + C.line2 })
});
export const input = { minHeight: '40px', padding: '0 12px', borderRadius: '12px', background: C.bg, border: '1px solid ' + C.line2, color: C.white, fontSize: '14px', fontFamily: 'inherit', minWidth: '0' };
