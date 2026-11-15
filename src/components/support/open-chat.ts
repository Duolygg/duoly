/*
 * Opening the support chat from somewhere else on the page.
 *
 * SupportChat.jsx listens for `duoly:chat`. Passing a draft puts that sentence in the input and
 * nothing else: it is never sent, so whoever opened the chat still reads it, edits it and presses
 * send themselves. Used by "Add a game" and by "Missing someone? Tell us" in the character picker.
 */
/** How much of a draft the chat takes. Long enough for a sentence about one game. */
export const CHAT_DRAFT_MAX = 240;

export function openSupportChat(draft?: string): void {
  const text = String(draft ?? '')
    /* Control and format characters cannot help a support message and can hide what it says. */
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .trim()
    .slice(0, CHAT_DRAFT_MAX);
  window.dispatchEvent(
    text
      ? new CustomEvent('duoly:chat', { detail: { draft: text } })
      : new Event('duoly:chat'),
  );
}
