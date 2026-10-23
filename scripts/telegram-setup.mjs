// Script temporaire de configuration Telegram — lit backend/.env (jamais de secret en clair dans le shell).
// Usage : node scripts/telegram-setup.mjs [chat_id]   → sans argument : getMe + getUpdates ; avec chat_id : écrit dans .env
import fs from "node:fs";

const envPath = new URL("../backend/.env", import.meta.url);
let env = fs.readFileSync(envPath, "utf8");
const TOKEN = (env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!TOKEN) { console.error("ERREUR: TELEGRAM_BOT_TOKEN vide dans backend/.env"); process.exit(1); }

const api = (method, params) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params || {}),
  }).then((r) => r.json());

const chatIdArg = process.argv[2];

if (chatIdArg) {
  // Écrit le chat_id dans .env
  env = env.replace(/^TELEGRAM_CHAT_ID=.*$/m, `TELEGRAM_CHAT_ID=${chatIdArg}`);
  fs.writeFileSync(envPath, env);
  console.log(`TELEGRAM_CHAT_ID=${chatIdArg} écrit dans backend/.env`);
} else {
  const me = await api("getMe");
  if (!me.ok) { console.error("getMe KO:", JSON.stringify(me)); process.exit(1); }
  console.log(`Bot OK : @${me.result.username} (${me.result.first_name})`);

  const updates = await api("getUpdates", { timeout: 0 });
  if (!updates.ok) { console.error("getUpdates KO:", JSON.stringify(updates)); process.exit(1); }
  const chats = [];
  for (const u of updates.result) {
    const c = u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat;
    if (c && !chats.some((x) => x.id === c.id)) chats.push(c);
  }
  if (!chats.length) {
    console.log("AUCUN_CHAT: envoyez /start à votre bot sur Telegram, puis relancez ce script.");
  } else {
    for (const c of chats) console.log(`CHAT: ${c.id} — ${c.first_name || c.title || ""} (${c.type})`);
  }
}
