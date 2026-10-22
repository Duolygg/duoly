import { markup as m, raw, safeUrl, type SafeHtml } from './html.ts';
import type { Block, EmailContent, EmailContext, Tone } from './model.ts';
import { color, font, loyaltyTiers } from './theme.ts';

/**
 * Email-safe rendering of the shared content model.
 *
 * Rules: table layout, inline styles for every client, one <style> block for progressive
 * enhancement (fonts, motion, responsive tweaks). Clients that ignore <style> still get the
 * full static design. Motion respects prefers-reduced-motion.
 *
 * The tag is deliberately not named `html`: Prettier would reformat the markup and split
 * Outlook conditional comments across lines.
 */

const toneColor: Record<Tone, string> = {
  safe: color.green,
  info: color.lavender,
  warn: color.red,
  gold: color.gold,
};

function asset(ctx: EmailContext, path: string): string {
  if (/^(https?:|data:)/.test(path)) return path;
  return `${ctx.assetOrigin.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Gmail's iOS and Android apps invert colours in dark mode, which turns this dark design light.
 * They leave background images alone, so every solid surface also gets a same-colour gradient,
 * and text is wrapped in the blend-mode pair below, which only Gmail matches (`u + .body`).
 * The rules live in their own <style> block because Gmail drops a whole block it cannot parse.
 * Technique: https://www.hteumeuleu.com/2021/fixing-gmail-dark-mode-css-blend-modes/
 */
const GMAIL_STYLE =
  '<style>u + .body .gm-s{background:#000;mix-blend-mode:screen}u + .body .gm-d{background:#000;mix-blend-mode:difference}</style>';

const BLANK_TEXT = /^(?:\s|&nbsp;|&#8199;|&#847;)*$/;

export function gmailDarkMode(doc: string): string {
  const start = doc.indexOf('<body');
  if (start < 0) return doc;
  const head = doc
    .slice(0, start)
    .replace('</head>', `${GMAIL_STYLE}\n</head>`);
  const body = doc
    .slice(start)
    .split(/(<!--[\s\S]*?-->)/)
    .map((part) =>
      part.startsWith('<!--')
        ? part
        : part
            .replace(/style="([^"]*)"/g, (all, style: string) => {
              const solid =
                /background(?:-color)?:(#[0-9A-Fa-f]{6})(?=;|$)/.exec(style);
              if (!solid || /background-image|gradient/.test(style)) return all;
              return `style="${style.replace(/;?$/, ';')}background-image:linear-gradient(${solid[1]},${solid[1]});"`;
            })
            .replace(/>([^<>]+)</g, (all, text: string) =>
              BLANK_TEXT.test(text)
                ? all
                : `><span class="gm-s"><span class="gm-d">${text}</span></span><`,
            ),
    )
    .join('');
  return head + body;
}

function styleBlock(ctx: EmailContext): SafeHtml {
  const fonts = asset(ctx, '/fonts');
  // Author-controlled CSS only. Keyframes mirror the site (dlonline, dlfloat, lbshine).
  return raw(`<style>
@font-face{font-family:'Bricolage Grotesque';font-style:normal;font-weight:200 800;font-display:swap;src:url('${fonts}/bricolage-grotesque-latin.woff2') format('woff2')}
@font-face{font-family:Geist;font-style:normal;font-weight:100 900;font-display:swap;src:url('${fonts}/geist-latin.woff2') format('woff2')}
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0!important;padding:0!important;background:${color.page}!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
a{color:${color.link}}
.dl-btn a:hover{filter:brightness(1.06)}
@keyframes dlonline{0%{box-shadow:0 0 0 0 rgba(94,234,168,.65)}70%{box-shadow:0 0 0 8px rgba(94,234,168,0)}100%{box-shadow:0 0 0 0 rgba(94,234,168,0)}}
@keyframes dlping{0%{box-shadow:0 0 0 0 rgba(214,187,255,.6)}70%{box-shadow:0 0 0 10px rgba(214,187,255,0)}100%{box-shadow:0 0 0 0 rgba(214,187,255,0)}}
@keyframes dltwinkle{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes dlshine{0%{background-position:160% 0}60%,100%{background-position:-60% 0}}
@keyframes dlscan{0%{background-position:-40% 0}100%{background-position:140% 0}}
@keyframes dlpop{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:none}}
.dl-online{animation:dlonline 1.8s cubic-bezier(0,0,.2,1) infinite}
.dl-ping{animation:dlping 1.8s cubic-bezier(0,0,.2,1) infinite}
.dl-twinkle{display:inline-block;animation:dltwinkle 2.4s ease-in-out infinite}
.dl-shine{background-image:linear-gradient(110deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.45) 50%,rgba(255,255,255,0) 65%)!important;background-size:250% 100%!important;background-repeat:no-repeat!important;animation:dlshine 3.6s ease-in-out infinite}
.dl-scan{background-image:linear-gradient(90deg,rgba(214,187,255,0),rgba(214,187,255,.9),rgba(214,187,255,0))!important;background-size:40% 100%!important;background-repeat:no-repeat!important;animation:dlscan 1.8s linear infinite}
.dl-pop{animation:dlpop .6s ease-out both}
.dl-bg{background-image:radial-gradient(70% 340px at 50% 0%,rgba(214,187,255,.13),rgba(9,4,20,0)),linear-gradient(${color.page},${color.page})!important}
@supports (-webkit-background-clip:text){.dl-grad{background:linear-gradient(90deg,${color.lavender},${color.pink} 55%,${color.gold});-webkit-background-clip:text;background-clip:text;color:transparent!important}}
@media (prefers-reduced-motion:reduce){.dl-online,.dl-ping,.dl-twinkle,.dl-shine,.dl-scan,.dl-pop{animation:none!important}}
@media only screen and (max-width:620px){
.dl-shell{width:100%!important}
.dl-pad{padding-left:22px!important;padding-right:22px!important}
.dl-card-pad{padding:28px 18px!important}
.dl-h1{font-size:29px!important;line-height:33px!important}
.dl-stack{display:block!important;width:100%!important;box-sizing:border-box}
.dl-stack-gap{padding:0 0 10px 0!important}
.dl-hide-sm{display:none!important}
.dl-full a{display:block!important;text-align:center}
.dl-step-label{font-size:11px!important}
.dl-stat{padding:12px 10px!important}
.dl-stat-value{font-size:18px!important;line-height:22px!important}
.dl-btn-table{width:100%!important}
}
</style>`);
}

const td = (style: string) => `font-family:${font.body};${style}`;

function eyebrow(text: string): SafeHtml {
  return m`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="${td(
    `padding:6px 12px;border-radius:999px;background:${color.raised};border:1px solid #2E2150;font-size:13px;line-height:16px;font-weight:600;color:${color.lavender};`,
  )}"><span class="dl-twinkle" style="color:${color.pink};">&#10022;</span>&nbsp; ${text}</td></tr></table>`;
}

