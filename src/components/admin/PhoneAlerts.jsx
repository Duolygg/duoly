'use client';

import React from 'react';
import { C, btn } from '../../design-reference/components/admin/ui';
import {
  alertState,
  disableAlerts,
  enableAlerts,
  installPrompt,
  isIos,
  isStandalone,
  runInstall,
} from './phone-alerts';

// Top of the support inbox: install "Duoly Admin" on your phone and turn on alerts for chats that
// need a human. Only rendered inside the admin dashboard's Support section.
export default class PhoneAlerts extends React.Component {
  state = { status: 'loading', busy: false, canInstall: false, iosHelp: false };

  componentDidMount() {
    this.refresh();
    this._ready = () => this.setState({ canInstall: !!installPrompt() });
    window.addEventListener('duoly-install-ready', this._ready);
    this._ready();
  }
  componentWillUnmount() {
    window.removeEventListener('duoly-install-ready', this._ready);
  }
  refresh = async () => {
    const status = await alertState().catch(() => 'unsupported');
    this.setState({ status });
  };
  turnOn = async () => {
    this.setState({ busy: true });
    const result = await enableAlerts(this.props.api);
    this.setState({ busy: false });
    if (result.ok) this.props.toast('Phone alerts are on for this device');
    else this.props.toast(result.error || 'That didn’t work.', 'warn');
    this.refresh();
  };
  turnOff = async () => {
    this.setState({ busy: true });
    const result = await disableAlerts(this.props.api);
    this.setState({ busy: false });
    if (result.ok) this.props.toast('Phone alerts are off for this device');
    else this.props.toast(result.error || 'That didn’t work.', 'warn');
    this.refresh();
  };
  install = async () => {
    await runInstall();
    this.setState({ canInstall: false });
  };

  render() {
    const s = this.state;
    if (s.status === 'loading') return null;
    const small = {
      ...btn('primary'),
      minHeight: '32px',
      padding: '0 12px',
      fontSize: '12.5px',
      flex: '0 0 auto',
    };
    const ghost = {
      ...btn(),
      minHeight: '32px',
      padding: '0 12px',
      fontSize: '12.5px',
      flex: '0 0 auto',
    };
    const showIosHelp = isIos() && !isStandalone();
    let text;
    let action = null;
    if (s.status === 'on') {
      text = 'Alerts are on for this device.';
      action = (
        <button
          type="button"
          disabled={s.busy}
          onClick={this.turnOff}
          style={ghost}
        >
          Turn off
        </button>
      );
    } else if (s.status === 'denied') {
      text =
        'Notifications are blocked for this site. Allow them in your phone or browser settings.';
    } else if (s.status === 'install') {
      text = 'Get an alert on your iPhone when someone needs a human.';
      action = (
        <button
          type="button"
          onClick={() => this.setState({ iosHelp: !s.iosHelp })}
          style={small}
          aria-expanded={s.iosHelp ? 'true' : 'false'}
        >
          How
        </button>
      );
    } else if (s.status === 'unsupported') {
      text =
        'This browser can’t show alerts. Use Chrome, Edge, Firefox or Safari.';
    } else {
      text = 'Get an alert on this device when someone needs a human.';
      action = (
        <button
          type="button"
          disabled={s.busy}
          onClick={this.turnOn}
          style={small}
        >
          {s.busy ? 'Turning on…' : 'Turn on'}
        </button>
      );
    }
    return (
      <div
        className="sp-alerts"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: '14px',
          background: 'rgba(214, 187, 255, .08)',
          border: '1px solid rgba(214, 187, 255, .18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={s.status === 'on' ? C.green : C.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flex: '0 0 auto' }}
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span
            role="status"
            style={{
              flex: '1',
              minWidth: '0',
              fontSize: '12.5px',
              lineHeight: '1.4',
              color: C.muted,
            }}
          >
            {text}
          </span>
          {action}
        </div>
        {s.canInstall && !isStandalone() ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                flex: '1',
                minWidth: '0',
                fontSize: '12.5px',
                lineHeight: '1.4',
                color: C.muted,
              }}
            >
              Add Duoly Admin to your home screen.
            </span>
            <button type="button" onClick={this.install} style={ghost}>
              Install app
            </button>
          </div>
        ) : null}
        {showIosHelp && s.iosHelp ? (
          <ol
            style={{
              margin: '0',
              paddingLeft: '20px',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: C.muted,
            }}
          >
            <li>In Safari, tap the Share button, then “Add to Home Screen”.</li>
            <li>Open “Duoly Admin” from your home screen and sign in.</li>
            <li>Come back to Support and tap “Turn on”.</li>
          </ol>
        ) : null}
      </div>
    );
  }
}
