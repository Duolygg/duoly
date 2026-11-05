const uuid = (v: unknown) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
const slug = (v: unknown) =>
  typeof v === 'string' && /^[a-z0-9_-]{1,40}$/.test(v);
const number = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;
const integer = (v: unknown) => number(v) && Number.isSafeInteger(v);
/** Strict content-free AI schemas, also applied at SDK egress. */
export function sanitizeAiProperties(
  event: string,
  props: Record<string, unknown> = {},
): Record<string, unknown> | null {
  if (event !== '$ai_generation' && event !== '$ai_span') return null;
  const schema: Record<string, (v: unknown) => boolean> = {
    $ai_trace_id: uuid,
    $ai_span_id: uuid,
    $ai_parent_id: uuid,
    $ai_session_id: uuid,
    $ai_latency: number,
    $ai_is_error: (v) => typeof v === 'boolean',
    ...(event === '$ai_generation'
      ? {
          $ai_provider: (v: unknown) => v === 'openai',
          $ai_model: slug,
          $ai_input_tokens: integer,
          $ai_output_tokens: integer,
          $ai_cache_read_input_tokens: integer,
          $ai_http_status: (v: unknown) =>
            integer(v) && Number(v) >= 100 && Number(v) <= 599,
          tool_names: (v: unknown) =>
            Array.isArray(v) && v.length <= 20 && v.every(slug),
        }
      : {
          $ai_span_name: slug,
          outcome: (v: unknown) =>
            ['ok', 'error', 'denied', 'not_found', 'invalid'].includes(
              String(v),
            ),
        }),
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props))
    if (Object.hasOwn(schema, key) && schema[key]!(value)) out[key] = value;
  return out;
}
export function generationProperties(input: {
  traceId: string;
  latency: number;
  status?: number;
  error: boolean;
  toolNames: string[];
  payload?: unknown;
  spanId?: string;
  sessionId?: string;
}) {
  const usage = (
    input.payload as {
      usage?: {
        input_tokens?: unknown;
        output_tokens?: unknown;
        input_tokens_details?: { cached_tokens?: unknown };
      };
    } | null
  )?.usage;
  return sanitizeAiProperties('$ai_generation', {
    $ai_trace_id: input.traceId,
    $ai_span_id: input.spanId,
    $ai_session_id: input.sessionId,
    $ai_provider: 'openai',
    $ai_model: 'gpt-5.4-mini',
    $ai_latency: input.latency,
    $ai_http_status: input.status,
    $ai_is_error: input.error,
    tool_names: input.toolNames,
    $ai_input_tokens: usage?.input_tokens,
    $ai_output_tokens: usage?.output_tokens,
    $ai_cache_read_input_tokens: usage?.input_tokens_details?.cached_tokens,
  })!;
}
