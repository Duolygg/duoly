import { Component, type ReactNode } from 'react';
import { reportError } from '../../client/analytics/track';

type Props = { source: string; children?: ReactNode; fallback?: ReactNode };

/** Reports island render failures without adding DOM or rethrowing caught errors. */
export default class AnalyticsErrorBoundary extends Component<
  Props,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    reportError(error, this.props.source);
  }

  render() {
    return this.state.failed
      ? (this.props.fallback ?? null)
      : this.props.children;
  }
}
