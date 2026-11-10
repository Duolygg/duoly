import HomeImage from './HomeImage';
import React from 'react';
import Pick from '../../design-reference/components/Pick.jsx';
import { GAMES } from '../../design-reference/lib/games';
import {
  MC_EDITIONS,
  serversFor,
  usesServerName,
} from '../../design-reference/lib/servers';
import { PublicStreamerSchema } from '../../contracts/streaming';

/**
 * "Live on Twitch": teammates streaming right now that customers can book for a paid session
 * (migration 20261105100000_twitch_streaming.sql). Only streamers who are live are listed, and
 * the list refreshes on its own. Booking goes through the normal checkout with the streamer's
 * handle; the server prices it from their own hourly rate and the order goes only to them.
 * Hidden when nobody is streaming.
 */
const POLL_MS = 15000;
const TWITCH = '#A970FF';
const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";
const gameOf = (id) => GAMES.find((g) => g.id === id);

// Local preview only: /?demo-streamers on the dev server shows sample streamers. Vite drops
// this from production builds (import.meta.env.DEV is false there), and booking them fails.
const DEMO_STREAMERS = [
  {
    handle: '00000000-0000-4000-8000-00000000d001',
    name: 'Lea',
    image: '/assets/avatars/avatar-3.png',
    games: ['lol', 'val'],
    rateEurCents: 1500,
    durations: [1, 2, 3],
    twitch: 'lea_tv',
    rating: 4.9,
    reviews: 12,
  },
  {
    handle: '00000000-0000-4000-8000-00000000d002',
    name: 'Kai',
    image: '/assets/avatars/avatar-7.png',
    games: ['mc', 'fn'],
    rateEurCents: 990,
    durations: [1, 2],
    twitch: null,
    rating: null,
    reviews: 0,
  },
];
const demoOn = () =>
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('demo-streamers');

const field = {
  height: '48px',
  padding: '0 14px',
  borderRadius: '14px',
  background: '#090414',
  border: '1px solid rgba(196, 170, 255, .16)',
  color: '#FFFFFF',
  fontSize: '15px',
  width: '100%',
  boxSizing: 'border-box',
};
const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
  fontWeight: '600',
  color: '#CFC4EA',
};
const chip = (on) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '38px',
  padding: '0 12px',
  borderRadius: '12px',
  fontSize: '13.5px',
  fontWeight: '600',
  background: on ? '#1B1033' : 'transparent',
  border: '1.5px solid ' + (on ? TWITCH : 'rgba(196, 170, 255, .14)'),
  color: on ? '#FFFFFF' : '#A79DC4',
});

