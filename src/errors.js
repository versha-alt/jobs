export function classifyError(message = '') {
  const m = String(message).toLowerCase();

  if (m.includes('free tier limit') || m.includes('free-tier') || m.includes('free plan')) {
    return {
      title: 'Actor free quota exhausted',
      hint: 'This actor has a limited free tier. Upgrade your Apify plan at console.apify.com/billing to keep it returning results.',
    };
  }
  if (m.includes('chat not found')) {
    return {
      title: 'Telegram chat not found',
      hint: 'The bot cannot see your chat. Send any message to your bot in Telegram, then copy the numeric chat id (via the bot token getUpdates URL) into TELEGRAM_CHAT_ID in .env and restart the server.',
    };
  }
  if (m.includes('must be object') || m.includes('must be array') || m.includes('input json') || m.includes('input is not valid')) {
    return {
      title: 'Actor input mismatch',
      hint: 'The data sent to the actor does not match its input schema. Compare the mapping in server/modules/<module>.js with the input table on the actor page at apify.com.',
    };
  }
  if (m.includes('actor id is not configured') || (m.includes('actor id') && m.includes('.env'))) {
    return {
      title: 'Actor not configured',
      hint: 'The module has no actor id set. Copy the exact actor id from apify.com into APIFY_LINKEDIN_ACTOR_ID or APIFY_UPWORK_ACTOR_ID in .env and restart the server.',
    };
  }
  if (m.includes('actor') && (m.includes('not found') || m.includes('does not exist'))) {
    return {
      title: 'Actor not found',
      hint: 'The actor id in .env is wrong or the actor was removed. Copy the exact id (e.g. "user~actor-name") from the actor page on apify.com into the matching APIFY_*_ACTOR_ID and restart.',
    };
  }
  if (m.includes('unauthorized') || m.includes('invalid token') || m.includes('401')) {
    return {
      title: 'Authentication failed',
      hint: 'A token was rejected. Verify APIFY_TOKEN or TELEGRAM_BOT_TOKEN in .env and restart the server.',
    };
  }
  if (m.includes('telegram')) {
    return {
      title: 'Telegram delivery failed',
      hint: 'Telegram rejected the message. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env, then run again.',
    };
  }
  if (m.includes('rate limit') || m.includes('429') || m.includes('too many requests')) {
    return {
      title: 'Rate limited',
      hint: 'The API is throttling requests. Wait a few minutes and use Run now to retry — nothing is lost.',
    };
  }
  if (m.includes('timeout') || m.includes('timed out') || m.includes('econn') || m.includes('enotfound') || m.includes('fetch failed') || m.includes('network')) {
    return {
      title: 'Network problem',
      hint: 'The server could not reach the API. Check your internet connection and retry with Run now.',
    };
  }
  if (m.includes('blocked') || m.includes('captcha') || m.includes('forbidden') || m.includes('403')) {
    return {
      title: 'Source blocked the scraper',
      hint: 'The website refused access this time. This is usually temporary — run again later, or reduce the trigger frequency.',
    };
  }
  return {
    title: 'Run failed unexpectedly',
    hint: 'Something went wrong during this run. Check the technical details, then retry with Run now. If it keeps failing, check the actor page and your .env configuration.',
  };
}
