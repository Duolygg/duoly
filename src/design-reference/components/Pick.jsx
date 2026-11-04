'use client';

import React from 'react';

// A dropdown that looks and works like the profile page's country picker (components/account/Profile.jsx):
// the same field, chevron and popup list, with arrow keys, Enter and Escape. `search` turns the field
// into a search box. options: [{ value, label, icon }]. `height` defaults to 50px (the /apply fields).
export default class Pick extends React.Component {
  constructor(props) {
    super(props);
    this.state = { open: false, query: '', hi: 0 };
  }
  list() {
    const q = this.state.query.trim().toLowerCase();
    return q ? this.props.options.filter((o) => o.label.toLowerCase().includes(q)) : this.props.options;
  }
  open() {
    const i = this.props.options.findIndex((o) => o.value === this.props.value);
    this.setState({ open: true, query: '', hi: Math.max(0, i) });
  }
  close() {
    this.setState({ open: false, query: '' });
  }
  pick(o) {
    this.props.onPick(o.value);
    this.close();
  }
  onKey(e) {
    const list = this.list();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.state.open) return this.open();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      this.setState({ hi: Math.min(Math.max(this.state.hi + step, 0), list.length - 1) });
    } else if (e.key === 'Enter' || (e.key === ' ' && !this.props.search)) {
      e.preventDefault();
      if (!this.state.open) return this.open();
      if (list[this.state.hi]) this.pick(list[this.state.hi]);
    } else if (e.key === 'Escape') {
      this.close();
    }
  }
  render() {
    const p = this.props;
    const s = this.state;
    const list = s.open ? this.list() : [];
    const picked = p.options.find((o) => o.value === p.value);
    const icon = picked && picked.icon && !(p.search && s.open) ? picked.icon : '';
    const lead = icon || p.search;
    const field = {
      height: p.height || '50px', borderRadius: '14px', paddingLeft: lead ? '46px' : '14px', paddingRight: '40px',
      transform: 'none', filter: 'none'
    };
    const common = {
      id: p.id, className: 'pf-input', role: 'combobox',
      'aria-expanded': s.open ? 'true' : 'false', 'aria-controls': p.id + '-list',
      'aria-activedescendant': s.open && list[s.hi] ? p.id + '-o' + s.hi : undefined,
      onBlur: () => setTimeout(() => this.close(), 120),
      onKeyDown: (e) => this.onKey(e)
    };
    return (
      <div style={{ position: 'relative' }}>
        {icon ? (
          <img src={icon} alt="" width="22" height="16" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '22px', height: '16px', borderRadius: '3px', objectFit: 'cover', pointerEvents: 'none', zIndex: '1' }} />
        ) : p.search ? (
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E84AB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '17px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: '1' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        ) : null}
        {p.search ? (
          <input
            {...common}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={picked ? picked.label : p.placeholder}
            value={s.open ? s.query : picked ? picked.label : ''}
            onFocus={() => this.open()}
            onClick={() => (s.open ? null : this.open())}
            onChange={(e) => this.setState({ query: e.target.value, open: true, hi: 0 })}
            style={field}
          />
        ) : (
          <button
            {...common}
            type="button"
            aria-haspopup="listbox"
            onClick={() => (s.open ? this.close() : this.open())}
            style={{ ...field, display: 'flex', alignItems: 'center', textAlign: 'left', color: picked ? '#FFFFFF' : '#6A6086' }}
          >
            {picked ? picked.label : p.placeholder}
          </button>
        )}
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E84AB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' + (s.open ? ' rotate(180deg)' : ''), pointerEvents: 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        {s.open ? (
          <ul id={p.id + '-list'} role="listbox" aria-label={p.label} className="dl-pop dl-scroll" style={{ position: 'absolute', left: '0', right: '0', top: 'calc(100% + 6px)', zIndex: '10', maxHeight: '280px', overflowY: 'auto', margin: '0', padding: '6px', listStyle: 'none', borderRadius: '14px', background: '#170E2C', border: '1px solid rgba(214, 187, 255, .18)', boxShadow: '0 24px 60px rgba(0, 0, 0, .6)', animation: 'dlpop .16s ease-out', textAlign: 'left' }}>
            {list.length ? list.map((o, i) => (
              <li
                key={o.value}
                id={p.id + '-o' + i}
                role="option"
                aria-selected={o.value === p.value ? 'true' : 'false'}
                onMouseDown={(e) => { e.preventDefault(); this.pick(o); }}
                onMouseEnter={() => this.setState({ hi: i })}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', color: '#F3EEFF', background: i === s.hi ? 'rgba(214, 187, 255, .1)' : 'transparent' }}
              >
                {o.icon ? <img src={o.icon} alt="" width="22" height="16" loading="lazy" style={{ width: '22px', height: '16px', borderRadius: '3px', objectFit: 'cover', flex: '0 0 auto' }} /> : null}
                {o.label}
                {o.value === p.value ? (
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D6BBFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : null}
              </li>
            )) : (
              <li style={{ padding: '12px 10px', fontSize: '14px', color: '#8E84AB' }}>
                No match for “{s.query}”.
              </li>
            )}
          </ul>
        ) : null}
      </div>
    );
  }
}