function title(content: EmailContent): SafeHtml {
  const accent = content.titleAccent
    ? m`<br><span class="dl-grad" style="color:${color.lavender};">${content.titleAccent}</span>`
    : '';
  return m`<h1 class="dl-h1" style="margin:18px 0 0;font-family:${font.display};font-weight:800;font-size:36px;line-height:39px;letter-spacing:-1.2px;color:${color.white};">${content.title}${accent}</h1>`;
}

function paragraph(block: Extract<Block, { type: 'paragraph' }>): SafeHtml {
  const strong = block.strong
    ? m`<strong style="color:${color.text};font-weight:600;">${block.strong}</strong> `
    : '';
  return m`<p style="margin:16px 0 0;font-family:${font.body};font-size:16px;line-height:26px;color:${color.body};">${strong}${block.text}</p>`;
}

function button(block: Extract<Block, { type: 'button' }>): SafeHtml {
  const url = safeUrl(block.url);
  const primary = m`<td class="dl-btn dl-full dl-stack dl-stack-gap" style="padding:0 10px 0 0;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="25%" stroke="f" fillcolor="${color.lavender}"><w:anchorlock/><center style="color:${color.onLavender};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${block.label} &#8594;</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${url}" class="dl-shine" style="display:inline-block;background-color:${color.lavender};color:${color.onLavender};font-family:${font.body};font-size:16px;line-height:20px;font-weight:700;text-decoration:none;padding:16px 26px;border-radius:13px;mso-hide:all;">${block.label}&nbsp;&#8594;</a><!--<![endif]-->
</td>`;
  const secondary = block.secondary
    ? m`<td class="dl-full dl-stack" style="padding:0;"><a href="${safeUrl(block.secondary.url)}" style="display:inline-block;background-color:${color.page};color:${color.text};font-family:${font.body};font-size:16px;line-height:20px;font-weight:600;text-decoration:none;padding:15px 22px;border-radius:13px;border:1px solid #3A2C5C;">${block.secondary.label}</a></td>`
    : '';
  return m`<table role="presentation" class="dl-btn-table" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;"><tr>${primary}${secondary}</tr></table>`;
}

