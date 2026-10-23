import React from 'react';

// Keeps a crash in one admin screen from blanking the whole page: shows what failed, with a
// reload, instead of React unmounting everything to the dark background.
export default class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Duoly admin crashed', error, info && info.componentStack);
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    const detail = String((e && (e.stack || e.message)) || e)
      .split('\n')
      .slice(0, 4)
      .join('\n');
    return (
      <div
        role="alert"
        style={{
          maxWidth: '640px',
          margin: '48px auto',
          padding: '24px',
          borderRadius: '20px',
          background: '#120B22',
          border: '1px solid rgba(255, 138, 155, .35)',
          color: '#F3EEFF',
          fontFamily: 'Geist, system-ui, sans-serif',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
          Something in the admin broke.
        </h1>
        <p style={{ margin: '8px 0 0', color: '#A79DC4', fontSize: '14px' }}>
          Nothing was changed. Send this message to the team, then try a reload.
        </p>
        <pre
          style={{
            margin: '14px 0 0',
            padding: '12px',
            borderRadius: '12px',
            background: '#090414',
            color: '#FF8A9B',
            fontSize: '12.5px',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {detail}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: '14px',
            minHeight: '40px',
            padding: '0 16px',
            borderRadius: '12px',
            border: 'none',
            background: '#D6BBFF',
            color: '#17092E',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
