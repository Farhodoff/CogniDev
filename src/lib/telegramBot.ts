import type { TelegramBotConfig } from './types';

export interface TelegramTestResult {
  ok: boolean;
  botUsername?: string;
  botName?: string;
  error?: string;
}

export type TelegramBotStatus = 'running' | 'stopped' | 'error';

/**
 * Validates a Telegram bot token by querying the getMe endpoint.
 */
export async function testTelegramToken(token: string): Promise<TelegramTestResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { ok: false, error: 'Token kiritilmagan' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return {
        ok: true,
        botUsername: data.result.username,
        botName: data.result.first_name,
      };
    }
    return {
      ok: false,
      error: data.description || 'Token yaroqsiz',
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Tarmoq xatosi',
    };
  }
}

/**
 * Sends a message back to Telegram chat with Markdown support and plain-text fallback.
 */
export async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
): Promise<boolean> {
  const cleanToken = token.trim();
  if (!cleanToken || !chatId) return false;

  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  // First try with Markdown formatting
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    const data = await res.json();
    if (data.ok) return true;
  } catch {
    // Fall back to plain text
  }

  // Fallback: send as raw text without parse_mode
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch (err) {
    console.warn('[TelegramBot] Failed to send fallback message:', err);
    return false;
  }
}

/**
 * Sends a chat action (e.g. typing indicator) to Telegram.
 */
export async function sendTelegramChatAction(
  token: string,
  chatId: number | string,
  action = 'typing',
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token.trim()}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // Non-critical indicator
  }
}

export type OnTelegramMessageCallback = (
  text: string,
  fromId: number,
  chatId: number,
  fromName: string,
) => Promise<string>;

/**
 * Long-polling client for Telegram Bot integration inside CogniDev.
 */
/**
 * Registers slash commands with Telegram so users get autocomplete when typing /
 */
export async function registerTelegramCommands(token: string): Promise<boolean> {
  const cleanToken = token.trim();
  if (!cleanToken) return false;

  const commands = [
    { command: 'model', description: 'AI modelini ko‘rish yoki o‘zgartirish' },
    { command: 'usage', description: 'Foydalanish statistikasi va xotira holati' },
    { command: 'report', description: 'Kunlik qilinmagan va kechikkan ishlar auditi' },
    { command: 'overdue', description: 'O‘tkazib yuborilgan vazifalar va AI tavsiyasi' },
    { command: 'tasks', description: 'CogniDev faol vazifalar ro‘yxati' },
    { command: 'memory', description: 'Hermes uzoq muddatli xotiralari' },
    { command: 'clear', description: 'Yozishmalar tarixini tozalash' },
    { command: 'help', description: 'Barcha buyruqlar va qo‘llanma' },
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch (err) {
    console.warn('[TelegramBot] Failed to setMyCommands:', err);
    return false;
  }
}

class TelegramBotManager {
  private abortController: AbortController | null = null;
  private status: TelegramBotStatus = 'stopped';
  private botUsername: string | null = null;
  private onStatusChangeListeners: Array<(status: TelegramBotStatus, botName?: string | null) => void> = [];

  public getStatus(): TelegramBotStatus {
    return this.status;
  }

  public getBotUsername(): string | null {
    return this.botUsername;
  }

  public subscribeStatus(listener: (status: TelegramBotStatus, botName?: string | null) => void): () => void {
    this.onStatusChangeListeners.push(listener);
    listener(this.status, this.botUsername);
    return () => {
      this.onStatusChangeListeners = this.onStatusChangeListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: TelegramBotStatus, botName?: string | null) {
    this.status = status;
    if (botName !== undefined) this.botUsername = botName;
    this.onStatusChangeListeners.forEach((l) => l(this.status, this.botUsername));
  }

  public stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.setStatus('stopped');
  }

  public async start(
    config: TelegramBotConfig,
    onMessage: OnTelegramMessageCallback,
    onUpdateOffset?: (offset: number) => void,
  ) {
    this.stop();

    const token = config.bot_token?.trim();
    if (!token) {
      this.setStatus('stopped');
      return;
    }

    // Verify token first
    const test = await testTelegramToken(token);
    if (!test.ok) {
      console.warn('[TelegramBot] Token invalid:', test.error);
      this.setStatus('error', null);
      return;
    }

    // Auto-register slash commands for autocomplete
    registerTelegramCommands(token).catch(() => {});

    this.setStatus('running', test.botUsername || test.botName || 'CogniDev Bot');

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    let offset = config.last_update_id || 0;
    const allowedIds = config.allowed_user_ids
      ? config.allowed_user_ids
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    (async () => {
      while (!signal.aborted) {
        try {
          const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=20`;
          const res = await fetch(url, { signal });
          if (!res.ok) {
            if (res.status === 401 || res.status === 404) {
              this.setStatus('error');
              break;
            }
            await new Promise((r) => setTimeout(r, 4000));
            continue;
          }

          const data = await res.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              offset = update.update_id + 1;
              if (onUpdateOffset) onUpdateOffset(offset);

              const msg = update.message;
              if (!msg || !msg.text) continue;

              const fromId = msg.from?.id;
              const chatId = msg.chat?.id;
              const text = msg.text.trim();
              const fromName = msg.from?.first_name || 'Foydalanuvchi';

              // Security check: if allowedIds specified, ignore unauthorized users
              if (allowedIds.length > 0 && fromId && !allowedIds.includes(String(fromId))) {
                await sendTelegramMessage(
                  token,
                  chatId,
                  `⛔ Kechirasiz, ${fromName}. Ushbu CogniDev boti shaxsiy bo‘lib, sizning Telegram ID'ingiz (${fromId}) ruxsat etilganlar ro‘yxatida mavjud emas.`,
                );
                continue;
              }

              // Typing indicator
              await sendTelegramChatAction(token, chatId, 'typing');

              // Process AI response
              try {
                const reply = await onMessage(text, fromId, chatId, fromName);
                await sendTelegramMessage(token, chatId, reply);
              } catch (handlerErr) {
                console.error('[TelegramBot] Handler error:', handlerErr);
                await sendTelegramMessage(
                  token,
                  chatId,
                  '⚠ Xatolik yuz berdi. Iltimos, qaytadan urinib ko‘ring.',
                );
              }
            }
          }
        } catch (err: unknown) {
          if (signal.aborted) break;
          console.warn('[TelegramBot] Polling network error, retrying in 5s...', err);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    })();
  }
}

export const telegramBotManager = new TelegramBotManager();
