import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ROOT = root;
export const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');

fs.mkdirSync(EXPORTS_DIR, { recursive: true });

export const config = {
  port: Number(process.env.PORT || 8787),
  apifyToken: process.env.APIFY_TOKEN || '',
  linkedinActorId: process.env.APIFY_LINKEDIN_ACTOR_ID || '',
  upworkActorId: process.env.APIFY_UPWORK_ACTOR_ID || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
};
