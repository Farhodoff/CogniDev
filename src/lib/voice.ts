import { tryCloudProviders } from './providers';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
// Same chain as ai.ts: cloud flagships → local 3b offline fallback.
const MODEL_CANDIDATES = ['gpt-oss:20b-cloud', 'gpt-oss:120b-cloud', 'qwen2.5-coder:3b', 'llama3.2:3b'];

const SYSTEM_PROMPT = `You are a technical writing assistant for engineers. Format the following raw voice transcript from a developer into clean, structured Markdown with these sections:

## Problem
- Clear bullet points describing the issue, context, and constraints.

## Resolution
- Step-by-step bullets for the fix or approach.
- Include any commands, code snippets, or config changes in fenced blocks.

## Follow-ups
- Any TODOs, risks, or items to verify.

Keep it concise, use imperative mood, and preserve technical terminology.`;

export async function formatVoiceWithOllama(text: string): Promise<string> {
  const prompt = `${SYSTEM_PROMPT}\n\nRaw transcript:\n${text}`;
  // Chain: enabled cloud provider → local Ollama → offline template.
  const cloud = await tryCloudProviders(prompt, SYSTEM_PROMPT).catch(() => null);
  if (cloud) return cloud.text;
  for (const model of MODEL_CANDIDATES) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, system: SYSTEM_PROMPT }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.response) return data.response.trim();
    } catch {
      continue;
    }
  }
  return fallbackFormat(text);
}

function fallbackFormat(text: string): string {
  const lines = text.split(/[.!?]\s+/).filter(Boolean);
  const bullets = lines.map((l) => `- ${l.trim()}`).join('\n');
  return `## Problem\n${bullets}\n\n## Resolution\n- [Add structured resolution here]\n\n## Follow-ups\n- [Add follow-ups]`;
}