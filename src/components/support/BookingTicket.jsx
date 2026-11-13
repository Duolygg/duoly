import React from 'react';
import { track } from '../../client/analytics/track';
import BundledImage from '../shared/BundledImage';

/*
 * The booking ticket Sparky shows under a reply when someone wants to buy. Every price and link
 * comes from the server (offer_booking: the same quote code as checkout); this only switches
 * between the precomputed quantity options and opens the prefilled booking on duoly.gg.
 * Nothing is reserved or paid here.
 */
const CSS = `
.sbk{position:relative;overflow:hidden;border-radius:18px;border:1px solid rgba(214,187,255,.22);
  background:radial-gradient(120% 80% at 100% 0%,rgba(240,166,255,.14),transparent 55%),
    radial-gradient(90% 70% at 0% 100%,rgba(124,240,193,.07),transparent 60%),linear-gradient(180deg,#1d1236,#140b27);
  color:#F3EEFF;animation:sbk-rise .5s cubic-bezier(.22,1,.36,1) both}
.sbk::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.08) 48%,transparent 60%);
  transform:translateX(-120%);animation:sbk-sheen 2.4s .45s ease-out 1 both}
@keyframes sbk-rise{from{opacity:0;transform:translateY(12px) scale(.98)}}
@keyframes sbk-sheen{to{transform:translateX(120%)}}
.sbk-dot{position:absolute;right:-2px;bottom:-1px;width:11px;height:11px;border-radius:50%;
  background:#7CF0C1;border:2px solid #160d29;animation:sbk-ping 1.8s infinite}
@keyframes sbk-ping{0%{box-shadow:0 0 0 0 rgba(124,240,193,.55)}70%,100%{box-shadow:0 0 0 7px rgba(124,240,193,0)}}
.sbk-q{position:relative;border:1px solid rgba(214,187,255,.13);background:rgba(255,255,255,.02);border-radius:12px;
  padding:7px 4px;min-height:52px;text-align:center;color:#F3EEFF;font:inherit;cursor:pointer;
  transition:border-color .15s,background .15s,transform .12s}
.sbk-q:active{transform:scale(.97)}
.sbk-q[aria-pressed="true"]{border-color:#D6BBFF;background:rgba(214,187,255,.1);box-shadow:inset 0 0 0 1px rgba(214,187,255,.35)}
.sbk-q:focus-visible,.sbk-cta:focus-visible{outline:2px solid #D6BBFF;outline-offset:2px}
.sbk-cta{display:block;width:100%;box-sizing:border-box;text-align:center;text-decoration:none;border-radius:14px;
  padding:13px 12px;font-weight:700;font-size:15px;color:#17092E;
  background:linear-gradient(90deg,#e7d6ff,#D6BBFF,#f3c8ff);box-shadow:0 10px 28px -12px rgba(214,187,255,.75);
  transition:transform .15s}
.sbk-cta:hover{transform:translateY(-1px)}
@media (prefers-reduced-motion:reduce){.sbk,.sbk::before,.sbk-dot{animation:none}.sbk::before{display:none}}
`;

const eur = (minor) => '€' + (minor / 100).toFixed(2);
const units = (n, unit) => n + ' ' + unit + (n === 1 ? '' : 's');
const KIND = {
  training: 'Coaching',
  other: 'Team',
  duo: 'Play together',
};
const FACES = [
  'linear-gradient(135deg,#ffb38a,#e05d8f)',
  'linear-gradient(135deg,#8ad7ff,#5b6cf0)',
  'linear-gradient(135deg,#c7a6ff,#7b4fe0)',
];

export default class BookingTicket extends React.Component {
  constructor(props) {
    super(props);
    this.state = { quantity: props.ticket.selected };
  }

  open = (option) => {
    const t = this.props.ticket;
    track('support_booking_clicked', {
      game: t.game.id,
      service: t.service.id,
      quantity: option.quantity,
    });
  };

