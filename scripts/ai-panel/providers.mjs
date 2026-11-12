import { normalizeSources } from './sources.mjs';

const { fetch, AbortSignal } = globalThis;

// Snapshot checked against official pricing pages on 2026-11-06. USD, standard tier.
export const providers = {
  openai: {
    model: 'gpt-6-luna',
    input: 0.1,
    output: 0.5,
    search: 0.01,
    env: 'OPENAI_API_KEY',
    // The API analogue of the ChatGPT search surface, not the consumer UI.
    engine: 'OpenAI Responses API (web_search tool)',
  },
  gemini: {
    model: 'gemini-2.5-flash-lite',
    input: 0.1,
    output: 0.4,
    search: 0.035,
    env: 'GEMINI_API_KEY',
    engine: 'Gemini API (google_search grounding)',
  },
  anthropic: {
    model: 'claude-haiku-5-5',
    input: 0.1,
    output: 0.5,
    search: 0.01,
    env: 'ANTHROPIC_API_KEY',
    engine: 'Claude (Anthropic API web search)',
  },
  perplexity: {
    model: 'sonar',
    input: 1,
    output: 1,
    search: 0.005,
    env: 'PERPLEXITY_API_KEY',
    engine: 'Perplexity (Sonar compatibility API)',
    // Logged-out Perplexity answered one query and then demanded a sign-up, which
    // invalidated the 2026-11-09 baseline. It now runs only when the owner opts in.
    requiresOptIn: true,
    enableFlag: '--perplexity',
  },
};

export async function request(url, key, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(90000),
  });
  // Never include response bodies, URLs or request headers in exceptions. They can contain secrets.
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function parseAnswer(provider, data) {
  let answer;
  let urls;
  let searches;
  let searched;
  let input;
  let output;
  let complete;
  let queries = [];
  if (provider === 'openai') {
    const blocks = (data.output ?? []).flatMap((item) => item.content ?? []);
    answer = blocks
      .filter((block) => block.type === 'output_text')
      .map((block) => block.text)
      .join('\n');
    urls = blocks.flatMap((block) =>
      (block.annotations ?? [])
        .filter((a) => a.type === 'url_citation')
        .map((a) => ({ url: a.url, title: a.title })),
    );
    searches = (data.output ?? []).filter(
      (item) => item.type === 'web_search_call',
    ).length;
    searched = searches > 0;
    queries = parseFanOut(data).queries;
    input = data.usage?.input_tokens ?? 0;
    output = data.usage?.output_tokens ?? 0;
    complete = data.status === 'completed';
  } else if (provider === 'gemini') {
    const candidate = data.candidates?.[0];
    answer = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('\n');
    // Grounding chunks are the Google AI Mode source links. The URL is a redirect
    // wrapper, so title and domain metadata travel with it for domain detection.
    urls = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .filter((chunk) => chunk?.web)
      .map((chunk) => ({
        url: chunk.web.uri,
        title: chunk.web.title,
        domain: chunk.web.domain,
      }));
    queries = (candidate?.groundingMetadata?.webSearchQueries ?? []).filter(
      (query) => typeof query === 'string' && query.trim(),
    );
    searched = queries.length > 0 || urls.length > 0;
    searches = searched ? 1 : 0; // Gemini 2.5 bills grounded requests, not individual search queries.
    input = data.usageMetadata?.promptTokenCount ?? 0;
    output =
      (data.usageMetadata?.candidatesTokenCount ?? 0) +
      (data.usageMetadata?.thoughtsTokenCount ?? 0);
    complete = candidate?.finishReason === 'STOP';
  } else if (provider === 'anthropic') {
    const blocks = data.content ?? [];
    answer = blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
    urls = blocks
      .flatMap((block) =>
        (block.citations ?? []).map((c) => ({ url: c.url, title: c.title })),
      )
      .filter((source) => source.url);
    searches = data.usage?.server_tool_use?.web_search_requests ?? 0;
    searched = searches > 0;
    input = data.usage?.input_tokens ?? 0;
    output = data.usage?.output_tokens ?? 0;
    complete = data.stop_reason === 'end_turn';
  } else {
    answer = data.choices?.[0]?.message?.content ?? '';
    urls = [
      ...(data.citations ?? []),
      ...(data.search_results ?? []).map((result) => ({
        url: result?.url,
        title: result?.title,
      })),
    ];
    searched = urls.length > 0;
    searches = 1;
    input = data.usage?.prompt_tokens ?? 0;
    output = data.usage?.completion_tokens ?? 0;
    complete = data.choices?.[0]?.finish_reason === 'stop';
  }
  const sources = normalizeSources(urls);
  return {
    answer,
    sources,
    citedUrls: sources.map((source) => source.url).filter(Boolean),
    citedDomains: [...new Set(sources.map((s) => s.domain).filter(Boolean))],
    searchQueries: [...new Set(queries)],
    searched,
    searches,
    inputTokens: input,
    outputTokens: output,
    complete,
  };
}