function linkFallback(
  block: Extract<Block, { type: 'linkFallback' }>,
): SafeHtml {
  const url = safeUrl(block.url);
  return m`<p style="margin:22px 0 0;font-family:${font.body};font-size:13px;line-height:20px;color:${color.muted};">Button not working? Paste this link into your browser:<br><a href="${url}" style="color:${color.lavender};word-break:break-all;">${url}</a></p>`;
}

function statusPill(label: string, tone: 'live' | 'done' | 'off'): SafeHtml {
  const c =
    tone === 'live'
      ? color.lavender
      : tone === 'done'
        ? color.green
        : color.red;
  const dotClass =
    tone === 'live' ? 'dl-ping' : tone === 'done' ? 'dl-online' : '';
  return m`<span style="display:inline-block;font-family:${font.body};font-size:11.5px;line-height:14px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${c};"><span class="${dotClass}" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};vertical-align:1px;"></span>&nbsp; ${label}</span>`;
}

function order(
  ctx: EmailContext,
  block: Extract<Block, { type: 'order' }>,
): SafeHtml {
  const status = block.status
    ? m`<div style="margin:0 0 6px;">${statusPill(block.status.label, block.status.tone)}</div>`
    : '';
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;background:${color.inset};border:1px solid ${color.border};border-radius:18px;">
<tr><td style="padding:18px;" width="56" valign="middle"><img src="${asset(ctx, block.gameIcon)}" width="52" height="52" alt="${block.gameName}" style="display:block;width:52px;height:52px;border-radius:14px;"></td>
<td style="${td('padding:18px 18px 18px 0;')}" valign="middle">${status}<div style="font-family:${font.display};font-size:18px;line-height:22px;font-weight:800;letter-spacing:-.3px;color:${color.white};">${block.title}</div><div style="margin-top:4px;font-size:13.5px;line-height:19px;color:${color.muted};">${block.meta.join(' · ')}</div></td></tr></table>`;
}

function details(block: Extract<Block, { type: 'details' }>): SafeHtml {
  const heading = block.title
    ? m`<tr><td colspan="2" style="${td(`padding:18px 20px 4px;font-size:11.5px;line-height:14px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${color.muted};`)}">${block.title}</td></tr>`
    : '';
  const rows = block.rows.map((row, index) => {
    const top = index === 0 && !block.title ? 18 : 10;
    return m`<tr><td style="${td(`padding:${top}px 0 10px 20px;font-size:14.5px;line-height:20px;color:${color.muted};`)}">${row.label}</td><td align="right" width="1%" style="${td(`padding:${top}px 20px 10px 12px;font-size:14.5px;line-height:20px;font-weight:600;white-space:nowrap;color:${row.accent ? color.green : color.text};`)}">${row.value}</td></tr>`;
  });
  const total = block.total
    ? m`<tr><td colspan="2" style="padding:6px 20px 0;"><div style="height:1px;line-height:1px;font-size:1px;background:${color.hairline};">&nbsp;</div></td></tr>
<tr><td style="${td(`padding:14px 0 18px 20px;font-size:15px;line-height:20px;font-weight:600;color:${color.text};`)}">${block.total.label}</td><td align="right" width="1%" style="padding:14px 20px 18px 12px;font-family:${font.display};font-size:22px;line-height:26px;font-weight:800;letter-spacing:-.4px;white-space:nowrap;color:${color.white};">${block.total.value}</td></tr>`
    : m`<tr><td colspan="2" style="height:8px;line-height:8px;font-size:1px;">&nbsp;</td></tr>`;
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:${color.inset};border:1px solid ${color.border};border-radius:18px;">${heading}${rows}${total}</table>`;
}