  render() {
    const t = this.props.ticket;
    const option =
      t.options.find((o) => o.quantity === this.state.quantity) || t.options[0];
    const unit = t.service.unit;
    const tags = [
      t.rank,
      t.region,
      t.voice === true ? 'Voice chat' : null,
    ].filter(Boolean);
    return (
      <div
        className="sbk"
        role="group"
        aria-label={'Booking: ' + t.game.name + ', ' + t.service.name}
      >
        <style>{CSS}</style>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            padding: '14px 14px 10px',
          }}
        >
          {t.game.img ? (
            <BundledImage
              src={t.game.img}
              alt=""
              width="40"
              height="40"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                objectFit: 'cover',
                flex: '0 0 auto',
              }}
            />
          ) : null}
          <div style={{ minWidth: '0' }}>
            <div
              style={{
                fontSize: '11.5px',
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: '#FFD27A',
                fontWeight: '600',
              }}
            >
              {t.game.name + ' · ' + (KIND[t.service.category] || 'Session')}
            </div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                fontWeight: '750',
                fontSize: '18px',
                lineHeight: '1.2',
                marginTop: '2px',
              }}
            >
              {t.service.name + ', ' + units(option.quantity, unit)}
            </div>
          </div>
        </div>

        {tags.length ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '0 14px 10px',
            }}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '12.5px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: '1px solid rgba(214,187,255,.16)',
                  color: '#C9BCDF',
                  background: 'rgba(255,255,255,.03)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {t.online ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: '0 14px 12px',
              padding: '8px 10px',
              borderRadius: '12px',
              background: 'rgba(124,240,193,.06)',
              border: '1px solid rgba(124,240,193,.18)',
              fontSize: '13px',
              color: '#C9BCDF',
            }}
          >
            <span style={{ display: 'flex', position: 'relative' }}>
              {FACES.slice(0, Math.min(3, t.online)).map((bg, i) => (
                <i
                  key={bg}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    border: '2px solid #160d29',
                    marginLeft: i ? '-8px' : '0',
                    background: bg,
                    display: 'block',
                  }}
                />
              ))}
              <span className="sbk-dot" />
            </span>
            <span>
              <b style={{ color: '#F3EEFF', fontWeight: '600' }}>
                {t.online === 1
                  ? '1 teammate online'
                  : t.online + ' teammates online'}
              </b>{' '}
              now
            </span>
          </div>
        ) : null}

        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            height: '14px',
            margin: '0 -1px',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '12px',
              right: '12px',
              top: '7px',
              borderTop: '1.5px dashed rgba(214,187,255,.2)',
            }}
          />
          {['left', 'right'].map((side) => (
            <span
              key={side}
              style={{
                position: 'absolute',
                top: '0',
                [side]: '-7px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#0E0720',
                border: '1px solid rgba(214,187,255,.16)',
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(' + t.options.length + ', 1fr)',
            gap: '6px',
            padding: '12px 14px 12px',
          }}
        >
          {t.options.map((o) => (
            <button
              key={o.quantity}
              type="button"
              className="sbk-q"
              aria-label={
                units(o.quantity, unit) +
                (o.discountPercent ? ', ' + o.discountPercent + '% off' : '')
              }
              aria-pressed={o.quantity === option.quantity}
              onClick={() => this.setState({ quantity: o.quantity })}
            >
              <b
                style={{
                  display: 'block',
                  fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                  fontSize: '17px',
                  fontWeight: '750',
                }}
              >
                {o.quantity}
              </b>
              <small style={{ fontSize: '12px', color: '#A79DC4' }}>
                {o.quantity === 1 ? unit : unit + 's'}
              </small>
              {o.discountPercent ? (
                <span
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '6px',
                    padding: '1px 7px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#0B2A1E',
                    background: '#7CF0C1',
                    boxShadow: '0 4px 12px -4px rgba(124,240,193,.7)',
                  }}
                >
                  {'-' + o.discountPercent + '%'}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            <span
              style={{
                fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                fontWeight: '750',
                fontSize: '28px',
                letterSpacing: '-.01em',
              }}
            >
              {eur(option.amountMinor)}
            </span>
            {option.fullMinor > option.amountMinor ? (
              <s style={{ color: '#8E84AB', fontSize: '14px' }}>
                {eur(option.fullMinor)}
              </s>
            ) : null}
            {option.fullMinor > option.amountMinor ? (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '13px',
                  color: '#7CF0C1',
                }}
              >
                {'You save ' + eur(option.fullMinor - option.amountMinor)}
              </span>
            ) : null}
          </div>
          <a
            className="sbk-cta"
            href={option.href}
            onClick={() => this.open(option)}
          >
            {'Book ' +
              units(option.quantity, unit) +
              ' · ' +
              eur(option.amountMinor)}
          </a>
          <div
            style={{
              marginTop: '9px',
              fontSize: '12.5px',
              lineHeight: '1.45',
              color: '#B3A9CE',
            }}
          >
            Your choices are filled in. Checkout shows the final total, and you
            are only charged when a teammate accepts.
          </div>
        </div>
      </div>
    );
  }
}
