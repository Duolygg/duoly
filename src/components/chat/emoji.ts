import type { ChatSendInput } from '../../contracts/chat';

/** Locally bundled Unicode only: no third-party picker, requests or HTML. */
export const EMOJI = [
  { value: '👋', label: 'Wave' },
  { value: '👍', label: 'Thumbs up' },
  { value: '😊', label: 'Smile' },
  { value: '😂', label: 'Laugh' },
  { value: '💜', label: 'Purple heart' },
  { value: '🎮', label: 'Game controller' },
  { value: '🎉', label: 'Celebrate' },
  { value: '🔥', label: 'Fire' },
  { value: '🤝', label: 'Handshake' },
  { value: '🙌', label: 'Raised hands' },
  { value: '✨', label: 'Sparkles' },
  { value: '🏆', label: 'Trophy' },
] as const;
export const codePointLength = (text: string) => Array.from(text).length;
export function shouldSendOnEnter(event: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
}) {
  return (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229
  );
}
export const canSendDraft = (text: string) =>
  text.trim().length > 0 && codePointLength(text) <= 500;

/** One guard per mounted session/read stream. Disposal is irreversible. */
export function createRequestGuard() {
  let version = 0;
  let disposed = false;
  return {
    next: () => ++version,
    isCurrent: (ticket: number) => !disposed && ticket === version,
    dispose: () => {
      disposed = true;
      version++;
    },
  };
}
export function makeChatAttempt(
  body: string,
  assignment_id: string,
  request_id: string,
): Readonly<ChatSendInput> | null {
  return canSendDraft(body)
    ? Object.freeze({ assignment_id, request_id, body: body.trim() })
    : null;
}
export function chatFailure(status: number) {
  return [401, 403, 404].includes(status)
    ? 'denied'
    : status === 409
      ? 'stale'
      : status === 429
        ? 'rate-limited'
        : 'uncertain';
}
export const typingDeadline = (expiresAt: string, receivedAt: number) =>
  Math.min(Date.parse(expiresAt), receivedAt + 4000);
export const isNearBottom = (element: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}) => element.scrollHeight - element.scrollTop - element.clientHeight <= 72;