function steps(block: Extract<Block, { type: 'steps' }>): SafeHtml {
  const width = Math.floor(100 / block.steps.length);
  const last = block.steps.length - 1;
  const cells = block.steps.map((step, index) => {
    const isDone = step.state === 'done';
    const isActive = step.state === 'active';
    const bg = isDone ? color.green : isActive ? color.lavender : color.page;
    const border = isDone ? color.green : isActive ? color.lavender : '#3A2C5C';
    const ink = isDone
      ? color.greenInk
      : isActive
        ? color.onLavender
        : color.muted;
    const glyph = isDone ? raw('&#10003;') : String(index + 1);
    const labelColor = isDone || isActive ? color.text : color.muted;
    const left =
      index === 0
        ? m`<td width="50%"></td>`
        : m`<td width="50%" style="padding:0;"><div style="height:2px;line-height:2px;font-size:1px;background:${block.steps[index - 1]?.state === 'done' ? color.green : '#2A1F45'};">&nbsp;</div></td>`;
    const right =
      index === last
        ? m`<td width="50%"></td>`
        : m`<td width="50%" style="padding:0;"><div ${isActive ? raw('class="dl-scan"') : ''} style="height:2px;line-height:2px;font-size:1px;background-color:${isDone ? color.green : '#2A1F45'};">&nbsp;</div></td>`;
    return m`<td width="${width}%" align="center" valign="top" style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${left}<td width="30" style="padding:0;"><div class="${isActive ? 'dl-ping' : ''}" style="width:28px;height:28px;border-radius:50%;background:${bg};border:1px solid ${border};font-family:${font.body};font-size:13px;line-height:28px;font-weight:800;color:${ink};text-align:center;">${glyph}</div></td>${right}</tr></table>
<div class="dl-step-label" style="${td(`margin-top:9px;font-size:12.5px;line-height:16px;font-weight:${isActive ? 700 : 500};color:${labelColor};`)}">${step.label}</div></td>`;
  });
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;"><tr>${cells}</tr></table>`;
}