export default class StreamerBooking extends React.Component {
  constructor(props) {
    super(props);
    this.state = { list: [], open: '', form: null, placing: false, err: '' };
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.load(), POLL_MS);
  }
  componentWillUnmount() {
    this._gone = true;
    clearInterval(this._t);
  }
  async load() {
    try {
      const response = await fetch('/api/home/streamers', {
        credentials: 'same-origin',
        redirect: 'error',
      });
      if (!response.ok) return;
      const body = await response.json();
      const list = (Array.isArray(body.streamers) ? body.streamers : [])
        .map((x) => PublicStreamerSchema.safeParse(x))
        .filter((x) => x.success)
        .map((x) => x.data);
      if (demoOn()) list.unshift(...DEMO_STREAMERS);
      if (this._gone) return;
      // a streamer who went offline closes their booking form
      this.setState((s) =>
        s.open && !list.some((x) => x.handle === s.open)
          ? {
              list,
              open: '',
              form: null,
              err: 'That streamer just went offline.',
            }
          : { list },
      );
    } catch {
      /* keep the last list */
    }
  }
  remembered(key, fallback) {
    try {
      return window.localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }
  formFor(x, game) {
    const servers = serversFor(game);
    return {
      game,
      hours: x.durations[0],
      server: this.remembered('duoly-server-' + game, servers[0][0]),
      mcServer: this.remembered('duoly-mc-server', ''),
      edition: MC_EDITIONS[0],
      ign: this.remembered('duoly-ign-' + game, ''),
      note: '',
      voice: true,
    };
  }
  openFor(x) {
    if (this.state.open === x.handle)
      return this.setState({ open: '', form: null, err: '' });
    this.setState(
      { open: x.handle, form: this.formFor(x, x.games[0]), err: '' },
      () => {
        // the form sits under all cards: bring it into view if it's below the screen
        const form = document.querySelector('[data-streamer-form]');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    );
  }
  edit(patch) {
    this.setState((s) => ({ form: { ...s.form, ...patch }, err: '' }));
  }
  async book(x) {
    const f = this.state.form;
    const byName = usesServerName(f.game);
    const ign = f.ign.trim();
    const game = gameOf(f.game);
    if (!this.props.signedIn) return this.props.openAuth();
    if (ign.length < 2)
      return this.setState({
        err:
          'Add your ' +
          (game ? game.ign : 'in-game name') +
          ' so ' +
          x.name +
          ' can invite you.',
      });
    if (byName && f.mcServer.trim().length < 2)
      return this.setState({
        err: 'Add the server you play on (or “my own world”).',
      });
    if (!this.props.onCheckout)
      return this.setState({ err: 'Booking opens soon.' });
    this.setState({ placing: true, err: '' });
    const result = await this.props.onCheckout({
      gameId: f.game,
      serviceId: 'stream',
      streamer: x.handle,
      units: f.hours,
      server: byName ? f.mcServer.trim() : f.server,
      ...(byName ? { edition: f.edition } : {}),
      ign,
      note: f.note.trim(),
      voice: !!f.voice,
      useWallet: true,
    });
    if (result && (result.url || result.orderId)) {
      try {
        window.localStorage.setItem('duoly-ign-' + f.game, ign);
        if (byName)
          window.localStorage.setItem('duoly-mc-server', f.mcServer.trim());
        else window.localStorage.setItem('duoly-server-' + f.game, f.server);
      } catch {
        /* storage is optional */
      }
      window.location.href = result.url || '/queue/' + result.orderId;
      return;
    }
    if (!this._gone)
      this.setState({
        placing: false,
        err:
          (result && result.error) ||
          'Couldn’t start checkout. Please try again.',
      });
    this.load();
  }
  renderForm(x) {
    const f = this.state.form;
    const { fmtEur } = this.props;
    const byName = usesServerName(f.game);
    const game = gameOf(f.game);
    const total = (x.rateEurCents * f.hours) / 100;
    return (
      <div
        data-private-block=""
        data-streamer-form
        style={{
          marginTop: '12px',
          scrollMarginTop: '96px',
          padding: '20px',
          borderRadius: '20px',
          background: '#120B22',
          border: '1px solid rgba(169, 112, 255, .3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: '18px',
            fontWeight: '700',
            color: '#FFFFFF',
          }}
        >
          Book {x.name}
        </div>
        {x.games.length > 1 ? (
          <div>
            <span
              id={'sb-game-' + x.handle}
              style={{ fontSize: '13px', fontWeight: '600', color: '#CFC4EA' }}
            >
              Game
            </span>
            <div
              role="group"
              aria-labelledby={'sb-game-' + x.handle}
              style={{
                marginTop: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {x.games.map((id) => {
                const g = gameOf(id);
                const on = f.game === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on ? 'true' : 'false'}
                    onClick={() =>
                      this.setState({
                        form: {
                          ...this.formFor(x, id),
                          hours: f.hours,
                          note: f.note,
                          voice: f.voice,
                        },
                      })
                    }
                    style={{ ...chip(on), paddingLeft: '4px' }}
                  >
                    <HomeImage
                      src={g.img}
                      alt=""
                      width="28"
                      height="28"
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                      }}
                    />
                    {g.short}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div>
          <span
            id={'sb-hours-' + x.handle}
            style={{ fontSize: '13px', fontWeight: '600', color: '#CFC4EA' }}
          >
            How long
          </span>
          <div
            role="group"
            aria-labelledby={'sb-hours-' + x.handle}
            style={{
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            {x.durations.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={f.hours === h ? 'true' : 'false'}
                onClick={() => this.edit({ hours: h })}
                style={chip(f.hours === h)}
              >
                {h} {h === 1 ? 'hour' : 'hours'}
              </button>
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}
        >
          {byName ? (
            <>
              <label style={labelStyle}>
                Server
                <input
                  type="text"
                  value={f.mcServer}
                  maxLength={60}
                  onChange={(e) => this.edit({ mcServer: e.target.value })}
                  placeholder="e.g. hypixel.net or my own world"
                  style={field}
                />
              </label>
              <div style={labelStyle}>
                <span id={'sb-ed-' + x.handle}>Edition</span>
                <div
                  role="group"
                  aria-labelledby={'sb-ed-' + x.handle}
                  style={{ display: 'flex', gap: '6px' }}
                >
                  {MC_EDITIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-pressed={f.edition === e ? 'true' : 'false'}
                      onClick={() => this.edit({ edition: e })}
                      style={chip(f.edition === e)}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={labelStyle}>
              <span>Server</span>
              <Pick
                id={'sb-server-' + x.handle}
                label="Server"
                value={f.server}
                options={serversFor(f.game).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onPick={(server) => this.edit({ server })}
              />
            </div>
          )}
          <label style={labelStyle}>
            Your {game ? game.ign : 'in-game name'}
            <input
              type="text"
              value={f.ign}
              maxLength={40}
              onChange={(e) => this.edit({ ign: e.target.value })}
              autoComplete="off"
              spellCheck="false"
              style={field}
            />
          </label>
        </div>
        <label style={labelStyle}>
          <span>
            Note for {x.name}{' '}
            <span style={{ fontWeight: '400', color: '#8E84AB' }}>
              (optional)
            </span>
          </span>
          <input
            type="text"
            value={f.note}
            maxLength={200}
            onChange={(e) => this.edit({ note: e.target.value })}
            placeholder="What do you want to play or do on stream?"
            style={field}
          />
        </label>
        <button
          type="button"
          role="checkbox"
          aria-checked={f.voice ? 'true' : 'false'}
          onClick={() => this.edit({ voice: !f.voice })}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'transparent',
            border: 'none',
            padding: '0',
            color: '#F3EEFF',
            fontSize: '14px',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: f.voice ? TWITCH : 'transparent',
              border: f.voice ? 'none' : '1.5px solid rgba(196, 170, 255, .3)',
              color: '#FFFFFF',
              fontSize: '13px',
            }}
          >
            {f.voice ? '✓' : ''}
          </span>
          Talk on voice during the session
        </button>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(196, 170, 255, .1)',
          }}
        >
          <span
            style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
          >
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: '22px',
                fontWeight: '700',
                color: '#FFFFFF',
              }}
              data-streamer-total
            >
              {fmtEur(total)}
            </span>
            <span style={{ fontSize: '12.5px', color: '#8E84AB' }}>
              {fmtEur(x.rateEurCents / 100)} per hour × {f.hours} · wallet
              balance is used first
            </span>
          </span>
          <button
            type="button"
            disabled={this.state.placing}
            onClick={() => this.book(x)}
            style={{
              minHeight: '50px',
              padding: '0 22px',
              borderRadius: '14px',
              border: 'none',
              background: TWITCH,
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: '700',
              opacity: this.state.placing ? 0.7 : 1,
            }}
          >
            {this.state.placing
              ? 'Starting checkout…'
              : this.props.signedIn
                ? 'Book ' + x.name
                : 'Sign in to book'}
          </button>
        </div>
        {this.state.err ? (
          <p
            role="alert"
            style={{ margin: '0', fontSize: '13.5px', color: '#FF8A9B' }}
          >
            {this.state.err}
          </p>
        ) : null}
        <p
          style={{
            margin: '0',
            fontSize: '12.5px',
            color: '#8E84AB',
            lineHeight: '1.5',
          }}
        >
          Your booking goes straight to {x.name}. If they don’t accept within 5
          minutes, it’s cancelled and you’re refunded.
        </p>
      </div>
    );
  }
  render() {
    const { list, open } = this.state;
    if (!list.length)
      return this.state.err ? (
        <p
          role="status"
          style={{ margin: '24px 0 0', fontSize: '13.5px', color: '#FF8A9B' }}
        >
          {this.state.err}
        </p>
      ) : null;
    const { fmtEur } = this.props;
    const openStreamer = list.find((x) => x.handle === open);
    return (
      <section
        id="streamers"
        aria-labelledby="sb-h"
        style={{ marginTop: '64px' }}
      >
        {/* Same header as "Meet your teammates" (globals.css .tc-*): title, live pill, one line under */}
        <div className="tc-top">
          <h2
            id="sb-h"
            className="tc-title"
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <svg
              aria-hidden="true"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill={TWITCH}
            >
              <path d="M4.3 3 3 6.4v13.1h4.5V22h2.5l2.4-2.5h3.7L21 14.6V3H4.3Zm15 10.8-2.8 2.9H12l-2.4 2.4v-2.4H5.8V4.7h13.5v9.1ZM16.5 7.6v4.9h-1.7V7.6h1.7Zm-4.5 0v4.9h-1.7V7.6H12Z" />
            </svg>
            Live on Twitch
          </h2>
          <span className="tc-live is-on">
            <span className="tc-live-dot" />
            {list.length} {list.length === 1 ? 'streamer' : 'streamers'} live
            now
          </span>
        </div>
        <p className="tc-sub">Play with a streamer on their stream.</p>
        <div
          style={{
            marginTop: '0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          {list.map((x) => {
            const isOpen = open === x.handle;
            return (
              <React.Fragment key={x.handle}>
                <article
                  data-private-block=""
                  data-streamer-card
                  // The whole card opens the booking form (the Book button stays the
                  // keyboard control); the Twitch link and the button handle their own clicks.
                  onClick={(e) => {
                    if (!e.target.closest('a, button')) this.openFor(x);
                  }}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '18px',
                    borderRadius: '20px',
                    background: isOpen ? '#1B1033' : '#120B22',
                    border:
                      '1px solid ' +
                      (isOpen ? TWITCH : 'rgba(196, 170, 255, .1)'),
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <span style={{ position: 'relative', flex: '0 0 auto' }}>
                      <HomeImage
                        src={x.image || '/assets/avatars/avatar-1.png'}
                        alt=""
                        width="48"
                        height="48"
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          right: '-2px',
                          bottom: '-2px',
                          padding: '1px 5px',
                          borderRadius: '6px',
                          background: '#E91916',
                          color: '#FFFFFF',
                          fontSize: '9px',
                          fontWeight: '800',
                          letterSpacing: '.04em',
                        }}
                      >
                        LIVE
                      </span>
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '0',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '17px',
                          fontWeight: '700',
                          color: '#FFFFFF',
                        }}
                      >
                        {x.name}
                      </span>
                      {x.rating != null && x.reviews > 0 ? (
                        <span style={{ fontSize: '12.5px', color: '#A79DC4' }}>
                          ★ {x.rating.toFixed(1)} · {x.reviews}{' '}
                          {x.reviews === 1 ? 'review' : 'reviews'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: '#A79DC4' }}>
                          New streamer
                        </span>
                      )}
                    </span>
                    <span style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: DISPLAY,
                          fontSize: '18px',
                          fontWeight: '700',
                          color: '#FFFFFF',
                        }}
                      >
                        {fmtEur(x.rateEurCents / 100)}
                      </span>
                      <span style={{ fontSize: '12px', color: '#8E84AB' }}>
                        per hour
                      </span>
                    </span>
                  </div>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
                    aria-label="Games"
                  >
                    {x.games.map((id) => {
                      const g = gameOf(id);
                      return (
                        <span
                          key={id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px 3px 3px',
                            borderRadius: '9px',
                            background: 'rgba(169, 112, 255, .12)',
                            color: '#E6DAFF',
                            fontSize: '12.5px',
                            fontWeight: '600',
                          }}
                        >
                          <HomeImage
                            src={g.img}
                            alt=""
                            width="20"
                            height="20"
                            loading="lazy"
                            decoding="async"
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '6px', // rounded square like every game icon
                            }}
                          />
                          {g.short}
                        </span>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginTop: 'auto',
                    }}
                  >
                    {x.twitch ? (
                      <a
                        href={'https://www.twitch.tv/' + x.twitch}
                        target="_blank"
                        rel="noreferrer nofollow"
                        style={{
                          fontSize: '13px',
                          color: '#C9A6FF',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        twitch.tv/{x.twitch}
                      </a>
                    ) : null}
                    <button
                      type="button"
                      aria-expanded={isOpen ? 'true' : 'false'}
                      onClick={() => this.openFor(x)}
                      style={{
                        marginLeft: 'auto',
                        minHeight: '40px',
                        padding: '0 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: isOpen
                          ? 'rgba(196, 170, 255, .12)'
                          : TWITCH,
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: '700',
                      }}
                    >
                      {isOpen ? 'Close' : 'Book'}
                    </button>
                  </div>
                </article>
              </React.Fragment>
            );
          })}
        </div>
        {/* Below every card, so opening one never moves the other streamers */}
        {openStreamer && this.state.form ? this.renderForm(openStreamer) : null}
      </section>
    );
  }
}
