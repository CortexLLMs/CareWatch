// Test d'envoi Telegram direct — lit backend/.env, envoie UN message de test.
// Usage : node scripts/telegram-test.mjs
import fs from "node:fs";

const env = fs.readFileSync(new URL("../backend/.env", import.meta.url), "utf8");
const TOKEN = (env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m) || [])[1]?.trim();
const CHAT = (env.match(/^TELEGRAM_CHAT_ID=(.+)$/m) || [])[1]?.trim();
if (!TOKEN || !CHAT) { console.error("ERREUR: TOKEN ou CHAT_ID manquant dans backend/.env"); process.exit(1); }

console.log("Envoi du message de test vers le chat", CHAT.slice(0, 4) + "…");
const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: CHAT,
    text: "✅ <b>CareWatch — Test de configuration</b>\nLa chaîne d'alerte Telegram est opérationnelle.\nYou will receive critical alerts (heart rate, SpO₂, emergency gesture, grimace) here.",
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }),
});
const data = await r.json().catch(() => ({}));
if (!r.ok || data.ok === false) {
  console.error("ECHEC:", data.description || `HTTP ${r.status}`);
  process.exit(1);
}
console.log("ENVOYE — message_id", data.result?.message_id);
