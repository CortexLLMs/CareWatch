// backend/telegram.js
// Notification Telegram directe en cas d'anomalie (critical / high).
// Indépendante de Novu : fonctionne dès que le bot est configuré.
//
// Variables d'environnement :
//   TELEGRAM_BOT_TOKEN  jeton du bot BotFather (ex: 123456:ABC-DEF...)
//   TELEGRAM_CHAT_ID    identifiant du chat destinataire (ex: 123456789)
//   TELEGRAM_TIMEOUT    délai maximal d'appel en ms (défaut : 6000)

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_TIMEOUT = Number(process.env.TELEGRAM_TIMEOUT || 6000);

export const telegramEnabled = () => Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

export function telegramStatus() {
  return {
    enabled: telegramEnabled(),
    tokenSet: Boolean(TELEGRAM_BOT_TOKEN),
    chatIdSet: Boolean(TELEGRAM_CHAT_ID),
    chatId: TELEGRAM_CHAT_ID ? String(TELEGRAM_CHAT_ID).slice(0, 6) + '…' : null,
  };
}

/**
 * Envoie une alerte d'anomalie sur Telegram (non bloquant pour l'appelant).
 * @param {{type?: string, severity?: string, message?: string}} alert
 * @param {{sessionId?: string, metrics?: object}} extra
 * @returns {Promise<{ok: boolean, skipped?: boolean, error?: string}>}
 */
export async function sendTelegramAlert(alert = {}, extra = {}) {
  const { type, severity, message } = alert;

  // Seules les anomalies graves déclenchent Telegram.
  if (severity !== 'critical' && severity !== 'high') {
    return { ok: true, skipped: true, reason: 'severity-not-urgent' };
  }
  if (!telegramEnabled()) {
    return { ok: false, skipped: true, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID absents' };
  }

  const emoji = severity === 'critical' ? '\u{1F6A8}' : '\u26A0\uFE0F';
  const m = extra.metrics || {};
  const lines = [
    `${emoji} <b>CareWatch — ALERTE ${String(severity).toUpperCase()}</b>`,
    `Type : <b>${type || '-'}</b>`,
    message ? `Anomalie : ${message}` : null,
    m.heartRate ? `FC : ${Math.round(m.heartRate)} bpm` : null,
    m.oxygen ? `SpO₂ : ${Math.round(m.oxygen)} %` : null,
    extra.sessionId ? `Session : ${String(extra.sessionId).slice(0, 12)}` : null,
    `Détection automatique par webcam — ${new Date().toLocaleString('fr-FR')}`,
  ].filter(Boolean);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TELEGRAM_TIMEOUT);
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctl.signal,
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ok === false) {
      return { ok: false, error: data.description || `HTTP ${r.status}` };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? `Délai dépassé (${TELEGRAM_TIMEOUT} ms)` : e.message };
  } finally {
    clearTimeout(timer);
  }
}
