import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export function telegramConfigured() {
  return Boolean(config.telegramBotToken && config.telegramChatId);
}

export async function sendCsvDocument(filePath, caption) {
  const buf = await fs.promises.readFile(filePath);
  const form = new FormData();
  form.append('chat_id', config.telegramChatId);
  form.append('caption', caption);
  form.append('document', new Blob([buf], { type: 'text/csv' }), path.basename(filePath));
  const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.description || `Telegram HTTP ${res.status}`);
  }
  return json;
}