function teammate(
  ctx: EmailContext,
  block: Extract<Block, { type: 'teammate' }>,
): SafeHtml {
  const flag = block.flag
    ? m`<img src="${asset(ctx, block.flag)}" width="18" height="13" alt="${block.country ?? ''}" style="display:inline-block;width:18px;height:13px;border-radius:2px;vertical-align:-1px;">&nbsp;`
    : '';
  const meta = [block.rank, block.country].filter(Boolean).join(' · ');
  const rating = block.rating
    ? m`<td align="right" valign="top" style="${td(`padding:20px 20px 0 0;font-size:15px;line-height:20px;font-weight:700;color:${color.gold};white-space:nowrap;`)}">&#9733; ${block.rating}</td>`
    : '';
  const status = block.status
    ? m`<div style="margin:0 0 6px;"><span style="font-family:${font.body};font-size:11.5px;line-height:14px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${color.green};"><span class="dl-online" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color.green};vertical-align:1px;"></span>&nbsp; ${block.status}</span></div>`
    : '';
  const languages = block.languages?.length
    ? m`<tr><td colspan="3" style="padding:0 20px 4px;">${block.languages.map(
        (language) =>
          m`<span style="display:inline-block;margin:0 6px 8px 0;padding:5px 10px;border-radius:999px;background:${color.raised};border:1px solid #2E2150;font-family:${font.body};font-size:12px;line-height:14px;font-weight:600;color:${color.link};">${language}</span>`,
      )}</td></tr>`
    : '';
  const bio = block.bio
    ? m`<tr><td colspan="3" style="${td(`padding:4px 20px 20px;font-size:14.5px;line-height:22px;color:${color.body};font-style:italic;`)}">&#8220;${block.bio}&#8221;</td></tr>`
    : m`<tr><td colspan="3" style="height:12px;line-height:12px;font-size:1px;">&nbsp;</td></tr>`;
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;background:linear-gradient(160deg,#1E1533,${color.inset} 70%);background-color:${color.inset};border:1px solid #3A2C5C;border-radius:20px;">
<tr><td width="76" valign="top" style="padding:20px 0 14px 20px;"><img src="${asset(ctx, block.avatar)}" width="56" height="56" alt="${block.name}" style="display:block;width:56px;height:56px;border-radius:50%;border:2px solid ${color.lavender};"></td>
<td valign="top" style="${td('padding:20px 12px 14px 0;')}">${status}<div style="font-family:${font.display};font-size:21px;line-height:25px;font-weight:800;letter-spacing:-.4px;color:${color.white};">${block.name}</div><div style="margin-top:4px;font-size:13.5px;line-height:19px;color:${color.muted};">${flag}${meta}</div></td>${rating}</tr>${languages}${bio}</table>`;
}

function note(block: Extract<Block, { type: 'note' }>): SafeHtml {
  const c = toneColor[block.tone];
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;background:#170E2C;border:1px solid ${color.border};border-left:4px solid ${c};border-radius:16px;">
<tr><td style="${td('padding:15px 18px;')}"><div style="font-size:14.5px;line-height:20px;font-weight:700;color:${c};">${block.title}</div><div style="margin-top:4px;font-size:14px;line-height:21px;color:${color.body};">${block.text}</div></td></tr></table>`;
}

function code(block: Extract<Block, { type: 'code' }>): SafeHtml {
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:${color.inset};border:1px dashed #4A3B70;border-radius:18px;">
<tr><td align="center" style="padding:24px 16px 8px;font-family:${font.mono};font-size:34px;line-height:40px;font-weight:700;letter-spacing:10px;color:${color.white};">${block.code}</td></tr>
<tr><td align="center" style="${td(`padding:0 16px 20px;font-size:13px;line-height:18px;color:${color.muted};`)}">${block.caption}</td></tr></table>`;
}

function tier(
  ctx: EmailContext,
  block: Extract<Block, { type: 'tier' }>,
): SafeHtml {
  const t = loyaltyTiers[block.tier];
  const gift = block.gift
    ? m`<span style="display:inline-block;padding:7px 12px;border-radius:999px;background:${t.ink};font-family:${font.body};font-size:13px;line-height:16px;font-weight:800;color:${t.from};">&#10022; ${block.gift}</span>`
    : '';
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;border-radius:22px;border:1px solid rgba(255,255,255,.35);background-color:${t.to};background-image:linear-gradient(125deg,${t.from} 0%,${t.to} 48%,${t.from} 78%,${t.to} 100%);">
<tr><td class="dl-shine" style="padding:0;border-radius:22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td valign="top" style="padding:22px 0 0 22px;"><img src="${asset(ctx, '/email/wordmark-ink.png')}" width="84" height="32" alt="Duoly" style="display:block;width:84px;height:32px;"></td>
<td rowspan="4" align="right" valign="bottom" style="padding:0 18px 0 0;font-family:${font.display};font-size:150px;line-height:150px;font-weight:800;letter-spacing:-6px;color:${t.ink};opacity:.13;">${t.level}</td></tr>
<tr><td style="padding:30px 22px 0;font-family:${font.body};font-size:11.5px;line-height:14px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${t.ink};opacity:.7;">Level ${t.level} of 5 · Duoly Rewards</td></tr>
<tr><td style="padding:4px 22px 0;font-family:${font.display};font-size:42px;line-height:46px;font-weight:800;letter-spacing:-1.3px;color:${t.ink};">${t.name}</td></tr>
<tr><td style="padding:6px 22px 22px;font-family:${font.body};font-size:15px;line-height:21px;font-weight:600;color:${t.ink};">${block.headline}<div style="margin-top:14px;">${gift}</div></td></tr>
</table></td></tr></table>`;
}

function stats(block: Extract<Block, { type: 'stats' }>): SafeHtml {
  const width = Math.floor(100 / block.items.length);
  const cells = block.items.map(
    (item, index) =>
      m`<td width="${width}%" valign="top" style="padding:0 ${index === block.items.length - 1 ? 0 : 8}px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${color.inset};border:1px solid ${color.border};border-radius:16px;"><tr><td class="dl-stat" style="${td('padding:16px;')}"><div style="font-size:12.5px;line-height:16px;color:${color.muted};">${item.label}</div><div class="dl-stat-value" style="margin-top:6px;font-family:${font.display};font-size:24px;line-height:28px;font-weight:800;letter-spacing:-.5px;color:${color.white};white-space:nowrap;">${item.value}</div>${item.caption ? m`<div style="margin-top:4px;font-size:12.5px;line-height:16px;font-weight:600;color:${toneColor[item.tone ?? 'safe']};">${item.caption}</div>` : ''}</td></tr></table></td>`,
  );
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>${cells}</tr></table>`;
}

function quote(
  ctx: EmailContext,
  block: Extract<Block, { type: 'quote' }>,
): SafeHtml {
  const avatar = block.avatar
    ? m`<td width="44" valign="top" style="padding:18px 0 18px 18px;"><img src="${asset(ctx, block.avatar)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border-radius:50%;"></td>`
    : '';
  return m`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;background:${color.inset};border:1px solid ${color.border};border-radius:18px;"><tr>${avatar}<td style="${td('padding:18px;')}"><div style="font-size:13px;line-height:16px;font-weight:700;color:${color.lavender};">${block.author}</div><div style="margin-top:6px;font-size:15px;line-height:23px;color:${color.text};">${block.text}</div></td></tr></table>`;
}

function list(block: Extract<Block, { type: 'list' }>): SafeHtml {
  const heading = block.title
    ? m`<div style="margin-top:28px;font-family:${font.body};font-size:11.5px;line-height:14px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${color.muted};">${block.title}</div>`
    : '';
  const items = block.items.map(
    (item, index) =>
      m`<tr><td width="40" valign="top" style="padding:14px 0 0;"><div style="width:28px;height:28px;border-radius:9px;background:${color.raised};border:1px solid #2E2150;font-family:${font.display};font-size:13px;line-height:28px;font-weight:800;color:${color.lavender};text-align:center;">${index + 1}</div></td><td valign="top" style="${td('padding:14px 0 0;')}"><div style="font-size:15px;line-height:20px;font-weight:700;color:${color.text};">${item.title}</div><div style="margin-top:3px;font-size:14px;line-height:21px;color:${color.body};">${item.text}</div></td></tr>`,
  );
  return m`${heading}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">${items}</table>`;
}

function divider(): SafeHtml {
  return m`<div style="margin:28px 0 0;height:1px;line-height:1px;font-size:1px;background:${color.hairline};">&nbsp;</div>`;
}

function renderBlock(ctx: EmailContext, block: Block): SafeHtml {
  switch (block.type) {
    case 'paragraph':
      return paragraph(block);
    case 'button':
      return button(block);
    case 'linkFallback':
      return linkFallback(block);
    case 'order':
      return order(ctx, block);
    case 'details':
      return details(block);
    case 'steps':
      return steps(block);
    case 'teammate':
      return teammate(ctx, block);
    case 'note':
      return note(block);
    case 'code':
      return code(block);
    case 'tier':
      return tier(ctx, block);
    case 'stats':
      return stats(block);
    case 'quote':
      return quote(ctx, block);
    case 'list':
      return list(block);
    case 'divider':
      return divider();
  }
}

function heroArt(ctx: EmailContext, hero: EmailContent['hero']): SafeHtml {
  if (hero === 'brand') {
    return m`<tr><td align="center" style="padding:6px 0 0;"><img class="dl-pop" src="${asset(ctx, '/email/hero.gif')}" width="240" height="150" alt="The Duoly duo, two smiling gamers with headsets" style="display:block;width:240px;max-width:100%;height:auto;border:0;"></td></tr>`;
  }
  if (hero === 'mascots') {
    return m`<tr><td style="padding:0 0 4px;"><img src="${asset(ctx, '/email/mascots.gif')}" width="120" height="75" alt="" style="display:block;width:120px;height:75px;border:0;margin-left:-10px;"></td></tr>`;
  }
  return m``;
}

function footer(ctx: EmailContext, content: EmailContent): SafeHtml {
  const site = ctx.siteUrl.replace(/\/$/, '');
  const legal = [
    ctx.legal?.company,
    ctx.legal?.address ?? 'Vienna, Austria',
    ctx.legal?.register,
    ctx.legal?.vat,
  ]
    .filter(Boolean)
    .join(' · ');
  const link = (label: string, path: string) =>
    m`<a href="${site}${path}" style="color:${color.body};text-decoration:none;font-weight:600;">${label}</a>`;
  return m`<tr><td class="dl-pad" style="${td(`padding:28px 36px 0;font-size:12.5px;line-height:20px;color:${color.muted};`)}" align="center">
<img src="${asset(ctx, '/email/mascots-static.png')}" width="44" height="21" alt="" style="display:block;width:44px;height:21px;margin:0 auto 14px;">
${link('Help', '/contact')} &nbsp;<span style="color:#3A2C5C;">&#10022;</span>&nbsp; ${link('Terms', '/terms')} &nbsp;<span style="color:#3A2C5C;">&#10022;</span>&nbsp; ${link('Privacy', '/privacy')}
<div style="margin-top:12px;">${content.reason}</div>
<div style="margin-top:6px;">Duoly · ${legal}</div>
</td></tr>`;
}

const PREHEADER_PAD = '&#8199;&#847;'.repeat(60);

export function renderHtml(content: EmailContent, ctx: EmailContext): string {
  const body = content.blocks.map((block) => renderBlock(ctx, block));
  const headerMeta = content.headerMeta
    ? m`<td align="right" class="dl-hide-sm" style="${td(`font-size:12.5px;line-height:16px;font-weight:600;color:${color.muted};`)}">${content.headerMeta}</td>`
    : '';
  const doc = m`<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${content.subject}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
${styleBlock(ctx)}
</head>
<body class="body" style="margin:0;padding:0;background-color:${color.page};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${color.page};opacity:0;">${content.preheader}${raw(PREHEADER_PAD)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${color.page}" class="dl-bg" style="background-color:${color.page};">
<tr><td align="center" style="padding:0 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="dl-shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td style="padding:30px 0 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><a href="${ctx.siteUrl}" style="text-decoration:none;"><img src="${asset(ctx, '/email/wordmark.png')}" width="104" height="39" alt="Duoly" style="display:block;width:104px;height:39px;"></a></td>${headerMeta}</tr></table></td></tr>
<tr><td class="dl-card-pad" style="padding:36px 36px 38px;background:${color.card};border:1px solid ${color.border};border-radius:26px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${heroArt(ctx, content.hero)}
<tr><td style="padding:${content.hero === 'brand' ? '18px' : '0'} 0 0;">${eyebrow(content.eyebrow)}${title(content)}${body}</td></tr>
</table></td></tr>
${footer(ctx, content)}
<tr><td style="height:36px;line-height:36px;font-size:1px;">&nbsp;</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>`;
  return gmailDarkMode(doc.value);
}

/** Plain-text alternative built from the same content. */
export function renderText(content: EmailContent, ctx: EmailContext): string {
  const lines: string[] = [
    'DUOLY',
    '',
    content.eyebrow.toUpperCase(),
    '',
    content.title,
  ];
  if (content.titleAccent) lines.push(content.titleAccent);
  const push = (...items: string[]) => lines.push('', ...items);
  for (const block of content.blocks) {
    switch (block.type) {
      case 'paragraph':
        push(block.strong ? `${block.strong} ${block.text}` : block.text);
        break;
      case 'button':
        push(`${block.label}: ${block.url}`);
        if (block.secondary)
          lines.push(`${block.secondary.label}: ${block.secondary.url}`);
        break;
      case 'linkFallback':
        break;
      case 'order':
        push(
          [block.status?.label, block.title].filter(Boolean).join(': '),
          block.meta.join(' · '),
        );
        break;
      case 'details':
        push(...(block.title ? [block.title.toUpperCase()] : []));
        for (const row of block.rows) lines.push(`${row.label}: ${row.value}`);
        if (block.total)
          lines.push(`${block.total.label}: ${block.total.value}`);
        break;
      case 'steps':
        push(
          block.steps
            .map(
              (step) =>
                `${step.state === 'done' ? '[x]' : step.state === 'active' ? '[>]' : '[ ]'} ${step.label}`,
            )
            .join('   '),
        );
        break;
      case 'teammate':
        push(
          `${block.name}${block.rating ? ` (${block.rating} stars)` : ''}`,
          [block.rank, block.country].filter(Boolean).join(' · '),
        );
        if (block.languages?.length)
          lines.push(`Speaks: ${block.languages.join(', ')}`);
        if (block.bio) lines.push(`"${block.bio}"`);
        break;
      case 'note':
        push(block.title, block.text);
        break;
      case 'code':
        push(block.code, block.caption);
        break;
      case 'tier': {
        const tierInfo = loyaltyTiers[block.tier];
        push(
          `${tierInfo.name.toUpperCase()} (level ${tierInfo.level} of 5)`,
          block.headline,
        );
        if (block.gift) lines.push(block.gift);
        break;
      }
      case 'stats':
        push(
          ...block.items.map(
            (item) =>
              `${item.label}: ${item.value}${item.caption ? ` (${item.caption})` : ''}`,
          ),
        );
        break;
      case 'quote':
        push(`${block.author}:`, block.text);
        break;
      case 'list':
        push(...(block.title ? [block.title.toUpperCase()] : []));
        block.items.forEach((item, index) =>
          lines.push(`${index + 1}. ${item.title}: ${item.text}`),
        );
        break;
      case 'divider':
        push('---');
        break;
    }
  }
  const site = ctx.siteUrl.replace(/\/$/, '');
  push(
    content.reason,
    `Help: ${site}/contact`,
    `Duoly · ${ctx.legal?.address ?? 'Vienna, Austria'}`,
  );
  return `${lines.join('\n')}\n`;
}
