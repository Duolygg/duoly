import React from 'react';
import {
  C,
  DISPLAY,
  card,
  chip,
  btn,
  pill,
  ago,
} from '../../design-reference/components/admin/ui';
import { GAME } from '../../design-reference/lib/games';
import { application } from './api';

// Port of the Applications tab of the original components/admin/Teammates.jsx, wired to
// /api/admin/applications. Approving makes the account with that email a teammate for the
// game; without an account yet, they become one as soon as they sign up with that email.
const REFRESH_MS = 20000;
const REASONS = [
  'Rank too low',
  'Couldn’t verify account',
  'Region not needed right now',
  'Incomplete application',
  'Other',
];
const RESULT = {
  teammate: ' is now a teammate for ',
  'no-account':
    ' approved. They become a teammate as soon as they sign up with ',
  customer: ' approved',
  teammate_: '',
};

export default class Applications extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      list: [],
      loaded: false,
      error: '',
      filter: 'Pending',
      busy: '',
    };
  }
  componentDidMount() {
    this.load();
    this._t = setInterval(() => this.load(), REFRESH_MS);
  }
  componentWillUnmount() {
    clearInterval(this._t);
  }
  async load() {
    const res = await this.props.api.get('/api/admin/applications');
    if (!res.ok) return this.setState({ error: res.error, loaded: true });
    const list = (res.data.applications || []).map(application);
    this.setState({ list, error: '', loaded: true });
    if (this.props.onApplications)
      this.props.onApplications(
        list.filter((a) => a.status === 'Pending').length,
      );
  }
  async decide(a, decision, reason) {
    this.setState({ busy: a.id });
    const res = await this.props.api.post('/api/admin/applications', {
      id: a.id,
      decision,
      ...(reason ? { reason } : {}),
    });
    this.setState({ busy: '' });
    if (!res.ok)
      return this.props.toast(
        res.error || 'That didn’t work. Try again.',
        'warn',
      );
    const next = application(res.data.application);
    const list = this.state.list.map((x) => (x.id === a.id ? next : x));
    this.setState({ list });
    if (this.props.onApplications)
      this.props.onApplications(
        list.filter((x) => x.status === 'Pending').length,
      );
    this.props.log();
    const game = (GAME[a.game] || {}).name || a.game;
    if (decision === 'reject')
      return this.props.toast(a.name + ' rejected · they’ve been emailed');
    const r = res.data.result;
    if (r === 'teammate')
      this.props.toast(
        a.name + RESULT.teammate + game + ' · welcome email sent',
      );
    else if (r === 'no-account')
      this.props.toast(a.name + RESULT['no-account'] + a.email);
    else
      this.props.toast(
        a.name +
          ' approved (already ' +
          (r === 'admin' ? 'an admin' : 'a ' + r) +
          ')',
      );
  }
  render() {
    const { ask } = this.props;
    const s = this.state;
    const all = s.list;
    const list = all.filter((a) => s.filter === 'All' || a.status === s.filter);
    return (
      <section style={{ ...card, padding: '18px' }}>
        <div
          role="group"
          aria-label="Filter applications"
          style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
        >
          {['Pending', 'Approved', 'Rejected', 'All'].map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={s.filter === f ? 'true' : 'false'}
              onClick={() => this.setState({ filter: f })}
              style={chip(s.filter === f)}
            >
              {f}
              <span style={{ opacity: '.65', fontWeight: '500' }}>
                {all.filter((a) => f === 'All' || a.status === f).length}
              </span>
            </button>
          ))}
        </div>
        {s.error ? (
          <p
            role="status"
            style={{ margin: '12px 0 0', fontSize: '13.5px', color: C.pink }}
          >
            {s.error}
          </p>
        ) : null}
        <div className="ad-cards" style={{ marginTop: '14px' }}>
          {list.map((a) => {
            const g = GAME[a.game] || { name: a.game, img: '' };
            return (
              <article
                key={a.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '18px',
                  borderRadius: '18px',
                  background: C.bg,
                  border:
                    '1px solid ' +
                    (a.status === 'Pending'
                      ? 'rgba(255, 210, 122, .25)'
                      : C.line),
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <img
                    src={g.img}
                    alt={g.name}
                    width="44"
                    height="44"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                    }}
                  />
                  <div style={{ flex: '1', minWidth: '0', lineHeight: '1.3' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: DISPLAY,
                        fontSize: '18px',
                        fontWeight: '700',
                        color: C.white,
                      }}
                    >
                      {a.name}
                    </div>
                    <div style={{ fontSize: '13px', color: C.muted }}>
                      {[a.rank, a.role, a.region, a.country]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>
                  <span style={pill(a.status)}>{a.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {a.services.map((x) => (
                    <span
                      key={x}
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        padding: '3px 9px',
                        borderRadius: '8px',
                        background:
                          x === 'Gamer Girl'
                            ? 'rgba(240, 166, 255, .14)'
                            : 'rgba(214, 187, 255, .1)',
                        color: x === 'Gamer Girl' ? C.pink : C.accent,
                      }}
                    >
                      {x}
                    </span>
                  ))}
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '3px 9px',
                      borderRadius: '8px',
                      background: 'rgba(158, 230, 255, .1)',
                      color: C.cyan,
                    }}
                  >
                    {a.hours} h/week
                  </span>
                </div>
                {a.why ? (
                  <p
                    style={{
                      margin: '0',
                      fontSize: '14px',
                      color: '#CFC4EA',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    “{a.why}”
                  </p>
                ) : null}
                {a.link ? (
                  <a
                    href={
                      /^https?:\/\//.test(a.link) ? a.link : 'https://' + a.link
                    }
                    target="_blank"
                    rel="noreferrer nofollow"
                    style={{
                      fontSize: '13px',
                      color: C.accent,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {a.link}
                  </a>
                ) : null}
                <div
                  style={{
                    fontSize: '12.5px',
                    color: C.dim,
                    lineHeight: '1.5',
                  }}
                >
                  {a.email} · Discord{' '}
                  <b style={{ color: C.white, fontWeight: '600' }}>
                    {a.discord}
                  </b>
                  <br />
                  {a.reference} · applied {ago(a.submittedAt, Date.now())}
                  {a.decidedBy
                    ? ' · ' + a.status.toLowerCase() + ' by ' + a.decidedBy
                    : ''}
                  {a.reason ? ': ' + a.reason : ''}
                </div>
                {a.status === 'Pending' ? (
                  <div
                    style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}
                  >
                    <button
                      type="button"
                      disabled={s.busy === a.id}
                      style={{ ...btn('good'), flex: '1' }}
                      onClick={() =>
                        ask({
                          title: 'Approve ' + a.name + '?',
                          body:
                            'The Duoly account with ' +
                            a.email +
                            ' becomes a teammate, approved for ' +
                            g.name +
                            ', and gets the welcome email. No account with that email yet? They become a teammate the moment they sign up with it.',
                          confirm: 'Approve',
                          kind: 'good',
                          onConfirm: () => this.decide(a, 'approve'),
                        })
                      }
                    >
                      {s.busy === a.id ? 'Saving…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={s.busy === a.id}
                      style={{ ...btn('danger'), flex: '1' }}
                      onClick={() =>
                        ask({
                          title: 'Reject ' + a.name + '?',
                          body: 'They get a short, friendly email. The reason stays internal (audit log only).',
                          confirm: 'Reject',
                          kind: 'danger',
                          field: {
                            label: 'Reason',
                            options: REASONS,
                            value: REASONS[0],
                          },
                          onConfirm: (reason) =>
                            this.decide(a, 'reject', reason),
                        })
                      }
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
          {s.loaded && !list.length ? (
            <p style={{ margin: '0', color: C.dim }}>
              {all.length
                ? 'No applications here.'
                : 'No applications yet. They show up here when someone applies on the “Become a teammate” page.'}
            </p>
          ) : null}
        </div>
      </section>
    );
  }
}
