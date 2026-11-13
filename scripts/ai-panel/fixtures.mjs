// Fixture replay: parse saved provider payloads instead of calling an engine. This is how
// the harness is exercised end to end without a credential, a login or a real query.
import { readFile } from 'node:fs/promises';
import { parseAnswer, parseFanOut, providers } from './providers.mjs';

const { URL } = globalThis;

export async function loadFixtures(name) {
  const file = new URL(`./fixtures/${name}.json`, import.meta.url);
  const parsed = JSON.parse(await readFile(file, 'utf8'));
  if (!parsed.responses?.default)
    throw new Error(`Fixture ${name} needs a default response`);
  return parsed.responses;
}

export function pickResponse(responses, promptId) {
  return responses[promptId] ?? responses.default;
}

export async function replay(provider, promptId) {
  const responses = await loadFixtures(provider);
  const data = pickResponse(responses, promptId);
  return {
    ...parseAnswer(provider, data),
    actualModel: data.model ?? data.modelVersion ?? providers[provider].model,
    usage: data.usage ?? data.usageMetadata ?? null,
  };
}

export async function replayFanOut(promptId) {
  const responses = await loadFixtures('openai-fanout');
  const data = pickResponse(responses, promptId);
  return {
    ...parseAnswer('openai', data),
    ...parseFanOut(data),
    sourceInclude: true,
    actualModel: data.model ?? providers.openai.model,
    usage: data.usage ?? null,
  };
}
