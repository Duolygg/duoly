import React from 'react';
import { GAMES } from '../../design-reference/lib/games';
import {
  STREAM_HOURS,
  STREAM_RATE_MAX_CENTS,
  STREAM_RATE_MIN_CENTS,
  STREAM_SHARE,
  StreamerDeskResponseSchema,
  TWITCH_USERNAME,
} from '../../contracts/streaming';

/**
 * Twitch streaming on the teammate desk (migration 20261105100000_twitch_streaming.sql).
 * Only shown to teammates an admin gave streaming games. They set an hourly rate, the hours
 * customers can book and their Twitch username (required), then go online for streaming. Nothing
 * checks with Twitch that they are live (migration 20261105190000); admins ban streamers who aren't.
 * Customers only see them while this is on AND their desk is online; bookings land in their queue
 * at once.
 */
const POLL_MS = 10000;
const DISPLAY = "'Bricolage Grotesque', 'Bricolage Fallback', sans-serif";
const TWITCH = '#A970FF';
const eur = (cents) => '€' + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);

export default class StreamingPanel extends React.Component {
  constructor(props) {
    super(props);
    // data: null until loaded; false = no streaming access (panel hidden)
    this.state = { data: null, draft: null, saving: false, error: '' };
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.load(), POLL_MS);
  }
  componentWillUnmount() {
    this._gone = true;
    clearInterval(this._t);
  }
  async request(init) {
    const response = await fetch('/api/teammate/streaming', {
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(body.error || 'Streaming is unavailable.');
    return StreamerDeskResponseSchema.parse(body).streaming;
  }
  draftFrom(data) {
    return {
      rate: data.rateEurCents == null ? '' : String(data.rateEurCents / 100),
      durations: data.durations.length ? data.durations : [1, 2],
      twitch: data.twitch || '',
    };
  }
  apply(data) {
    if (this._gone) return;
    if (!data) return this.setState({ data: false, draft: null });
    this.setState((s) => ({
      data,
      // keep what they're typing; take the server's values the first time
      draft: s.draft && s.dirty ? s.draft : this.draftFrom(data),
    }));
  }
  async load() {
    if (this.state.saving) return;
    try {
      this.apply(await this.request({ method: 'GET' }));
    } catch {
      /* keep the last state; the next poll retries */
    }
  }
  edit(patch) {
    this.setState((s) => ({
      draft: { ...s.draft, ...patch },
      dirty: true,
      error: '',
    }));
  }
  rateCents() {
    const n = Number(String(this.state.draft.rate).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  }
  // online: what going (or staying) online needs; going offline needs no Twitch username
  problem(online = true) {
    const d = this.state.draft;
    const cents = this.rateCents();
    if (!(cents >= STREAM_RATE_MIN_CENTS && cents <= STREAM_RATE_MAX_CENTS))
      return 'Set an hourly rate between €9.99 and €100.';
    if (!d.durations.length) return 'Pick at least one length.';
    if (online && !d.twitch.trim())
      return 'Add your Twitch username to go online.';
    if (d.twitch.trim() && !TWITCH_USERNAME.test(d.twitch.trim()))
      return 'A Twitch username is 4 to 25 letters, numbers or _.';
    return '';
  }
  async save(online) {
    const problem = this.problem(online);
    const saved = this.state.data;
    // Going offline always works: with a half-typed form, keep the saved rate and hours.
    const useSaved = problem && !online && saved.rateEurCents != null;
    if (problem && !useSaved) return this.setState({ error: problem });
    const d = useSaved ? this.draftFrom(saved) : this.state.draft;
    const rate = useSaved ? saved.rateEurCents : this.rateCents();
    this.setState({ saving: true, error: '' });
    try {
      const data = await this.request({
        method: 'POST',
        body: JSON.stringify({
          csrf: this.props.csrf,
          online,
          rateEurCents: rate,
          durations: d.durations.slice().sort((a, b) => a - b),
          twitch: d.twitch.trim(),
        }),
      });
      this.setState({ dirty: false });
      this.apply(data);
    } catch (error) {
      if (!this._gone) this.setState({ error: error.message });
    } finally {
      if (!this._gone) this.setState({ saving: false });
    }
  }
  render() {
    const { data, draft, saving, error } = this.state;
    if (!data || !draft) return null;
    const games = GAMES.filter((g) => data.games.includes(g.id));
    const cents = this.rateCents();
    const valid = !this.problem();
    const keep =
      cents >= STREAM_RATE_MIN_CENTS && cents <= STREAM_RATE_MAX_CENTS
        ? eur(Math.round(cents * STREAM_SHARE))
        : null;
    const status = data.live
      ? ['Live · customers can book you', '#5EEAA8']
      : data.streamOnline
        ? !data.deskOnline
          ? ['On, but hidden until your desk is online', '#FFD27A']
          : data.busy
            ? ['On, but hidden while you’re booked or in an order', '#FFD27A']
            : ['On, but customers can’t book you right now', '#FFD27A']
        : ['Offline for streaming', '#8E84AB'];
    const input = {
      height: '46px',
      padding: '0 14px',
      borderRadius: '14px',
      background: '#090414',
      border: '1px solid rgba(196, 170, 255, .16)',
      color: '#FFFFFF',
      fontSize: '15px',
      width: '100%',
      boxSizing: 'border-box',
    };
    const label = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      fontSize: '13px',
      fontWeight: '600',
      color: '#CFC4EA',
    };
    return (
      <section
        aria-labelledby="tm-stream-h"
        data-streaming-panel
        style={{
          marginTop: '20px',
          borderRadius: '24px',
          background: '#120B22',
          border: '1px solid rgba(169, 112, 255, .22)',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <h2
            id="tm-stream-h"
            style={{
              margin: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontFamily: DISPLAY,
              fontSize: '22px',
              fontWeight: '700',
              letterSpacing: '-.02em',
              color: '#FFFFFF',
            }}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={TWITCH}
            >
              <path d="M4.3 3 3 6.4v13.1h4.5V22h2.5l2.4-2.5h3.7L21 14.6V3H4.3Zm15 10.8-2.8 2.9H12l-2.4 2.4v-2.4H5.8V4.7h13.5v9.1ZM16.5 7.6v4.9h-1.7V7.6h1.7Zm-4.5 0v4.9h-1.7V7.6H12Z" />
            </svg>
            Twitch streaming
          </h2>
          <span
            role="status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: status[1],
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: status[1],
              }}
            />
            {status[0]}
          </span>
        </div>
        <p
          style={{
            margin: '4px 0 16px',
            fontSize: '13.5px',
            color: '#A79DC4',
            lineHeight: '1.5',
          }}
        >
          Customers book you for a paid stream session in{' '}
          {games.map((g) => g.short).join(', ')}. A booking goes straight to
          your queue and only you see it. Accept within 5 minutes or it’s
          cancelled and refunded.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          <label style={label}>
            Hourly rate (€)
            <input
              type="number"
              inputMode="decimal"
              min={STREAM_RATE_MIN_CENTS / 100}
              max={STREAM_RATE_MAX_CENTS / 100}
              step="0.01"
              value={draft.rate}
              onChange={(e) => this.edit({ rate: e.target.value })}
              placeholder="e.g. 15"
              style={input}
            />
            <span style={{ fontWeight: '400', color: '#8E84AB' }}>
              {keep
                ? 'You keep ' + keep + ' per hour (60%)'
                : '€9.99 to €100 per hour'}
            </span>
          </label>
          <label style={label}>
            Twitch username
            <input
              type="text"
              value={draft.twitch}
              onChange={(e) => this.edit({ twitch: e.target.value })}
              placeholder="yourchannel"
              autoComplete="off"
              spellCheck="false"
              maxLength={25}
              required
              aria-required="true"
              style={input}
            />
            <span style={{ fontWeight: '400', color: '#8E84AB' }}>
              Required. Only go online while you’re streaming on Twitch: going
              online without streaming gets your account banned.
            </span>
          </label>
        </div>
        <div style={{ marginTop: '14px' }}>
          <span
            id="tm-stream-hours"
            style={{ fontSize: '13px', fontWeight: '600', color: '#CFC4EA' }}
          >
            Customers can book you for
          </span>
          <div
            role="group"
            aria-labelledby="tm-stream-hours"
            style={{
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            {STREAM_HOURS.map((h) => {
              const on = draft.durations.includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={on ? 'true' : 'false'}
                  onClick={() =>
                    this.edit({
                      durations: on
                        ? draft.durations.filter((x) => x !== h)
                        : draft.durations.concat(h),
                    })
                  }
                  style={{
                    minWidth: '52px',
                    minHeight: '38px',
                    padding: '0 12px',
                    borderRadius: '12px',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    background: on ? '#1B1033' : 'transparent',
                    border:
                      '1px solid ' + (on ? TWITCH : 'rgba(196, 170, 255, .16)'),
                    color: on ? '#FFFFFF' : '#8E84AB',
                  }}
                >
                  {h} h
                </button>
              );
            })}
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            style={{ margin: '14px 0 0', fontSize: '13.5px', color: '#FF8A9B' }}
          >
            {error}
          </p>
        ) : null}
        <div
          style={{
            marginTop: '18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          {data.streamOnline && this.state.dirty ? (
            <button
              type="button"
              disabled={saving || !valid}
              onClick={() => this.save(true)}
              style={{
                minHeight: '46px',
                padding: '0 18px',
                borderRadius: '14px',
                border: '1px solid rgba(196, 170, 255, .18)',
                background: 'transparent',
                color: '#F3EEFF',
                fontSize: '14.5px',
                fontWeight: '600',
              }}
            >
              Save changes
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving || (!data.streamOnline && !valid)}
            aria-pressed={data.streamOnline ? 'true' : 'false'}
            onClick={() => this.save(!data.streamOnline)}
            style={{
              minHeight: '46px',
              padding: '0 20px',
              borderRadius: '14px',
              border: 'none',
              fontSize: '14.5px',
              fontWeight: '700',
              background: data.streamOnline
                ? 'rgba(196, 170, 255, .12)'
                : TWITCH,
              color: data.streamOnline ? '#F3EEFF' : '#FFFFFF',
              opacity: saving || (!data.streamOnline && !valid) ? 0.6 : 1,
            }}
          >
            {saving
              ? 'Saving…'
              : data.streamOnline
                ? 'Go offline for streaming'
                : 'Go online for streaming'}
          </button>
        </div>
      </section>
    );
  }
}
