import React from 'react';
import { C, btn, dateOnly } from '../../design-reference/components/admin/ui';

/**
 * A played order's screenshots for admins (migration 20261105140000_admin_correct_results.sql):
 * view them, remove a wrong one (with a reason; the customer and teammate stop seeing it, the file
 * stays for disputes), show it again, and upload the correct ones (up to 5 visible).
 * Used in Match reports and in the Orders drawer.
 */
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 1572864;

export default class ProofManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = { proofs: null, error: '', uploading: 0 };
    this.file = React.createRef();
  }
  componentDidMount() {
    this.load();
  }
  async load() {
    const res = await this.props.api
      .get('/api/admin/proofs/' + this.props.orderId)
      .catch(() => ({ ok: false }));
    if (!res.ok)
      return this.setState({
        proofs: [],
        error: res.error || 'Couldn’t load the screenshots.',
      });
    this.setState({ proofs: res.data.proofs || [], error: '' });
  }
  setRemoved(p, removed, reason) {
    return this.props.api
      .post('/api/admin/proofs/' + this.props.orderId, {
        orderId: this.props.orderId,
        proofId: p.id,
        removed,
        reason: reason || '',
      })
      .then((res) => {
        if (!res.ok)
          return this.props.toast(
            res.error || 'Couldn’t change that screenshot.',
            'warn',
          );
        this.setState({ proofs: res.data.proofs || [] });
        this.props.log();
        this.props.toast(
          removed
            ? 'Screenshot removed. The customer and teammate don’t see it anymore.'
            : 'Screenshot is visible again.',
        );
      });
  }
  askRemove(p) {
    this.props.ask({
      title: 'Remove this screenshot?',
      body: 'The customer and the teammate stop seeing it. It stays stored privately for disputes, and you can show it again.',
      confirm: 'Remove',
      kind: 'danger',
      field: {
        label: 'Reason (shown in the audit log)',
        placeholder: 'e.g. not from this match',
        required: true,
      },
      onConfirm: (reason) => this.setRemoved(p, true, reason),
    });
  }
  async upload(files) {
    const list = [...(files || [])];
    for (const file of list) {
      if (!TYPES.includes(file.type) || file.size > MAX_BYTES) {
        this.props.toast(
          file.name + ': use a PNG, JPEG or WebP up to 1.5 MB.',
          'warn',
        );
        continue;
      }
      this.setState((s) => ({ uploading: s.uploading + 1 }));
      try {
        const response = await fetch(
          '/api/admin/proofs/' + this.props.orderId + '/upload',
          {
            method: 'POST',
            credentials: 'same-origin',
            redirect: 'error',
            headers: {
              'Content-Type': file.type,
              'X-CSRF-Token': this.props.csrf,
              'X-Idempotency-Key': crypto.randomUUID(),
            },
            body: file,
          },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          this.props.toast(
            body.error || 'Couldn’t upload ' + file.name + '.',
            'warn',
          );
        }
      } catch {
        this.props.toast('Can’t reach Duoly right now.', 'warn');
      } finally {
        this.setState((s) => ({ uploading: s.uploading - 1 }));
      }
    }
    if (this.file.current) this.file.current.value = '';
    await this.load();
    this.props.log();
  }
  render() {
    const { proofs, error, uploading } = this.state;
    const visible = (proofs || []).filter((p) => !p.removed).length;
    const small = {
      ...btn(),
      minHeight: '30px',
      padding: '0 10px',
      fontSize: '12.5px',
    };
    return (
      <div data-proof-manager style={{ marginTop: '12px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: C.faint,
            }}
          >
            Screenshots
          </span>
          <span style={{ fontSize: '12.5px', color: C.dim }}>
            {proofs ? visible + ' visible' : 'Loading…'}
          </span>
          <label
            style={{
              ...small,
              display: 'inline-flex',
              alignItems: 'center',
              marginLeft: 'auto',
              cursor: visible >= 5 || uploading ? 'not-allowed' : 'pointer',
              opacity: visible >= 5 || uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Uploading…' : 'Add screenshots'}
            <input
              ref={this.file}
              type="file"
              accept={TYPES.join(',')}
              multiple
              disabled={visible >= 5 || !!uploading}
              aria-label="Add correct screenshots"
              onChange={(e) => this.upload(e.target.files)}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        {error ? (
          <p role="alert" style={{ margin: '6px 0 0', color: C.gold }}>
            {error}
          </p>
        ) : null}
        {proofs && !proofs.length && !error ? (
          <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: C.dim }}>
            No screenshots on this order.
          </p>
        ) : null}
        <div
          style={{
            marginTop: '8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '8px',
          }}
        >
          {(proofs || []).map((p) => {
            const src =
              '/api/orders/' +
              encodeURIComponent(this.props.orderId) +
              '/proof/' +
              encodeURIComponent(p.id);
            return (
              <figure
                key={p.id}
                data-proof={p.removed ? 'removed' : 'visible'}
                style={{
                  margin: '0',
                  padding: '6px',
                  borderRadius: '12px',
                  background: C.panel,
                  border:
                    '1px solid ' +
                    (p.removed ? 'rgba(255,138,155,.35)' : C.line2),
                }}
              >
                <a href={src} target="_blank" rel="noreferrer">
                  <img
                    src={src}
                    alt={'Screenshot from ' + dateOnly(p.created_at)}
                    loading="lazy"
                    style={{
                      display: 'block',
                      width: '100%',
                      aspectRatio: '16 / 10',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      opacity: p.removed ? 0.35 : 1,
                    }}
                  />
                </a>
                <figcaption
                  style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: C.dim,
                    lineHeight: '1.4',
                  }}
                >
                  {p.removed ? (
                    <span style={{ color: C.red, fontWeight: '700' }}>
                      Removed by {p.removed.by}: {p.removed.reason}
                    </span>
                  ) : p.addedBy ? (
                    <span style={{ color: C.cyan }}>Added by {p.addedBy}</span>
                  ) : (
                    'From the teammate'
                  )}
                </figcaption>
                <div style={{ marginTop: '6px' }}>
                  {p.removed ? (
                    <button
                      type="button"
                      style={small}
                      onClick={() => this.setRemoved(p, false, '')}
                    >
                      Show again
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={{
                        ...btn('danger'),
                        minHeight: '30px',
                        padding: '0 10px',
                        fontSize: '12.5px',
                      }}
                      onClick={() => this.askRemove(p)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </figure>
            );
          })}
        </div>
      </div>
    );
  }
}
