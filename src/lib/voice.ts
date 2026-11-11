import { tryCloudProviders, type AiSource } from './providers';
import { checkOllama } from './ai';

const SYSTEM_PROMPT = `You are a technical writing assistant for engineers. Format the following raw voice transcript from a developer into clean, structured Markdown with these sections:

## Problem
- Clear bullet points describing the issue, context, and constraints.

## Resolution
- Step-by-step bullets for the fix or approach.
- Include any commands, code snippets, or config changes in fenced blocks.

## Follow-ups
- Any TODOs, risks, or items to verify.

Keep it concise, use imperative mood, and preserve technical terminology.`;

export interface VoiceFormatResult {
  text: string;
  source: AiSource;
  model?: string;
}

export async function formatVoiceWithOllama(text: string): Promise<VoiceFormatResult> {
  const prompt = `${SYSTEM_PROMPT}\n\nRaw transcript:\n${text}`;
  // Chain: enabled cloud provider → local Ollama → offline template.
  const cloud = await tryCloudProviders(prompt, SYSTEM_PROMPT).catch(() => null);
  if (cloud) return { text: cloud.text, source: cloud.source, model: cloud.model };
  try {
    const ollama = await checkOllama();
    if (ollama.online && ollama.model && ollama.host) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 35000);
      const res = await fetch(`${ollama.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollama.model, prompt, stream: false, system: SYSTEM_PROMPT }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data?.response) return { text: (data.response as string).trim(), source: 'ollama', model: ollama.model };
      }
    }
  } catch {
    /* ignore */
  }
  return { text: fallbackFormat(text), source: 'fallback' };
}

function fallbackFormat(text: string): string {
  const lines = text.split(/[.!?]\s+/).filter(Boolean);
  const bullets = lines.map((l) => `- ${l.trim()}`).join('\n');
  return `## Problem\n${bullets}\n\n## Resolution\n- [Add structured resolution here]\n\n## Follow-ups\n- [Add follow-ups]`;
}