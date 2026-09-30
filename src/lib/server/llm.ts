/**
 * Provider-neutral model client. FlowMind speaks the OpenAI-compatible chat/embeddings API, which both
 * Mistral and OpenRouter expose. The server key comes from the environment; a visitor may bring their own
 * key via the x-llm-key header (OpenRouter keys are recognised by their sk-or- prefix).
 */

export class AgentError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export interface Provider {
  name: 'mistral' | 'openrouter';
  base: string;
  key: string;
  chatModel: string;
  criticModel: string;
  embedModel: string | null;
}

function build(name: Provider['name'], key: string): Provider {
  if (name === 'openrouter') {
    const chat = process.env.OPENROUTER_MODEL || 'stealth/space-bunny-alpha';
    return {
      name,
      base: 'https://openrouter.ai/api/v1',
      key,
      chatModel: chat,
      criticModel: process.env.OPENROUTER_CRITIC_MODEL || chat,
      embedModel: process.env.OPENROUTER_EMBED_MODEL === 'none' ? null : process.env.OPENROUTER_EMBED_MODEL || 'nvidia/nemotron-3-embed-1b:free',
    };
  }
  const chat = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  return { name, base: 'https://api.mistral.ai/v1', key, chatModel: chat, criticModel: process.env.MISTRAL_CRITIC_MODEL || chat, embedModel: 'mistral-embed' };
}

/** Provider configured on the server, if any. LLM_PROVIDER picks one when both keys are set. */
export function serverProvider(): Provider | null {
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  const mistral = process.env.MISTRAL_API_KEY?.trim();
  const preferred = process.env.LLM_PROVIDER;
  if (openrouter && (preferred === 'openrouter' || !mistral)) return build('openrouter', openrouter);
  if (mistral) return build('mistral', mistral);
  return null;
}

export function resolveProvider(request: Request): Provider {
  const own = request.headers.get('x-llm-key')?.trim();
  if (own) return build(own.startsWith('sk-or-') ? 'openrouter' : 'mistral', own);
  const provider = serverProvider();
  if (!provider) throw new AgentError('No model API key configured. Set OPENROUTER_API_KEY or MISTRAL_API_KEY on the server, or add your own key in Settings.', 401);
  return provider;
}

async function call(p: Provider, path: string, body: Record<string, unknown>, attempt = 0): Promise<unknown> {
  const response = await fetch(`${p.base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${p.key}`,
      'Content-Type': 'application/json',
      ...(p.name === 'openrouter' ? { 'HTTP-Referer': 'https://github.com/ronithrashmikara/FlowMind', 'X-Title': 'FlowMind' } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await response.text();
  // Retry bursts and upstream hiccups, but not daily quotas: those will not clear within a request.
  const dailyQuota = response.status === 429 && /per[- ]day|daily/i.test(text);
  if ((response.status === 429 || response.status >= 500) && attempt < 4 && !dailyQuota) {
    const retryAfter = Number(response.headers.get('retry-after')) || 0;
    await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 900 * 2 ** attempt)));
    return call(p, path, body, attempt + 1);
  }
  if (dailyQuota) throw new AgentError('The model provider’s daily free quota is used up for this key. Semantic search falls back to keyword + graph retrieval; add credits or your own key in Settings.', 429);
  if (!response.ok) {
    if (response.status === 401) throw new AgentError(`${p.name === 'openrouter' ? 'OpenRouter' : 'Mistral'} rejected the API key (401). Check or replace it in Settings.`, 401);
    // Some models reject JSON mode; retry once without it and rely on tolerant parsing.
    if (response.status === 400 && body.response_format && /response_format|json/i.test(text)) {
      const rest = { ...body };
      delete rest.response_format;
      return call(p, path, rest, attempt);
    }
    throw new AgentError(`Model error ${response.status}: ${text.slice(0, 240)}`, response.status === 429 ? 429 : 502);
  }
  const data = JSON.parse(text);
  // OpenRouter can return 200 with an error object when the upstream provider fails.
  if (data?.error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 900 * 2 ** attempt));
      return call(p, path, body, attempt + 1);
    }
    throw new AgentError(`Model error: ${String(data.error.message ?? data.error).slice(0, 240)}`);
  }
  return data;
}

const LATEX = 'frac|dfrac|partial|cdot|cdots|ldots|times|nabla|sigma|eta|theta|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|lambda|mu|nu|rho|tau|phi|omega|sum|prod|sqrt|log|exp|max|min|tanh|leftarrow|rightarrow|Rightarrow|to|left|right|text|mathbf|mathrm|mathcal|hat|bar|quad|approx|le|leq|ge|geq|neq|in|infty|mid|begin|end|operatorname|odot|circ|top';
const LATEX_COMMAND = new RegExp(`(?<!\\\\)\\\\(${LATEX})(?![a-zA-Z])`, 'g');

/**
 * Models often write LaTeX inside JSON strings with single backslashes. "\frac" or "\times" would then parse as a
 * form feed or tab, and "\partial" is invalid JSON, so known commands are escaped before parsing and stray
 * backslashes are escaped if parsing still fails.
 */
export function repairJson(text: string): string {
  return text.replace(LATEX_COMMAND, '\\\\$1');
}

export function parseJson(text: string): unknown {
  const cleaned = repairJson(text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''));
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  const candidates = [cleaned, start >= 0 && end > start ? cleaned.slice(start, end + 1) : ''].filter(Boolean);
  for (const candidate of candidates) {
    for (const attempt of [candidate, candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')]) {
      try {
        return JSON.parse(attempt);
      } catch {
        /* try the next repair */
      }
    }
  }
  throw new AgentError('The model returned malformed JSON.');
}

export async function chatJson<T>(p: Provider, system: string, user: string, options: { critic?: boolean; temperature?: number; maxTokens?: number } = {}): Promise<T> {
  const body: Record<string, unknown> = {
    model: options.critic ? p.criticModel : p.chatModel,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 2500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (p.name === 'openrouter') {
    // Reasoning models spend completion tokens thinking; keep effort low and leave headroom for the answer.
    body.reasoning = { effort: process.env.OPENROUTER_REASONING || 'low', exclude: true };
    body.max_tokens = (body.max_tokens as number) + 3000;
  }
  for (let attempt = 0; ; attempt++) {
    const data = (await call(p, '/chat/completions', body)) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    try {
      return parseJson(content) as T;
    } catch (error) {
      if (attempt >= 1) throw error;
    }
  }
}

export async function embed(p: Provider, inputs: string[]): Promise<number[][]> {
  if (!p.embedModel) throw new AgentError('This provider has no embedding model configured.', 501);
  const data = (await call(p, '/embeddings', { model: p.embedModel, input: inputs })) as { data: { embedding: number[]; index: number }[] };
  return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding.map((value) => Math.round(value * 1e5) / 1e5));
}

export function errorResponse(error: unknown): Response {
  const status = error instanceof AgentError ? error.status : 500;
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return Response.json({ error: message }, { status });
}
