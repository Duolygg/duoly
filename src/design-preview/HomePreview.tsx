import Home from '../design-reference/components/Home.jsx';
import {
  announcePreviewUnavailable,
  PREVIEW_AUTH_UNAVAILABLE,
} from './preview-auth';

const unavailable = PREVIEW_AUTH_UNAVAILABLE;

export default function HomePreview() {
  const previewProps: Record<string, unknown> = {
    session: null,
    initialCurrency: 'EUR',
    authError: null,
    askLogin: false,
    onCurrency: (code: string) => {
      try {
        window.localStorage.setItem('duoly-currency', code);
      } catch {
        // Local currency selection is optional in the design preview.
      }
    },
    onSignIn: () => announcePreviewUnavailable(unavailable),
    onSignOut: () => undefined,
    onEmailAuth: async () => unavailable,
  };

  return <Home {...previewProps} />;
}
