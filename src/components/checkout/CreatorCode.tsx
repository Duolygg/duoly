import { useEffect, useRef, useState } from 'react';
import { track } from '../../client/analytics/track';
import { parseConsent } from '../../contracts/consent';

type Result = {
  valid: boolean;
  displayName: string | null;
  discountPercent: number;
  reason: string | null;
};
export default function CreatorCode({
  initialCode = '',
  explicit = false,
  csrf,
  pro = false,
  onChange,
}: {
  initialCode?: string;
  explicit?: boolean;
  csrf: string;
  pro?: boolean;
  onChange: (code: string | undefined, valid: boolean) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const source = useRef<'typed' | 'link'>(explicit ? 'typed' : 'link');
  const check = async (value: string) => {
    const current = ++revision.current;
    onChange(source.current === 'typed' ? value : undefined, false);
    setBusy(true);
    try {
      const response = await fetch('/api/creators/code/check', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorCode: value, csrf }),
      });
      const data: Result = await response.json();
      if (current !== revision.current) return;
      const valid = response.ok && data.valid === true;
      setResult({ ...data, valid });
      onChange(source.current === 'typed' ? value : undefined, valid);
      track('creator_code_applied', { source: source.current, valid });
    } catch {
      if (current === revision.current)
        setResult({
          valid: false,
          displayName: null,
          discountPercent: 0,
          reason: 'Could not check the code. Try again.',
        });
    } finally {
      if (current === revision.current) setBusy(false);
    }
  };
  useEffect(() => {
    const consentValue = document.cookie
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('duoly-consent='))
      ?.slice('duoly-consent='.length);
    if (source.current === 'link' && !parseConsent(consentValue)?.referral) {
      setCode('');
      onChange(undefined, false);
    } else if (initialCode) void check(initialCode);
    const consent = (event: Event) => {
      if (source.current !== 'link' || (event as CustomEvent).detail?.referral)
        return;
      ++revision.current;
      setCode('');
      setResult(null);
      setBusy(false);
      onChange(undefined, false);
    };
    window.addEventListener('duoly:consent', consent);
    return () => {
      ++revision.current;
      window.removeEventListener('duoly:consent', consent);
    };
  }, []);
  return (
    <div className="creator-code" data-private-block="">
      <label htmlFor="creator-code-input">Creator code</label>
      <p id="creator-code-help">10% off your first order</p>
      <div className="creator-code-controls">
        <input
          id="creator-code-input"
          aria-describedby="creator-code-help creator-code-result"
          value={code}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            ++revision.current;
            source.current = 'typed';
            setCode(event.target.value);
            setResult(null);
            setBusy(false);
            onChange(event.target.value, false);
          }}
        />
        {!result?.valid && (
          <button
            type="button"
            disabled={busy || !code.trim()}
            onClick={() => void check(code)}
          >
            {busy ? 'Checking…' : 'Apply code'}
          </button>
        )}
        {code && (
          <button
            type="button"
            onClick={() => {
              ++revision.current;
              source.current = 'typed';
              setCode('');
              setResult(null);
              setBusy(false);
              onChange('', false);
            }}
          >
            Remove code
          </button>
        )}
      </div>
      <p
        id="creator-code-result"
        role="status"
        className={result?.valid ? 'creator-code-success' : ''}
      >
        {result?.valid
          ? pro
            ? `${result.displayName}: code accepted. Your PRO discount already gives you 10% off.`
            : `${result.displayName}: ${result.discountPercent}% off applied.`
          : result?.reason}
      </p>
    </div>
  );
}
