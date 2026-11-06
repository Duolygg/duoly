import {
  createMcpHandler,
  isLegacyRequest,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';
import { createServer } from './tools';
import { rateLimit, type LimitResult } from './limits';

const MAX_BYTES = 16384;
const modern = createMcpHandler(
  (context) =>
    createServer(
      context.requestInfo?.headers.get('User-Agent') ?? '',
      context.requestInfo
        ? new URL(context.requestInfo.url).searchParams.get('client')
        : null,
    ),
  {
    legacy: 'reject',
    responseMode: 'json',
    maxSubscriptions: 0,
    maxRequestBodySize: MAX_BYTES,
  },
);
function error(
  status: number,
  code: number,
  message: string,
  id: unknown = null,
  retryAfter?: number,
) {
  return Response.json(
    {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(retryAfter ? { data: { retryAfterSeconds: retryAfter } } : {}),
      },
    },
    {
      status,
      headers: {
        ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
        'Cache-Control': 'no-store',
      },
    },
  );
}
function allowedOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  if (url.protocol === 'https:') return true;
  return (
    import.meta.env.DEV &&
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  );
}
export async function handleMcp(
  request: Request,
  options: { ip: string; limit?: (ip: string) => Promise<LimitResult> },
): Promise<Response> {
  const origin = request.headers.get('Origin');
  // AI clients call this endpoint from their own sites (Claude sends Origin https://claude.ai) and
  // read a 403 as "sign-in required", which breaks connecting. Every tool is public and read-only,
  // no cookie or credential is accepted and quotas are per IP, so any HTTPS origin may call it.
  // Malformed, opaque ("null") and plain-HTTP origins stay rejected outside local development.
  if (origin !== null && !allowedOrigin(origin))
    return error(403, -32000, 'Origin not allowed.');
  const decorate = (response: Response) => {
    response.headers.set('Cache-Control', 'no-store');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Vary', 'Origin');
    }
    return response;
  };
  if (request.method === 'OPTIONS')
    return decorate(
      new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
          'Access-Control-Max-Age': '600',
        },
      }),
    );
  if (request.method !== 'POST') {
    const r = error(405, -32000, 'Use POST. No GET stream is offered.');
    r.headers.set('Allow', 'POST, OPTIONS');
    return decorate(r);
  }
  if (
    request.headers.get('Content-Type')?.split(';')[0]?.trim() !==
    'application/json'
  )
    return decorate(error(415, -32600, 'Use Content-Type application/json.'));
  // Stream-bound the body before parsing. Content-Length is not trusted.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          return decorate(error(413, -32600, 'Request exceeds 16384 bytes.'));
        }
        chunks.push(part.value);
      }
    } catch {
      return decorate(error(400, -32700, 'Unable to read JSON request.'));
    }
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return decorate(error(400, -32700, 'Invalid JSON.'));
  }
  const id =
    body &&
    typeof body === 'object' &&
    'id' in body &&
    (typeof body.id === 'string' || typeof body.id === 'number')
      ? body.id
      : null;
  if (Array.isArray(body))
    return decorate(error(400, -32600, 'Send one JSON-RPC request per POST.'));
  try {
    const quota = await (options.limit ?? rateLimit)(options.ip);
    if (!quota.allowed)
      return decorate(
        error(
          429,
          -32029,
          'Rate limit exceeded. Retry after the indicated number of seconds.',
          id,
          Math.max(1, quota.retryAfter),
        ),
      );
  } catch {
    return decorate(
      error(
        503,
        -32603,
        'Service temporarily unavailable. Retry in 60 seconds.',
        id,
        60,
      ),
    );
  }
  const inbound = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: bytes,
  });
  try {
    if (await isLegacyRequest(inbound, body)) {
      const server = createServer(
        request.headers.get('User-Agent') ?? '',
        new URL(request.url).searchParams.get('client'),
      );
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      try {
        await server.connect(transport);
        return decorate(
          await transport.handleRequest(inbound, { parsedBody: body }),
        );
      } finally {
        await server.close();
      }
    }
    return decorate(await modern.fetch(inbound, { parsedBody: body }));
  } catch {
    return decorate(error(500, -32603, 'MCP request failed. Retry later.', id));
  }
}
