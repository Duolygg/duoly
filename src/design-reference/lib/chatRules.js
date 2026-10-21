// Order chat rules, shared by the server (which enforces them) and both chat UIs (which warn early).
// Keeps payments and account access on Duoly: messages like these are never delivered.
export const BLOCKED = /\b(pass(word|wort)?|login details|account details|paypal|venmo|cash ?app|iban|bank transfer|crypto|whatsapp|telegram|snapchat|pay (me|you) (directly|outside))\b/i;
export const BLOCKED_NOTE = 'Not sent: keep payments and account details on Duoly. Never ask for logins or outside payments.';
export const MAX_CHAT = 500;
