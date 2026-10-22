// src/lib/api.js
// Backend integrations: your Express backend, Anthropic (AI extraction), Resend (email).
//
// Configuration (optionnelle, variables d'environnement Vite) :
//   VITE_API_URL       URL du backend (défaut : http://localhost:5000)
//   VITE_RESEND_KEY    clé API Resend pour les e-mails (défaut : aucun envoi direct)
//   VITE_ANTHROPIC_KEY clé API Anthropic pour l'extraction IA (défaut : repli regex)
// Sans backend ni clés, l'application reste utilisable hors ligne (mode démo).

import axios from "axios";

export const API = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";

// ⚠️ Les clés ci-dessous sont injectées à la compilation (build time) via les
// variables VITE_* ; aucune clé n'est stockée dans le dépôt. En production,
// passez les e-mails par le backend (POST /api/send-reminder) et l'IA par /api/ai.
const RESEND_KEY = import.meta.env.VITE_RESEND_KEY || "";
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";
const FROM_EMAIL = "onboarding@resend.dev";
const FROM_NAME = "CareWatch";

/* ─── Backend health & sessions ──────────────────────────── */

export const checkBackend = () =>
  axios.get(`${API}/health`).then(() => true).catch(() => false);

export const startSession = (deviceType = "pc", fps = 30) =>
  axios.post(`${API}/session/start`, { device_type: deviceType, camera_fps: fps })
       .then((r) => r.data.sessionId);

export const endSession = (sid) =>
  axios.post(`${API}/session/${sid}/end`).catch(() => {});

export const saveMetrics = (sid, metrics) =>
  axios.post(`${API}/metrics/save`, { sessionId: sid, metrics }).catch(() => {});

export const saveAlert = (sid, alert, notify) =>
  axios.post(`${API}/alerts/save`, { sessionId: sid, alert, notify }).catch(() => {});

// ── Novu : notifications multicanal (Telegram, e-mail, in-app) ──────
export const novuStatus = () =>
  axios.get(`${API}/novu/status`).then((r) => r.data).catch(() => null);

export const novuTest = (to) =>
  axios.post(`${API}/novu/test`, to ? { to } : {}).then((r) => r.data).catch((e) => ({ ok: false, error: e.message }));

// Subjective self-report (anxiety, mood, perceived stress)
export const saveSelfReport = (sid, report) =>
  axios.post(`${API}/selfreport/save`, { sessionId: sid, report }).catch(() => {});

/* ─── AI (Claude) — extract structured data from chat answers ─── */

export async function ai(systemPrompt, userMessage) {
  // Sans clé configurée : pas d'appel réseau, le chatbot utilise son repli regex.
  if (!ANTHROPIC_KEY) return "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    const d = await r.json();
    return d.content?.[0]?.text || "";
  } catch (_) {
    return "";
  }
}

/* ─── Email reminders via Resend ─────────────────────────── */

export async function mail(to, meds, times) {
  const medList = meds.join(", ");
  const rows = times
    .map(
      (t) =>
        `<tr>
          <td style="font-family:monospace;font-weight:700;color:#1b56ff;padding:10px 14px;border-bottom:1px solid #e2e9f5">${t}</td>
          <td style="color:#0e1b3d;padding:10px 14px;border-bottom:1px solid #e2e9f5">${medList}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:'Geist','Segoe UI',sans-serif;background:#ffffff;color:#0e1b3d;padding:32px;border-radius:16px;max-width:520px;margin:auto;border:1px solid #e2e9f5">
      <div style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:600;letter-spacing:-0.01em;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e2e9f5">
        <span style="color:#1b56ff">●</span> CareWatch
      </div>
      <div style="background:#f6f9fe;border:1px solid #e2e9f5;border-radius:12px;padding:14px;margin-bottom:14px">
        <div style="font-family:monospace;font-size:10px;color:#7d8bab;letter-spacing:0.12em;margin-bottom:8px">YOUR MEDICATIONS</div>
        ${meds.map((m) => `<div style="padding:6px 0;font-weight:500">${m}</div>`).join("")}
      </div>
      <div style="background:#f6f9fe;border:1px solid #e2e9f5;border-radius:12px;overflow:hidden;margin-bottom:14px">
        <div style="font-family:monospace;font-size:10px;color:#7d8bab;letter-spacing:0.12em;padding:12px 14px">SCHEDULE</div>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>
      <div style="background:rgba(27,86,255,0.07);border:1px solid rgba(27,86,255,0.28);border-radius:10px;padding:12px;font-size:12px;color:#1b56ff">
        Reminders active.
      </div>
    </div>`;

  // Sans clé Resend côté client : utilisez le backend (POST /api/send-reminder).
  if (!RESEND_KEY) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject: `CareWatch — ${medList}`,
        html
      })
    });
    const d = await r.json();
    return !!d.id;
  } catch (_) {
    return false;
  }
}
