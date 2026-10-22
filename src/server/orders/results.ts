import {
  OrderResponseSchemas,
  OrderRpcErrorSchema,
  type OrderResponse,
  type OrderResponseKind,
  type OrderRpcError,
} from '../../contracts/orders';

export type OrderResult<K extends OrderResponseKind> =
  | {
      readonly ok: true;
      readonly status: 200;
      readonly payload: OrderResponse<K>;
    }
  | {
      readonly ok: false;
      readonly status: OrderRpcError['error']['code'] | 502 | 503;
      readonly payload: { readonly error: string };
    };

const SafeBusinessMessages = {
  400: 'Invalid order request.',
  401: 'Authentication required.',
  403: 'Order access denied.',
  404: 'Order not found.',
  409: 'Order action unavailable.',
  410: 'Order expired or cancelled.',
} as const;

/** Pure boundary: no SDK/network dependency and no backend diagnostics in output. */
export function decodeOrderRpcResult<K extends OrderResponseKind>(
  kind: K,
  data: unknown,
  transportError: unknown,
): OrderResult<K>;
export function decodeOrderRpcResult(
  kind: OrderResponseKind,
  data: unknown,
  transportError: unknown,
): OrderResult<OrderResponseKind> {
  // Even falsy non-null error values are not evidence of a successful transport.
  if (transportError !== null && transportError !== undefined) {
    return {
      ok: false,
      status: 503,
      payload: { error: 'Order service unavailable.' },
    };
  }

  const businessError = OrderRpcErrorSchema.safeParse(data);
  if (businessError.success) {
    const status = businessError.data.error.code;
    return {
      ok: false,
      status,
      payload: { error: SafeBusinessMessages[status] },
    };
  }

  if (Object.hasOwn(OrderResponseSchemas, kind)) {
    const response = OrderResponseSchemas[kind].safeParse(data);
    if (response.success) {
      return { ok: true, status: 200, payload: response.data };
    }
  }
  return {
    ok: false,
    status: 502,
    payload: { error: 'Invalid order service response.' },
  };
}
