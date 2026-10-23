const toMs = (value) => (value ? Date.parse(value) : null);
const status = (value) => (value === 'human' ? 'open' : value);

export function supportInbox(data) {
  const conversations = (data.conversations || []).map((conversation) => ({
    ...conversation,
    status: status(conversation.status),
    updatedAt: toMs(conversation.updatedAt),
    waitingSince: toMs(conversation.waitingSince),
  }));
  const open = data.open
    ? {
        ...data.open,
        status: status(data.open.status),
        updatedAt: toMs(data.open.updatedAt),
        waitingSince: toMs(data.open.waitingSince),
        messages: (data.open.messages || []).map((message) => ({
          ...message,
          at: toMs(message.at),
        })),
      }
    : null;
  return { conversations, open };
}
