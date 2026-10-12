/**
 * Unified cloud-AI layer: DeepSeek, Gemini, Claude, Llama (Meta).
 * Keys live in localStorage only — never in SQLite, never logged.
 * Chain: enabled cloud provider → local Ollama → offline template.
 */

export type CloudProviderId = 'deepseek' | 'gemini' | 'claude' | 'openai' | 'llama' | 'muse';
export type AiSource = 'ollama' | 'fallback' | CloudProviderId;

export interface ProviderDef {
  id: CloudProviderId;
  name: string;
  modelDefault: string;
  keyHint: string;
  keyUrl: string;
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'deepseek', name: 'DeepSeek', modelDefault: 'deepseek-chat', keyHint: 'sk-… (platform.deepseek.com)', keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'gemini', name: 'Gemini', modelDefault: 'gemini-2.5-flash', keyHint: 'AIza… (aistudio.google.com)', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'claude', name: 'Claude', modelDefault: 'claude-sonnet-4-5-20250929', keyHint: 'sk-ant-… (console.anthropic.com)', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', name: 'ChatGPT', modelDefault: 'gpt-4o-mini', keyHint: 'sk-… (platform.openai.com)', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'llama', name: 'Llama (Meta)', modelDefault: 'Llama-4-Scout-17B-16E-Instruct', keyHint: 'LLM… (llama.developer.meta.com)', keyUrl: 'https://llama.developer.meta.com/' },
  { id: 'muse', name: 'Muse', modelDefault: 'muse-spark-1.3', keyHint: 'MODEL_API_KEY (api.meta.ai)', keyUrl: 'https://api.meta.ai/' },
];

export interface ProviderState {
  enabled: boolean;
  apiKey: string;
  model: string;
}

type StoredProviders = Partial<Record<CloudProviderId, ProviderState>>;

const LS_KEY = 'cognidev.ai.providers.v1';

function loadAll(): StoredProviders {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as StoredProviders;
  } catch {
    /* ignore */
  }
  return {};
}

function saveAll(s: StoredProviders) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getProvider(id: CloudProviderId): ProviderState {
  const def = PROVIDERS.find((p) => p.id === id)!;
  const s = loadAll()[id];
  return {
    enabled: s?.enabled ?? false,
    apiKey: s?.apiKey ?? '',
    model: s?.model || def.modelDefault,
  };
}

export function setProvider(id: CloudProviderId, patch: Partial<ProviderState>) {
  const all = loadAll();
  const cur = getProvider(id);
  all[id] = { ...cur, ...patch };
  saveAll(all);
}

export function enabledProviders(): CloudProviderId[] {
  const order = getProviderOrder();
  return order.filter((id) => {
    const s = getProvider(id);
    return s.enabled && s.apiKey.trim().length > 0;
  });
}

/** First enabled provider in user order — the one AI buttons will use. */
export function firstEnabledProvider(): ProviderDef | null {
  for (const id of getProviderOrder()) {
    const s = getProvider(id);
    if (s.enabled && s.apiKey.trim().length > 0) {
      return PROVIDERS.find((p) => p.id === id) ?? null;
    }
  }
  return null;
}

const ORDER_KEY = 'cognidev.ai.order.v1';

/** User-defined try order; new providers append at the end. */
export function getProviderOrder(): CloudProviderId[] {
  const ids = PROVIDERS.map((p) => p.id);
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]') as string[];
    const known = raw.filter((x): x is CloudProviderId => ids.includes(x as CloudProviderId));
    for (const id of ids) if (!known.includes(id)) known.push(id);
    return known;
  } catch {
    return ids;
  }
}

export function moveProvider(id: CloudProviderId, dir: -1 | 1) {
  const order = getProviderOrder();
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  [order[i], order[j]] = [order[j], order[i]];
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
  return order;
}

export const SOURCE_LABELS: Record<AiSource, string> = {
  ollama: 'Ollama · Mahalliy AI',
  fallback: 'Oflayn shablon',
  deepseek: 'DeepSeek · Cloud',
  gemini: 'Gemini · Cloud',
  claude: 'Claude · Cloud',
  openai: 'ChatGPT · Cloud',
  llama: 'Llama · Cloud',
  muse: 'Muse · Cloud',
};

async function withTimeout(ms: number): Promise<{ ctrl: AbortController; done: () => void }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { ctrl, done: () => clearTimeout(timer) };
}

function extractOpenAiText(data: unknown): string | null {
  const c = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  return typeof c === 'string' && c.trim() ? c.trim() : null;
}

async function chatOpenAI(prompt: string, system: string, key: string, model: string): Promise<string | null> {
  try {
    const { ctrl, done } = await withTimeout(45000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
      signal: ctrl.signal,
    });
    done();
    if (!res.ok) return null;
    return extractOpenAiText(await res.json());
  } catch {
    return null;
  }
}

async function chatDeepSeek(prompt: string, system: string, key: string, model: string): Promise<string | null> {
  try {
    const { ctrl, done } = await withTimeout(45000);
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
      signal: ctrl.signal,
    });
    done();
    if (!res.ok) return null;
    return extractOpenAiText(await res.json());
  } catch {
    return null;
  }
}

