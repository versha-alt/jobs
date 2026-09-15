import { all, get, run } from './db.js';
import { config, setOverride, clearOverride } from './config.js';
import { nowIso } from './util.js';

const ACTOR_ID_RE = /^[A-Za-z0-9_]+[\/~][A-Za-z0-9_.-]+$/;
const TOKEN_RE = /^apify_api_[A-Za-z0-9]+$/;

async function setSetting(key, value) {
  await run(
    `INSERT INTO app_settings (skey, svalue, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE svalue = VALUES(svalue), updated_at = VALUES(updated_at)`,
    [key, value, nowIso()]
  );
  setOverride(key, value);
}

async function clearSetting(key) {
  await run('DELETE FROM app_settings WHERE skey = ?', [key]);
  clearOverride(key);
}

/** Called at boot: any DB-stored overrides win over .env values. */
export async function loadSettingsIntoConfig() {
  const rows = await all('SELECT skey, svalue FROM app_settings');
  for (const r of rows) setOverride(r.skey, r.svalue);
}

export function getApifySettings() {
  return {
    tokenSet: Boolean(config.apifyToken),
    tokenMask: config.apifyToken ? '••••' + config.apifyToken.slice(-4) : '',
    linkedinActorId: config.linkedinActorId,
    upworkActorId: config.upworkActorId,
    sources: config.apifySources,
  };
}

const TG_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{35}$/;
const TG_CHAT_RE = /^-?\d+$/;

export function getTelegramSettings() {
  return {
    botTokenSet: Boolean(config.telegramBotToken),
    botTokenMask: config.telegramBotToken ? '••••' + config.telegramBotToken.slice(-4) : '',
    chatId: config.telegramChatId,
    sources: config.telegramSources,
  };
}

/**
 * Telegram bot token + chat id. Token optional (blank keeps current); an
 * explicit '' clears an override back to the .env fallback. Chat id is stored
 * as plain text (it is not a secret).
 */
export async function saveTelegramSettings({ botToken, chatId } = {}) {
  if (botToken !== undefined) {
    const v = String(botToken).trim();
    if (v === '') await clearSetting('telegram_bot_token');
    else {
      if (!TG_TOKEN_RE.test(v)) {
        throw Object.assign(new Error('Bot token must look like 123456789:AaBbCc… (digits, colon, 35-char key)'), { status: 400 });
      }
      await setSetting('telegram_bot_token', v);
    }
  }
  if (chatId !== undefined) {
    const v = String(chatId).trim();
    if (v === '') await clearSetting('telegram_chat_id');
    else {
      if (!TG_CHAT_RE.test(v)) {
        throw Object.assign(new Error('Chat id must be numeric (a leading - is allowed for groups)'), { status: 400 });
      }
      await setSetting('telegram_chat_id', v);
    }
  }
  return getTelegramSettings();
}

/**
 * Verify the configured bot credentials against Telegram's getMe, and
 * optionally deliver a test message to the configured chat.
 */
export async function testTelegramConnection({ sendTest = false } = {}) {
  const token = config.telegramBotToken;
  if (!token) throw Object.assign(new Error('No bot token configured'), { status: 400 });

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()).catch(() => null);
  if (!meRes || !meRes.ok) {
    const desc = meRes && meRes.description ? meRes.description : 'Telegram did not respond';
    throw Object.assign(new Error(`Bot check failed: ${desc}`), { status: 400 });
  }

  const out = { bot: meRes.result.username ?? String(meRes.result.id) };

  if (sendTest) {
    const chatId = config.telegramChatId;
    if (!chatId) throw Object.assign(new Error('No chat id configured — save one first'), { status: 400 });
    const send = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: 'Job Portal — test message. Your Telegram connection works.' }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!send || !send.ok) {
      const desc = send && send.description ? send.description : 'Telegram did not respond';
      throw Object.assign(new Error(`Test send failed: ${desc}`), { status: 400 });
    }
    out.sent = true;
  }
  return out;
}

/**
 * Save Apify connection settings. The token is optional — an empty/absent
 * token keeps the currently stored one. Actor ids: a value replaces the
 * override; an explicit null clears it back to the .env fallback.
 */
export async function saveApifySettings({ token, linkedinActorId, upworkActorId } = {}) {
  if (token != null && token !== '') {
    const t = String(token).trim();
    if (!TOKEN_RE.test(t)) throw Object.assign(new Error('That does not look like a valid Apify API token'), { status: 400 });
    await setSetting('apify_token', t);
  }
  if (linkedinActorId !== undefined) {
    const v = String(linkedinActorId).trim();
    if (v === '') await clearSetting('linkedin_actor_id');
    else {
      if (!ACTOR_ID_RE.test(v)) throw Object.assign(new Error('LinkedIn actor id must look like owner/actor-name'), { status: 400 });
      await setSetting('linkedin_actor_id', v);
    }
  }
  if (upworkActorId !== undefined) {
    const v = String(upworkActorId).trim();
    if (v === '') await clearSetting('upwork_actor_id');
    else {
      if (!ACTOR_ID_RE.test(v)) throw Object.assign(new Error('Upwork actor id must look like owner/actor-name'), { status: 400 });
      await setSetting('upwork_actor_id', v);
    }
  }
  return getApifySettings();
}
