require('dotenv').config({ quiet: true });

async function main() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error('Set TELEGRAM_BOT_TOKEN in .env first.');
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeout: 0, limit: 100 }), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram lookup failed (HTTP ${response.status}). Check the token and ensure this bot has no webhook or other polling process.`);
  }
  const chats = new Map();
  for (const update of data.result) {
    const chat = update.message?.chat;
    if (chat) chats.set(chat.id, chat);
  }
  if (!chats.size) {
    console.log('Open your bot in Telegram, press Start or send it a message, then run this command again.');
    return;
  }
  console.log('Choose your intended receiving chat and copy its ID into TELEGRAM_CHAT_ID in .env:');
  for (const chat of chats.values()) {
    console.log(`${chat.id} (${chat.type}) ${chat.title || chat.username || chat.first_name || ''}`);
  }
}

main().catch((error) => {
  // Do not print fetch error details: Telegram URLs contain the secret token.
  console.error(error.message.includes('https:') || error.cause ? 'Telegram connection failed. Check your connection and bot token.' : error.message);
  process.exitCode = 1;
});
