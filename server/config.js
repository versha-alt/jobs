import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ROOT = root;

if (!fs.existsSync(path.join(root, 'dist'))) {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
}

/* runtime overrides (admin Settings screen) take precedence over .env values */
const overrides = new Map();
export function setOverride(key, value) {
  overrides.set(key, value);
}
export function clearOverride(key) {
  overrides.delete(key);
}

export const config = {
  port: Number(process.env.PORT || 8787),
  get apifyToken() {
    return overrides.get('apify_token') ?? (process.env.APIFY_TOKEN || '');
  },
  get linkedinActorId() {
    return overrides.get('linkedin_actor_id') ?? (process.env.APIFY_LINKEDIN_ACTOR_ID || '');
  },
  get upworkActorId() {
    return overrides.get('upwork_actor_id') ?? (process.env.APIFY_UPWORK_ACTOR_ID || '');
  },
  get apifySources() {
    return {
      token: overrides.has('apify_token') ? 'database' : 'environment',
      linkedinActorId: overrides.has('linkedin_actor_id') ? 'database' : 'environment',
      upworkActorId: overrides.has('upwork_actor_id') ? 'database' : 'environment',
    };
  },
  get telegramBotToken() {
    return overrides.get('telegram_bot_token') ?? (process.env.TELEGRAM_BOT_TOKEN || '');
  },
  get telegramChatId() {
    return overrides.get('telegram_chat_id') ?? (process.env.TELEGRAM_CHAT_ID || '');
  },
  get telegramSources() {
    return {
      telegramBotToken: overrides.has('telegram_bot_token') ? 'database' : 'environment',
      telegramChatId: overrides.has('telegram_chat_id') ? 'database' : 'environment',
    };
  },
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
