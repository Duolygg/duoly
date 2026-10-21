'use client';
import React from 'react';
import SupportChat from './SupportChat';

// The shared layout of the Terms and Privacy pages (text in lib/legal.js), and the header/footer the
// Contact page uses too. Styles: .lg-* in app/globals.css.

export const ICONS = {
  card: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20M6 15h4" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />,
  eye: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0112 6c5 0 9 6 9 6a16 16 0 01-2.4 3M6.6 6.6C4.3 8.1 3 12 3 12s4 6 9 6a8.7 8.7 0 004.4-1.2" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>,
  chat: <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 8l9 6 9-6" /></>,
  discord: <path d="M8.5 7.5A13 13 0 0112 7a13 13 0 013.5.5M7 16.5c3 1.5 7 1.5 10 0M7.6 7.3C5.8 8 4.6 9 4 10c-1 3-.8 6 .3 8 1.2.9 2.6 1.5 4 1.8l1-1.6M16.4 7.3c1.8.7 3 1.7 3.6 2.7 1 3 .8 6-.3 8-1.2.9-2.6 1.5-4 1.8l-1-1.6M9.5 13.5h.01M14.5 13.5h.01" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  doc: <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>
};
export const Icon = ({ name, size = 20, stroke = 2 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
);

// **bold** and [label](/link) inside the legal text
function rich(text) {
  return String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={i} href={link[2]}>{link[1]}</a>;
    return part;
  });
}

function Block({ b }) {
  if (typeof b === 'string') return <p>{rich(b)}</p>;
  if (b.list) return <ul className="lg-list">{b.list.map((x, i) => <li key={i}><span className="lg-tick"><Icon name="check" size={12} stroke={3} /></span><span>{rich(x)}</span></li>)}</ul>;
  if (b.note) return <div className="lg-note">{rich(b.note)}</div>;
  if (b.cards) return <div className="lg-mini">{b.cards.map(([t, d], i) => <div key={i} className="lg-mini-card"><strong>{t}</strong><span>{rich(d)}</span></div>)}</div>;
  if (b.table) {
    const [head, ...rows] = b.table;
    return (
      <div className="lg-table-wrap dl-scroll">
        <table className="lg-table">
          <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} data-label={head[j]}>{rich(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return null;
}

const NAV = [['terms', 'Terms', '/terms'], ['privacy', 'Privacy', '/privacy'], ['contact', 'Contact', '/contact']];

// Header with the three legal pages as tabs and a reading-progress bar.
export class LegalHeader extends React.Component {
  constructor(props) { super(props); this.state = { progress: 0 }; }
  componentDidMount() { this.onScroll(); window.addEventListener('scroll', this.onScroll, { passive: true }); }
  componentWillUnmount() { window.removeEventListener('scroll', this.onScroll); }
  onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.setState({ progress: max > 0 ? Math.min(1, window.scrollY / max) : 0 });
  };
  render() {
    return (
      <header className="lg-header">
        <div className="lg-header-in">
          <a href="/" aria-label="Duoly home" className="lg-logo"><img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="96" height="36" /></a>
          <nav aria-label="Legal pages" className="lg-tabs">
            {NAV.map(([id, label, href]) => <a key={id} href={href} aria-current={this.props.active === id ? 'page' : undefined} className={'lg-tab' + (this.props.active === id ? ' on' : '')}>{label}</a>)}
          </nav>
          <a href="/" className="lg-back">Back to Duoly <Icon name="arrow" size={15} stroke={2.4} /></a>
        </div>
        <span className="lg-progress" style={{ transform: 'scaleX(' + this.state.progress + ')' }} />
      </header>
    );
  }
}

export function LegalFooter() {
  return (
    <footer className="lg-footer">
      <div className="lg-footer-in">
        <img src="/assets/brand/logo-wordmark.webp" alt="Duoly" width="96" height="36" />
        <span>© 2026 Duoly · Made in Vienna, Austria. Not affiliated with any game publisher.</span>
        <nav aria-label="Footer"><a href="/creators">Creators</a>{NAV.map(([id, label, href]) => <a key={id} href={href}>{label}</a>)}</nav>
      </div>
    </footer>
  );
}

// Terms / Privacy: hero with the short version, then the sections with a table of contents that follows you.
export default class LegalPage extends React.Component {
  constructor(props) { super(props); this.state = { active: props.doc.sections[0].id }; }
  componentDidMount() { this.spy(); window.addEventListener('scroll', this.spy, { passive: true }); }
  componentWillUnmount() { window.removeEventListener('scroll', this.spy); }
  // highlight the section you're reading in the table of contents: the last one whose top passed the header
  spy = () => {
    let active = this.props.doc.sections[0].id;
    this.props.doc.sections.forEach((s) => { const el = document.getElementById(s.id); if (el && el.getBoundingClientRect().top < 140) active = s.id; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = this.props.doc.sections[this.props.doc.sections.length - 1].id;
    if (active !== this.state.active) this.setState({ active });
  };
  render() {
    const { doc, extra } = this.props;
    const num = (i) => String(i + 1).padStart(2, '0');
    return (
      <div className="lg-page">
        <LegalHeader active={doc.slug} />
        <main>
          <section className="lg-hero">
            <div className="lg-hero-in">
              <span className="lg-kicker"><span className="lg-kicker-dot" />{doc.kicker} · Updated {doc.updated}</span>
              <h1 className="lg-h1">{doc.title}</h1>
              <p className="lg-intro">{doc.intro}</p>
              <div className="lg-summary">
                {doc.summary.map(([icon, t, d]) => (
                  <div key={t} className="lg-sum-card">
                    <span className="lg-sum-icon"><Icon name={icon} /></span>
                    <strong>{t}</strong>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="lg-body">
            <aside className="lg-toc" aria-label="On this page">
              <span className="lg-toc-h">On this page</span>
              <ol>
                {doc.sections.map((s, i) => (
                  <li key={s.id}><a href={'#' + s.id} className={this.state.active === s.id ? 'on' : ''}><span>{num(i)}</span>{s.title}</a></li>
                ))}
              </ol>
            </aside>
            <details className="lg-jump">
              <summary>On this page <Icon name="arrow" size={14} stroke={2.4} /></summary>
              <ol>{doc.sections.map((s, i) => <li key={s.id}><a href={'#' + s.id}><span>{num(i)}</span>{s.title}</a></li>)}</ol>
            </details>
            <article className="lg-article">
              {doc.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="lg-sec" aria-labelledby={s.id + '-h'}>
                  <div className="lg-sec-head">
                    <span className="lg-num">{num(i)}</span>
                    <h2 id={s.id + '-h'}>{s.title}</h2>
                  </div>
                  <div className="lg-prose">{s.blocks.map((b, j) => <Block key={j} b={b} />)}</div>
                </section>
              ))}
              {extra}
              <div className="lg-cta">
                <div>
                  <strong>Still have a question?</strong>
                  <span>Real people answer, usually within minutes.</span>
                </div>
                <a href="/contact" className="lg-btn">Contact us <Icon name="arrow" size={16} stroke={2.4} /></a>
              </div>
            </article>
          </div>
        </main>
        <LegalFooter />
        <SupportChat />
      </div>
    );
  }
}
