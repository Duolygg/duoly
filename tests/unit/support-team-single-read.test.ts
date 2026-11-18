import { expect, it, vi } from 'vitest';
import {
  conversationView,
  type ConversationRow,
} from '../../src/server/support/store';

it('reuses the payload team snapshot without another team lookup', async () => {
  const order = vi.fn(async () => ({ data: [], error: null }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const service = { from } as unknown as Parameters<typeof conversationView>[0];
  const team = [{ id: 'admin-1', name: 'Mina', image: '', online: true }];
  const result = await conversationView(
    service,
    {
      id: 'chat-1',
      status: 'human',
      claimed_by: 'admin-1',
    } as ConversationRow,
    team,
  );
  expect(result?.agent).toEqual(team[0]);
  expect(result?.messages).toEqual([]);
  expect(from).toHaveBeenCalledTimes(1);
  expect(from).toHaveBeenCalledWith('support_messages');
});
