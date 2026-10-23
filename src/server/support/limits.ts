export const SUPPORT_MESSAGES_PER_MINUTE = 12;

export function canSendMessage(
  userMessageTimes: number[],
  now = Date.now(),
  limit = SUPPORT_MESSAGES_PER_MINUTE,
): boolean {
  return userMessageTimes.filter((at) => now - at < 60_000).length < limit;
}

export function dailyAiLimit(
  value = process.env.SUPPORT_AI_DAILY_LIMIT,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 500;
  return Math.min(parsed, 10_000);
}
