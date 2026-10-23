export function orderChatEnabled(): boolean {
  return (
    (process.env.ORDER_CHAT_ENABLED ?? import.meta.env.ORDER_CHAT_ENABLED) ===
    'true'
  );
}
