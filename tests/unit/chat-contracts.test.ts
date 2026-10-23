import { describe, expect, it } from 'vitest';
import {
  ChatMessageSchema,
  ChatRoomSchema,
  ChatSendInputSchema,
  ChatSendResultSchema,
} from '../../src/contracts/chat';
const order = '11111111-1111-4111-8111-111111111111';
const assignment = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333';
const message = {
  id: '44444444-4444-4444-8444-444444444444',
  sequence: 1,
  kind: 'user',
  sender: 'customer',
  name: 'Sam',
  image: '/assets/avatars/avatar-1.png',
  body: 'Ready 🎮',
  created_at: '2026-10-23T08:00:00Z',
  request_id: request,
};
describe('private chat contracts', () => {
  it('accepts Unicode emoji and counts code points rather than UTF-16 units', () => {
    expect(
      ChatSendInputSchema.parse({
        assignment_id: assignment,
        request_id: request,
        body: '🎮'.repeat(500),
      }).body,
    ).toHaveLength(1000);
    expect(
      ChatSendInputSchema.safeParse({
        assignment_id: assignment,
        request_id: request,
        body: '🎮'.repeat(501),
      }).success,
    ).toBe(false);
  });
  it('rejects spoofed authority, whitespace and malformed IDs without repairing them', () => {
    for (const patch of [
      { sender: 'admin' },
      { body: ' \n\t ' },
      { assignment_id: assignment + 'x' },
    ])
      expect(
        ChatSendInputSchema.safeParse({
          assignment_id: assignment,
          request_id: request,
          body: 'Hello',
          ...patch,
        }).success,
      ).toBe(false);
  });
  it('permits only profile-approved image sources and consistent system actors', () => {
    expect(ChatMessageSchema.safeParse(message).success).toBe(true);
    for (const patch of [
      { image: 'https://tracker.invalid/pixel' },
      { kind: 'system' },
      { email: 'private@example.invalid' },
    ])
      expect(
        ChatMessageSchema.safeParse({ ...message, ...patch }).success,
      ).toBe(false);
  });
  it('requires monotonic unique messages and hides archives from teammate DTOs', () => {
    const room = {
      order_id: order,
      assignment_id: assignment,
      viewer: 'teammate',
      writable: true,
      participant: { role: 'customer', name: 'Sam', image: '' },
      messages: [message],
      typing: [],
      archives: [],
    };
    expect(ChatRoomSchema.safeParse(room).success).toBe(true);
    expect(
      ChatRoomSchema.safeParse({ ...room, messages: [message, message] })
        .success,
    ).toBe(false);
    expect(
      ChatRoomSchema.safeParse({
        ...room,
        archives: [
          { assignment_id: assignment, label: 'Previous conversation' },
        ],
      }).success,
    ).toBe(false);
  });
  it('cannot label blocked text as delivered or mismatch the idempotent acknowledgement', () => {
    const result = {
      order_id: order,
      assignment_id: assignment,
      request_id: request,
      outcome: 'sent',
      message,
      note: null,
    };
    expect(ChatSendResultSchema.safeParse(result).success).toBe(true);
    expect(
      ChatSendResultSchema.safeParse({
        ...result,
        outcome: 'blocked',
        note: 'Not sent',
      }).success,
    ).toBe(false);
    expect(
      ChatSendResultSchema.safeParse({ ...result, request_id: order }).success,
    ).toBe(false);
  });
});
