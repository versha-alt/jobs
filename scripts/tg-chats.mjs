import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;
const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const json = await res.json();
if (!json.ok) {
  console.log('getUpdates failed:', json.description);
} else if (!json.result.length) {
  console.log('NO UPDATES: nobody has messaged this bot yet — send /start to it in Telegram first');
} else {
  const seen = new Set();
  for (const u of json.result) {
    const msg = u.message ?? u.edited_message ?? u.channel_post ?? u.my_chat_member?.chat;
    const chat = msg?.chat ?? u.my_chat_member?.chat;
    if (chat && !seen.has(chat.id)) {
      seen.add(chat.id);
      console.log(`chat id: ${chat.id} | type: ${chat.type} | title: ${chat.title ?? chat.first_name ?? '?'}`);
    }
  }
}
