import { config } from './config.js';

export function telegramConfigured() {
  return Boolean(config.telegramBotToken && config.telegramChatId);
}

export async function sendRunSummary({ moduleLabel, keywords, totalFound, newCount }) {
  const text = [
    `${moduleLabel} run complete`,
    '',
    `Search: ${keywords.join(', ')}`,
    `Fetched: ${totalFound} job${totalFound === 1 ? '' : 's'}`,
    `New (after dedup): ${newCount}`,
  ].join('\n');

  const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: config.telegramChatId, text }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.description || `Telegram HTTP ${res.status}`);
  }
  return json;
}
