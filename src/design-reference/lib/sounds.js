// Sound for a new order-chat message from the other side (customer ↔ teammate).
// Browsers only allow sound after the page has been clicked or typed in once, so the first message
// on an untouched page may stay silent. That's expected and nothing to handle.
const CHAT_PING = '/assets/sounds/chat-message.mp3';

export function newChatPing() {
  if (typeof Audio === 'undefined') return null;
  const a = new Audio(CHAT_PING);
  a.preload = 'auto';
  a.volume = 0.7;
  return a;
}

export function playChatPing(audio) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {}
}