// ChatGPT fan-out: the searches the model actually ran for one prompt. The Responses API
// reports each web_search_call action, so queries and opened pages are observable even
// though the consumer UI fan-out is not.
export function parseFanOut(data) {
  const calls = (data.output ?? []).filter(
    (item) => item?.type === 'web_search_call',
  );
  const queries = [];
  const opened = [];
  const retrieved = [];
  const addQuery = (value) => {
    if (typeof value === 'string' && value.trim()) queries.push(value.trim());
  };
  const addUrl = (value) => {
    if (typeof value === 'string' && value.trim()) opened.push(value.trim());
  };
  for (const call of calls) {
    const action = call.action ?? {};
    addQuery(action.query);
    for (const query of action.queries ?? []) addQuery(query);
    addUrl(action.url);
    for (const source of action.sources ?? [])
      if (source?.url) retrieved.push(source.url);
    for (const result of call.results ?? [])
      if (result?.url) retrieved.push(result.url);
  }
  return {
    searchCalls: calls.length,
    queries: [...new Set(queries)],
    openedSources: normalizeSources(opened),
    searchedDomains: [
      ...new Set(
        normalizeSources(retrieved)
          .map((s) => s.domain)
          .filter(Boolean),
      ),
    ],
    traceAvailable: calls.length > 0,
  };
}

export async function ask(provider, key, prompt) {
  const { model } = providers[provider];
  let data;
  if (provider === 'openai') {
    data = await request('https://api.openai.com/v1/responses', key, {
      model,
      input: prompt,
      store: false,
      max_output_tokens: 1800,
      reasoning: { effort: 'low' },
      tools: [{ type: 'web_search', search_context_size: 'low' }],
      tool_choice: 'required',
      max_tool_calls: 1,
    });
  } else if (provider === 'gemini') {
    data = await request(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      '',
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          maxOutputTokens: 1800,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      { 'x-goog-api-key': key, Authorization: '' },
    );
  } else if (provider === 'anthropic') {
    data = await request(
      'https://api.anthropic.com/v1/messages',
      '',
      {
        model,
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
        tools: [
          { type: 'web_search_20250305', name: 'web_search', max_uses: 1 },
        ],
      },
      {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        Authorization: '',
      },
    );
  } else {
    data = await request('https://api.perplexity.ai/chat/completions', key, {
      model,
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
      web_search_options: { search_context_size: 'low' },
    });
  }
  return {
    ...parseAnswer(provider, data),
    actualModel: data.model ?? data.modelVersion ?? model,
    usage: data.usage ?? data.usageMetadata ?? null,
  };
}

// Fan-out mode budget: each prompt may run several searches instead of one.
export const fanOutMaxToolCalls = 6;
const sourceInclude = 'web_search_call.action.sources';
// Older API deployments reject the include. One capability downgrade per run, never a
// blind retry of a failed request.
let sourceIncludeSupported = true;

export function sourceIncludeState() {
  return sourceIncludeSupported;
}

export async function askFanOut(key, prompt) {
  const { model } = providers.openai;
  const body = {
    model,
    input: prompt,
    store: false,
    max_output_tokens: 1800,
    reasoning: { effort: 'low' },
    tools: [{ type: 'web_search', search_context_size: 'medium' }],
    tool_choice: 'required',
    max_tool_calls: fanOutMaxToolCalls,
  };
  let data;
  if (sourceIncludeSupported) {
    try {
      data = await request('https://api.openai.com/v1/responses', key, {
        ...body,
        include: [sourceInclude],
      });
    } catch (error) {
      if (error.message !== 'HTTP 400') throw error;
      sourceIncludeSupported = false;
    }
  }
  if (!data)
    data = await request('https://api.openai.com/v1/responses', key, body);
  return {
    ...parseAnswer('openai', data),
    ...parseFanOut(data),
    sourceInclude: sourceIncludeSupported,
    actualModel: data.model ?? model,
    usage: data.usage ?? null,
  };
}

export function estimate(provider, result) {
  if (provider === 'perplexity') {
    // Legacy Sonar is reformulated by the provider. Do not assume historical tariffs.
    const cost = result.usage?.cost?.total_cost;
    return typeof cost === 'number' && Number.isFinite(cost) ? cost : null;
  }
  const rate = providers[provider];
  const tierMultiplier =
    provider === 'anthropic' && result.inputTokens > 100000 ? 5 : 1;
  return (
    (result.inputTokens * rate.input * tierMultiplier) / 1e6 +
    (result.outputTokens * rate.output * tierMultiplier) / 1e6 +
    result.searches * rate.search
  );
}
