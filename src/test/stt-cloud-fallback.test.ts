import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeAudioCloud } from '../lib/providers';
import { downloadRubaiModel, transcribeAudioDetailed } from '../lib/stt';
import * as vault from '../lib/vault';

describe('🎙️ STT & Cloud AI Audio Fallback Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('transcribeAudioCloud returns null if no cloud provider is enabled', async () => {
    const dummyWav = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69]);
    const res = await transcribeAudioCloud(dummyWav, 'uz');
    expect(res).toBeNull();
  });

  it('transcribeAudioCloud uses Groq Whisper when Groq is enabled', async () => {
    localStorage.setItem(
      'cognidev.ai.providers.v1',
      JSON.stringify({
        groq: {
          enabled: true,
          apiKey: 'gsk_mock_groq_key',
          model: 'llama-3.3-70b-versatile',
        },
      })
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Bugun soat 10 da standup bo‘ladi' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const dummyWav = new Uint8Array([1, 2, 3, 4]);
    const res = await transcribeAudioCloud(dummyWav, 'uz');

    expect(res).not.toBeNull();
    expect(res?.text).toBe('Bugun soat 10 da standup bo‘ladi');
    expect(res?.provider).toBe('Groq Whisper');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('groq.com');
  });

  it('transcribeAudioCloud uses Gemini Audio when Gemini is enabled', async () => {
    localStorage.setItem(
      'cognidev.ai.providers.v1',
      JSON.stringify({
        gemini: {
          enabled: true,
          apiKey: 'AIzaMockKey',
          model: 'gemini-2.5-flash',
        },
      })
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Yangi vazifalar rejalashtirildi' }],
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const dummyWav = new Uint8Array([5, 6, 7, 8]);
    const res = await transcribeAudioCloud(dummyWav, 'uz');

    expect(res).not.toBeNull();
    expect(res?.text).toBe('Yangi vazifalar rejalashtirildi');
    expect(res?.provider).toBe('Gemini Audio');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  });

  it('transcribeAudioDetailed falls back to cloud AI when local whisper is absent', async () => {
    localStorage.setItem(
      'cognidev.ai.providers.v1',
      JSON.stringify({
        groq: {
          enabled: true,
          apiKey: 'gsk_mock_groq_key',
          model: 'llama-3.3-70b-versatile',
        },
      })
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Cloud AI orqali yozildi' }),
    }));

    const dummyWav = new Uint8Array([1, 2, 3, 4]);
    const res = await transcribeAudioDetailed(dummyWav, 'uz', '');

    expect(res.text).toBe('Cloud AI orqali yozildi');
    expect(res.source).toBe('cloud-ai');
  });

  it('downloadRubaiModel informs user if running outside Tauri', async () => {
    const res = await downloadRubaiModel();
    if (!vault.isTauri) {
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Tauri');
    }
  });
});
