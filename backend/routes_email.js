// backend/routes_email.js
// Drop into backend/ and wire up in server.js:
//
//   import { registerEmailRoutes } from './routes_email.js';
//   registerEmailRoutes(app);
//
// Reads RESEND_KEY from environment (backend/.env). Aucune clé n'est
// stockée dans le dépôt : sans RESEND_KEY, l'route répond 503.

const RESEND_KEY = process.env.RESEND_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const FROM_NAME  = process.env.FROM_NAME  || 'CareWatch';

export function registerEmailRoutes(app) {
  /* ─── POST /api/send-reminder ──────────────────────────────────
     Body: { to: "user@example.com", meds: ["Doliprane"], times: ["08:00","20:00"] }
  */
  app.post('/api/send-reminder', async (req, res) => {
    try {
      if (!RESEND_KEY) {
        return res.status(503).json({ error: 'RESEND_KEY absente : renseignez backend/.env (voir .env.example)' });
      }
      const { to, meds = [], times = [] } = req.body;
      if (!to) return res.status(400).json({ error: 'Missing "to" email' });
      if (!meds.length) return res.status(400).json({ error: 'No medications to send' });

      const html = buildHtml(meds, times);

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to,
          subject: `CareWatch — ${meds.join(', ')}`,
          html
        })
      });

      const data = await r.json();
      if (!r.ok || !data.id) {
        return res.status(502).json({
          error: data.message || 'Resend rejected the email',
          details: data
        });
      }
      res.json({ ok: true, id: data.id, message: 'Reminder sent' });
    } catch (e) {
      console.error('send-reminder error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  console.log('✓ Email routes registered: POST /api/send-reminder');
}

function buildHtml(meds, times) {
  const medList = meds.join(', ');
  const rows = times
    .map(
      (t) =>
        `<tr>
          <td style="font-family:monospace;font-weight:700;color:#2ee094;padding:10px 14px;border-bottom:1px solid #ffffff10">${t}</td>
          <td style="color:#ededee;padding:10px 14px;border-bottom:1px solid #ffffff10">${medList}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:Geist,'Segoe UI',sans-serif;background:#08080a;color:#ededee;padding:32px;border-radius:16px;max-width:520px;margin:auto;border:1px solid #23232966">
      <div style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:600;letter-spacing:-0.01em;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #23232966">
        <span style="color:#2ee094">●</span> CareWatch
      </div>
      <div style="background:#131318;border:1px solid #23232966;border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="font-family:monospace;font-size:10px;color:#8a8a93;letter-spacing:0.12em;margin-bottom:8px">YOUR MEDICATIONS</div>
        ${meds.map((m) => `<div style="padding:6px 0;font-weight:500">${m}</div>`).join('')}
      </div>
      <div style="background:#131318;border:1px solid #23232966;border-radius:12px;overflow:hidden;margin-bottom:14px">
        <div style="font-family:monospace;font-size:10px;color:#8a8a93;letter-spacing:0.12em;padding:12px 14px">SCHEDULE</div>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>
      <div style="background:#2ee0941A;border:1px solid #2ee0944D;border-radius:10px;padding:12px;font-size:12px;color:#2ee094">
        Reminders active.
      </div>
    </div>`;
}