async function chatGemini(prompt: string, system: string, key: string, model: string): Promise<string | null> {
  try {
    const { ctrl, done } = await withTimeout(45000);
    const text = system ? `${system}\n\n${prompt}` : prompt;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }] }),
        signal: ctrl.signal,
      },
    );
    done();
    if (!res.ok) return null;
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts as Array<{ text?: string }> | undefined;
    const out = (parts ?? []).map((p) => p.text ?? '').join('').trim();
    return out || null;
  } catch {
    return null;
  }
}

async function chatClaude(prompt: string, system: string, key: string, model: string): Promise<string | null> {
  try {
    const { ctrl, done } = await withTimeout(45000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: ctrl.signal,
    });
    done();
    if (!res.ok) return null;
    const data = await res.json();
    const blocks = data?.content as Array<{ type?: string; text?: string }> | undefined;
    const out = (blocks ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('').trim();
    return out || null;
  } catch {
    return null;
  }
}

async function chatLlama(prompt: string, system: string, key: string, model: string): Promise<string | null> {
  try {
    const { ctrl, done } = await withTimeout(45000);
    const res = await fetch('https://api.llama.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    done();
    if (!res.ok) return null;
    return extractLlamaText(await res.json());
  } catch {
    return null;
  }
}

/**
 * Llama API has two shapes: OpenAI-compatible (choices[].message.content)
 * and native (completion_message). Accept both, plus generic fallbacks.
 */
function extractLlamaText(data: unknown): string | null {
  const openAi = extractOpenAiText(data);
  if (openAi) return openAi;
  const d = data as {
    completion_message?: { content?: unknown; text?: unknown } | string;
    message?: { content?: unknown };
    response?: unknown;
    output_text?: unknown;
    text?: unknown;
  };
  const cm = d?.completion_message;
  if (typeof cm === 'string' && cm.trim()) return cm.trim();
  const cc = (cm as { content?: unknown; text?: unknown } | undefined)?.content
    ?? (cm as { text?: unknown } | undefined)?.text;
  const fromContent = textFromUnknown(cc);
  if (fromContent) return fromContent;
  const mc = d?.message?.content;
  const fromMsg = textFromUnknown(mc);
  if (fromMsg) return fromMsg;
  for (const k of ['response', 'output_text', 'text'] as const) {
    const v = textFromUnknown(d?.[k]);
    if (v) return v;
  }
  return null;
}

function textFromUnknown(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (Array.isArray(v)) {
    const out = v
      .map((b) => (typeof b === 'string' ? b : (b as { text?: unknown })?.text))
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .join('')
      .trim();
    return out || null;
  }
  if (v && typeof v === 'object') {
    const t = (v as { text?: unknown }).text;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}

export interface ProviderHit {
  text: string;
  source: CloudProviderId;
  model: string;
}

/**
 * Muse (Meta Model API, api.meta.ai) — OpenAI-compatible chat endpoint.
 * Reasoning model: only model/messages/stream are sent (no temperature
 * tweaks — docs recommend defaults). Response: choices[0].message.content.
 */
async function chatMuse(prompt: string, system: string, key: string, model: string): Promise<string | null> {
  try {
    const { ctrl, done } = await withTimeout(45000);
    const res = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
      signal: ctrl.signal,
    });
    done();
    if (!res.ok) return null;
    return extractOpenAiText(await res.json());
  } catch {
    return null;
  }
}

/** Try enabled cloud providers in registry order. Returns null when none works. */
export async function tryCloudProviders(prompt: string, system = ''): Promise<ProviderHit | null> {
  for (const id of enabledProviders()) {
    const s = getProvider(id);
    let text: string | null = null;
    if (id === 'deepseek') text = await chatDeepSeek(prompt, system, s.apiKey.trim(), s.model.trim());
    else if (id === 'gemini') text = await chatGemini(prompt, system, s.apiKey.trim(), s.model.trim());
    else if (id === 'claude') text = await chatClaude(prompt, system, s.apiKey.trim(), s.model.trim());
    else if (id === 'openai') text = await chatOpenAI(prompt, system, s.apiKey.trim(), s.model.trim());
    else if (id === 'llama') text = await chatLlama(prompt, system, s.apiKey.trim(), s.model.trim());
    else if (id === 'muse') text = await chatMuse(prompt, system, s.apiKey.trim(), s.model.trim());
    if (text) return { text, source: id, model: s.model.trim() };
  }
  return null;
}

/** Quick connectivity check for the Test button. */
export async function testProvider(id: CloudProviderId): Promise<{ ok: boolean; detail: string }> {
  const s = getProvider(id);
  if (!s.apiKey.trim()) return { ok: false, detail: 'API kalit kiritilmagan' };
  const text = await (async () => {
    if (id === 'deepseek') return chatDeepSeek('Reply with exactly: ok', '', s.apiKey.trim(), s.model.trim());
    if (id === 'gemini') return chatGemini('Reply with exactly: ok', '', s.apiKey.trim(), s.model.trim());
    if (id === 'claude') return chatClaude('Reply with exactly: ok', '', s.apiKey.trim(), s.model.trim());
    if (id === 'openai') return chatOpenAI('Reply with exactly: ok', '', s.apiKey.trim(), s.model.trim());
    if (id === 'muse') return chatMuse('Reply with exactly: ok', '', s.apiKey.trim(), s.model.trim());
    return chatLlama('Reply with exactly: ok', '', s.apiKey.trim(), s.model.trim());
  })();
  if (text) return { ok: true, detail: `Ulandi ✓ (${s.model.trim()})` };
  return { ok: false, detail: 'Ulanmadi — kalit/modelni tekshiring' };
}
