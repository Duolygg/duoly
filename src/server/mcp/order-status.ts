import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import {
  OrderStatusSchema,
  StoredOrderStatusSchema,
} from '../../contracts/order-status';
import { validStatusToken, statusTokenHash } from '../orders/status-token';
import { statusRpc, type StatusRpc } from '../orders/status-storage';
import { takeDurableLimit } from './limits';
import template from './order-card.html?raw';
import script from './order-card-view.js?raw';

export const ORDER_CARD_URI = 'ui://duoly/order-v1.html';
const input = z.strictObject({ token: z.string().max(256) });
export function nextStep(s: {
  status: string;
  accepted: boolean;
  team: { status: string } | null;
}) {
  if (s.status === 'cancelled') return 'Open Duoly for cancellation details';
  if (s.status === 'completed')
    return s.team?.status === 'started'
      ? 'This seat finished; the team session continues'
      : 'Session complete; review it on Duoly';
  if (s.accepted && s.team?.status === 'waiting')
    return 'Your teammate accepted; waiting for the remaining seats';
  return s.accepted
    ? 'Open your Duoly order room to coordinate'
    : 'Wait in your Duoly order room';
}
// View-only receipt and authenticated room destination stay out of model-visible data.
export const OrderStatusOutput = OrderStatusSchema.omit({
  rank: true,
  region: true,
  paidEurMinor: true,
  bookedAt: true,
  searchingAt: true,
  acceptedAt: true,
  completedAt: true,
  title: true,
});
type StatusResult = {
  isError?: boolean;
  content: { type: 'text'; text: string }[];
  structuredContent?: z.infer<typeof OrderStatusOutput>;
  _meta?: Record<string, unknown>;
};
const refusal = (): StatusResult => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: 'This order code is invalid or no longer available. Generate a new code in your Duoly order room.',
    },
  ],
});
export async function orderStatusResult(
  args: unknown,
  rpc?: StatusRpc,
): Promise<StatusResult> {
  const parsed = input.safeParse(args);
  if (!parsed.success || !validStatusToken(parsed.data.token)) return refusal();
  try {
    const hash = await statusTokenHash(parsed.data.token);
    rpc ??= statusRpc();
    const quota = await takeDurableLimit(rpc, hash);
    if (!quota.allowed) throw new Error('Unavailable');
    const response = await rpc('mcp_order_status', { p_token_hash: hash });
    if (response.error) throw new Error('Unavailable');
    if (response.data === null) return refusal();
    const stored = StoredOrderStatusSchema.parse(response.data);
    const { roomUrl, ...view } = stored;
    const data = {
      ...view,
      nextStep: nextStep(stored),
      updatedAt: new Date().toISOString(),
    };
    const structuredContent = OrderStatusOutput.parse(
      Object.fromEntries(
        Object.entries(data).filter(([k]) =>
          Object.hasOwn(OrderStatusOutput.shape, k),
        ),
      ),
    );
    return {
      content: [
        {
          type: 'text',
          text: `${data.title}: ${data.status}. ${data.accepted && data.teammateDisplayName ? `Teammate: ${data.teammateDisplayName}. ` : ''}${data.nextStep}.`,
        },
      ],
      structuredContent,
      _meta: { 'gg.duoly/card': { ...data, roomUrl } },
    };
  } catch {
    return {
      isError: true,
      content: [
        { type: 'text', text: 'Order status unavailable. Try again later.' },
      ],
    };
  }
}
export function registerOrderStatus(server: McpServer) {
  const meta = {
    ui: {
      prefersBorder: false,
      csp: { resourceDomains: ['https://duoly.gg'], connectDomains: [] },
    },
  };
  registerAppResource(
    server,
    'order-status',
    ORDER_CARD_URI,
    { mimeType: RESOURCE_MIME_TYPE, _meta: meta },
    async () => ({
      contents: [
        {
          uri: ORDER_CARD_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: template.replace('__SCRIPT__', () => script),
          _meta: meta,
        },
      ],
    }),
  );
  registerAppTool(
    server,
    'get_order_status',
    {
      title: 'Check your order',
      description:
        'Read the limited status of one Duoly order with its revocable dos_ code. Never ask for a password. The code is private; do not repeat or put it in a URL.',
      inputSchema: input,
      outputSchema: OrderStatusOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: ORDER_CARD_URI, visibility: ['model', 'app'] },
      },
    },
    async (args) => orderStatusResult(args),
  );
}
