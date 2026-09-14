import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ROOT = root;

if (!fs.existsSync(path.join(root, 'dist'))) {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
}

export const config = {
  port: Number(process.env.PORT || 8787),
  apifyToken: process.env.APIFY_TOKEN || '',
  linkedinActorId: process.env.APIFY_LINKEDIN_ACTOR_ID || '',
  upworkActorId: process.env.APIFY_UPWORK_ACTOR_ID || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  linkedinCookies: parseCookies(process.env.LINKEDIN_COOKIES || ''),
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'job_app',
  },
};

function parseCookies(raw) {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('LINKEDIN_COOKIES is not valid JSON — ignoring');
    return [];
  }
}
