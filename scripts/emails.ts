/**
 * Email build tasks. Runs directly with Node type stripping (no build step):
 *
 *   node scripts/emails.ts supabase          write supabase/templates/*.html from the auth templates
 *   node scripts/emails.ts preview <dir>     write a self-contained preview gallery (assets inlined)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  authEmails,
  renderAuth,
  renderTransactional,
  transactionalEmails,
  type AuthEmailId,
  type TransactionalEmailId,
} from '../src/server/email/catalog.ts';
import { samples } from '../src/server/email/samples.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_ORIGIN = 'https://duoly.gg';

function writeSupabase(): void {
  const dir = join(root, 'supabase/templates');
  mkdirSync(dir, { recursive: true });
  for (const id of Object.keys(authEmails) as AuthEmailId[]) {
    const { html } = renderAuth(id, {
      siteUrl: '{{ .SiteURL }}',
      assetOrigin: PUBLIC_ORIGIN,
    });
    writeFileSync(join(dir, `${id}.html`), html);
    console.log(`supabase/templates/${id}.html`);
  }
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

function inlineAssets(markup: string): string {
  return markup.replace(
    /https:\/\/duoly\.gg(\/(?:email|assets|fonts)\/[^"')\s]+)/g,
    (match, path: string) => {
      try {
        const bytes = readFileSync(join(root, 'public', path));
        return `data:${MIME[extname(path)] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`;
      } catch {
        return match;
      }
    },
  );
}

function writePreview(outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  const entries: {
    id: string;
    group: string;
    subject: string;
    trigger: string;
    html: string;
    text: string;
  }[] = [];
  const authLabels: Record<AuthEmailId, string> = {
    confirmation: 'Supabase: sign-up confirmation',
    recovery: 'Supabase: password reset requested',
    email_change: 'Supabase: email change requested',
    reauthentication: 'Supabase: reauthentication code',
    password_changed: 'Supabase notification: password changed',
    email_changed: 'Supabase notification: email changed',
  };
  for (const id of Object.keys(authEmails) as AuthEmailId[]) {
    const rendered = renderAuth(id, {
      siteUrl: PUBLIC_ORIGIN,
      assetOrigin: PUBLIC_ORIGIN,
    });
    const fill = (value: string) =>
      value
        .replaceAll(
          '{{ .ConfirmationURL }}',
          'https://duoly.gg/auth/callback?code=preview',
        )
        .replaceAll('{{ .Email }}', 'lea@example.com')
        .replaceAll('{{ .NewEmail }}', 'lea.plays@example.com')
        .replaceAll('{{ .OldEmail }}', 'lea@example.com')
        .replaceAll('{{ .Token }}', '482915')
        .replaceAll('{{ .SiteURL }}', PUBLIC_ORIGIN);
    entries.push({
      id,
      group: 'Account (sent by Supabase Auth)',
      subject: fill(rendered.subject),
      trigger: authLabels[id],
      html: inlineAssets(fill(rendered.html)),
      text: fill(rendered.text),
    });
  }
  const groups: Record<TransactionalEmailId, string> = {
    welcome: 'Account',
    order_confirmed: 'Orders',
    teammate_found: 'Orders',
    order_completed: 'Orders',
    order_cancelled: 'Orders',
    level_up: 'Rewards',
    application_received: 'Teammates',
    application_approved: 'Teammates',
    application_declined: 'Teammates',
    payout: 'Teammates',
    support_reply: 'Support',
  };
  for (const id of Object.keys(transactionalEmails) as TransactionalEmailId[]) {
    const rendered = renderTransactional(id, samples[id] as never, {
      siteUrl: PUBLIC_ORIGIN,
      assetOrigin: PUBLIC_ORIGIN,
    });
    entries.push({
      id,
      group: groups[id],
      subject: rendered.subject,
      trigger: transactionalEmails[id].trigger,
      html: inlineAssets(rendered.html),
      text: rendered.text,
    });
  }
  for (const entry of entries)
    writeFileSync(join(outDir, `${entry.id}.html`), entry.html);
  writeFileSync(join(outDir, 'index.html'), gallery(entries));
  console.log(`${entries.length} emails -> ${join(outDir, 'index.html')}`);
}

function gallery(
  entries: {
    id: string;
    group: string;
    subject: string;
    trigger: string;
    html: string;
    text: string;
  }[],
): string {
  const data = JSON.stringify(entries).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Duoly email previews</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#05020c;color:#F3EEFF}
.app{display:grid;grid-template-columns:270px 1fr;height:100vh}
nav{border-right:1px solid #1E1533;overflow:auto;padding:18px 12px;background:#0B0618}
nav h1{font-size:15px;margin:0 8px 14px;color:#D6BBFF}nav h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6A6086;margin:16px 8px 6px}
nav button{display:block;width:100%;text-align:left;background:none;border:0;color:#A79DC4;padding:8px 10px;border-radius:10px;font:inherit;font-size:13.5px;cursor:pointer}
nav button.on{background:#1B1033;color:#fff}
main{display:flex;flex-direction:column;min-width:0}
header{padding:14px 20px;border-bottom:1px solid #1E1533;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.meta{flex:1;min-width:240px}.subj{font-weight:700}.trig{font-size:12.5px;color:#8E84AB;margin-top:3px}
.seg{display:flex;background:#120B22;border:1px solid #261A40;border-radius:11px;padding:3px}
.seg button{background:none;border:0;color:#A79DC4;padding:6px 12px;border-radius:8px;font:inherit;font-size:13px;cursor:pointer}.seg button.on{background:#D6BBFF;color:#17092E;font-weight:700}
.stage{flex:1;overflow:auto;display:flex;justify-content:center;padding:24px;background:repeating-conic-gradient(#07030f 0 25%,#090414 0 50%) 0 0/24px 24px}
iframe{border:0;background:#090414;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);height:100%;min-height:900px}
pre{white-space:pre-wrap;max-width:640px;width:100%;background:#120B22;border:1px solid #261A40;border-radius:14px;padding:20px;font-size:13px;line-height:1.55;color:#CFC4EA;margin:0}
</style></head><body><div class="app"><nav id="nav"><h1>✦ Duoly emails</h1></nav><main><header><div class="meta"><div class="subj" id="subj"></div><div class="trig" id="trig"></div></div>
<div class="seg" id="view"><button data-v="desktop" class="on">Desktop</button><button data-v="mobile">Mobile</button><button data-v="text">Plain text</button></div></header>
<div class="stage" id="stage"></div></main></div>
<script>
const E=${data};let cur=0,view='desktop';const nav=document.getElementById('nav');let g='';
E.forEach((e,i)=>{if(e.group!==g){g=e.group;const h=document.createElement('h2');h.textContent=g;nav.appendChild(h)}const b=document.createElement('button');b.textContent=e.trigger;b.onclick=()=>{cur=i;draw()};b.dataset.i=i;nav.appendChild(b)});
document.querySelectorAll('#view button').forEach(b=>b.onclick=()=>{view=b.dataset.v;document.querySelectorAll('#view button').forEach(x=>x.classList.toggle('on',x===b));draw()});
function draw(){const e=E[cur];document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',+b.dataset.i===cur));
document.getElementById('subj').textContent=e.subject;document.getElementById('trig').textContent=e.id+' · '+e.trigger;const s=document.getElementById('stage');s.innerHTML='';
if(view==='text'){const p=document.createElement('pre');p.textContent=e.text;s.appendChild(p);return}
const f=document.createElement('iframe');f.style.width=view==='mobile'?'390px':'720px';f.srcdoc=e.html;s.appendChild(f);
f.onload=()=>{try{f.style.height=f.contentDocument.documentElement.scrollHeight+'px'}catch(_){}}}
draw();
</script></body></html>`;
}

const [task, arg] = process.argv.slice(2);
if (task === 'supabase') writeSupabase();
else if (task === 'preview') writePreview(resolve(arg ?? 'email-preview'));
else {
  console.error('Usage: node scripts/emails.ts supabase | preview <dir>');
  process.exit(1);
}
