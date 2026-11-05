import { useEffect, useRef, useState } from 'react';
import { track } from '../../client/analytics/track';
import { parseConsent } from '../../contracts/consent';
import type { CreatorPricePreview as Preview } from '../../contracts/creator-price';
type Result = {
  valid: boolean;
  displayName: string | null;
  reason: string | null;
  preview?: Preview;
};
export default function CreatorCode({
  initialCode = '',
  explicit = false,
  csrf,
  selection,
  currency,
  onChange,
}: {
  initialCode?: string;
  explicit?: boolean;
  csrf: string;
  selection: Record<string, unknown>;
  currency: 'EUR' | 'USD';
  onChange: (
    code: string | undefined,
    valid: boolean,
    preview?: Preview,
    appliedCode?: string,
  ) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const source = useRef<'typed' | 'link'>(explicit ? 'typed' : 'link');
  const quoteKey = JSON.stringify({ selection, currency });
  const check = async (value: string) => {
    const current = ++revision.current;
    onChange(source.current === 'typed' ? value : undefined, false);
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/creators/code/check', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorCode: value, csrf, selection, currency }),
      });
      const data: Result = await response.json();
      if (current !== revision.current) return;
      const valid =
        response.ok &&
        data.valid === true &&
        data.preview?.currency === currency;
      const normalized = value.trim().toUpperCase();
      setResult({ ...data, valid });
      if (valid) setCode(normalized);
      onChange(
        source.current === 'typed' ? value : undefined,
        valid,
        valid ? data.preview : undefined,
        valid ? normalized : undefined,
      );
      track('creator_code_applied', { source: source.current, valid });
    } catch {
      if (current === revision.current)
        setResult({
          valid: false,
          displayName: null,
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
    } else if (code) void check(code);
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
  }, [quoteKey]);
  const savings = result?.preview
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
        result.preview.discountMinor / 100,
      )
    : '';
  return (
    <div className="creator-code" data-private-block="">
      <label htmlFor="creator-code-input">
        Creator code <span>· optional</span>
      </label>
      <div className="creator-code-controls">
        <div className="creator-code-field">
          <input
            id="creator-code-input"
            aria-describedby="creator-code-result"
            value={code}
            readOnly={!!result?.valid}
            placeholder="Enter a creator code"
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
          {result?.valid && (
            <span className="creator-code-check" aria-hidden="true">
              ✓
            </span>
          )}
        </div>
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
            className="creator-code-remove"
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
            Remove
          </button>
        )}
      </div>
      <p
        id="creator-code-result"
        role="status"
        aria-live="polite"
        className={result?.valid ? 'creator-code-success' : ''}
      >
        {result?.valid ? (
          <>
            <span aria-hidden="true">✓ </span>
            {result.preview?.discountKind === 'pro'
              ? `${code} applied. Your PRO discount already saves ${savings}.`
              : `${code} applied. You save ${savings} with ${result.displayName}.`}
          </>
        ) : (
          result?.reason
        )}
      </p>
    </div>
  );
}
