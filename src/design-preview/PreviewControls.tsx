import { useEffect, useState } from 'react';
import { announcePreviewUnavailable } from './preview-auth';

export default function PreviewControls() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const disableSensitive = () => {
      document
        .querySelectorAll<HTMLInputElement>(
          'input[type="password"], input[type="file"], input#dl-pass',
        )
        .forEach((input) => {
          input.disabled = true;
          input.title =
            'Unavailable in the design preview. Do not enter real credentials or upload files.';
        });
    };
    const showNotice = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (
        detail &&
        typeof detail === 'object' &&
        'message' in detail &&
        typeof detail.message === 'string'
      )
        setMessage(detail.message.slice(0, 500));
    };
    const block = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      announcePreviewUnavailable();
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>('button');
      if (button?.type === 'submit' && button.closest('form')) {
        block(event);
        return;
      }
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
      if (anchor) {
        const url = new URL(anchor.href, window.location.origin);
        if (
          url.origin === window.location.origin &&
          url.pathname.startsWith('/api/')
        )
          block(event);
      }
    };
    window.addEventListener('duoly:preview-unavailable', showNotice);
    document.addEventListener('submit', block, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    const observer = new MutationObserver(disableSensitive);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type'],
    });
    disableSensitive();
    document.documentElement.dataset.previewGuards = 'ready';
    return () => {
      observer.disconnect();
      window.removeEventListener('duoly:preview-unavailable', showNotice);
      document.removeEventListener('submit', block, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
    };
  }, []);
  if (!message) return null;
  return (
    <aside
      aria-label="Preview action notice"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 2147483000,
        maxWidth: 'min(380px, calc(100vw - 32px))',
        boxSizing: 'border-box',
        padding: '16px 44px 16px 18px',
        borderRadius: 16,
        background: '#23143c',
        color: '#f3eeff',
        border: '1px solid #d6bbff',
        boxShadow: '0 12px 40px #0008',
        font: '14px/1.5 Geist, system-ui',
      }}
    >
      <span role="status" aria-live="polite">
        {message}
      </span>
      <button
        type="button"
        aria-label="Dismiss preview notice"
        onClick={() => setMessage('')}
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          border: 0,
          background: 'transparent',
          color: '#f3eeff',
          padding: 8,
        }}
      >
        ×
      </button>
    </aside>
  );
}
