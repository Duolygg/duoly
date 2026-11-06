const { fetch, AbortSignal } = globalThis;

// Snapshot checked against official pricing pages on 2026-11-06. USD, standard tier.
export const providers = {
  openai: {
    model: 'gpt-6-luna',
    input: 0.1,
    output: 0.5,
    search: 0.01,
    env: 'OPENAI_API_KEY',
  },
  gemini: {
    model: 'gemini-2.5-flash-lite',
    input: 0.1,
    output: 0.4,
    search: 0.035,
    env: 'GEMINI_API_KEY',
  },
  anthropic: {
    model: 'claude-haiku-5-5',
    input: 0.1,
    output: 0.5,
    search: 0.01,
    env: 'ANTHROPIC_API_KEY',
  },
  perplexity: {
    model: 'sonar',
    input: 1,
    output: 1,
    search: 0.005,
    env: 'PERPLEXITY_API_KEY',
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
  if (provider === 'openai') {
    const blocks = (data.output ?? []).flatMap((item) => item.content ?? []);
    answer = blocks
      .filter((block) => block.type === 'output_text')
      .map((block) => block.text)
      .join('\n');
    urls = blocks.flatMap((block) =>
      (block.annotations ?? [])
        .filter((a) => a.type === 'url_citation')
        .map((a) => a.url),
    );
    searches = (data.output ?? []).filter(
      (item) => item.type === 'web_search_call',
    ).length;
    searched = searches > 0;
    input = data.usage?.input_tokens ?? 0;
    output = data.usage?.output_tokens ?? 0;
    complete = data.status === 'completed';
  } else if (provider === 'gemini') {
    const candidate = data.candidates?.[0];
    answer = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('\n');
    urls = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map((chunk) => chunk.web?.uri)
      .filter(Boolean);
    searched =
      (candidate?.groundingMetadata?.webSearchQueries?.length ?? 0) > 0 ||
      urls.length > 0;
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
      .flatMap((block) => (block.citations ?? []).map((c) => c.url))
      .filter(Boolean);
    searches = data.usage?.server_tool_use?.web_search_requests ?? 0;
    searched = searches > 0;
    input = data.usage?.input_tokens ?? 0;
    output = data.usage?.output_tokens ?? 0;
    complete = data.stop_reason === 'end_turn';
  } else {
    answer = data.choices?.[0]?.message?.content ?? '';
    urls = data.citations ?? [];
    searched = urls.length > 0;
    searches = 1;
    input = data.usage?.prompt_tokens ?? 0;
    output = data.usage?.completion_tokens ?? 0;
    complete = data.choices?.[0]?.finish_reason === 'stop';
  }
  return {
    answer,
    citedUrls: [...new Set(urls)],
    searched,
    searches,
    inputTokens: input,
    outputTokens: output,
    complete,
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
