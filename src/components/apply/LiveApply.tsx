import Apply from '../../design-reference/components/Apply.jsx';

/** The original /apply form, sending to POST /api/apply with the page's CSRF token. */
export default function LiveApply({ csrf }: { csrf: string }) {
  const onSend = (form: Record<string, unknown>) =>
    fetch('/api/apply', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, csrf }),
    });
  return <Apply chrome={false} onSend={onSend} />;
}
