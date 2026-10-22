// backend/routes_novu.js
// Notifications multicanal via Novu (auto-hébergé) : Telegram, e-mail, in-app.
// Utilitaire à brancher dans server.js :
//
//   import { registerNovuRoutes, triggerNovu } from './routes_novu.js';
//   registerNovuRoutes(app);
//
// Variables d'environnement (fichier backend/.env ou variables système) :
//   NOVU_API_URL   URL de l'API Novu (défaut : http://localhost:3000)
//   NOVU_API_KEY   clé API du tableau de bord Novu (obligatoire pour un envoi réel)
//   NOVU_WORKFLOW  identifiant du workflow (défaut : alerte-carewatch)
//   NOVU_MOCK      "1" => simule l'envoi (mode test, sans Novu)
//   NOVU_TIMEOUT   délai maximal d'appel en ms (défaut : 6000)
//   NOVU_SUBSCRIBER identifiant abonné par défaut (défaut : carewatch-user)

import { telegramStatus } from './telegram.js';

const NOVU_API_URL = (process.env.NOVU_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
const NOVU_API_KEY = process.env.NOVU_API_KEY || '';
const NOVU_WORKFLOW = process.env.NOVU_WORKFLOW || 'alerte-carewatch';
const NOVU_MOCK = String(process.env.NOVU_MOCK || '') === '1';
const NOVU_TIMEOUT = Number(process.env.NOVU_TIMEOUT || 6000);
const NOVU_SUBSCRIBER = process.env.NOVU_SUBSCRIBER || 'carewatch-user';

const isEnabled = () => NOVU_MOCK || Boolean(NOVU_API_KEY);

/** Construit le payload Novu à partir d'une alerte CareWatch. */
export function buildAlertPayload(alert, extra = {}) {
  const m = extra.metrics || {};
  return {
    app: 'CareWatch',
    alert_type: alert?.type || 'unknown',
    severity: alert?.severity || 'medium',
    message: alert?.message || 'Seuil physiologique depasse',
    session_id: extra.sessionId || null,
    recorded_at: new Date().toISOString(),
    heart_rate: m.heartRate ?? null,
    spo2: m.oxygen ?? null,
    stress: m.stress ?? null,
    fatigue: m.fatigue ?? null,
    drowsiness: m.drowsiness ?? null,
    arousal: m.arousal ?? null,
    rmssd: m.rmssd ?? null,
    confidence: m.confidence ?? null,
    ...(extra.payload || {}),
  };
}

/** Déclenche un événement Novu. Ne lève jamais : retourne un rapport d'état. */
export async function triggerNovu({ workflow, to, payload }) {
  const name = workflow || NOVU_WORKFLOW;
  const target = to || { subscriberId: NOVU_SUBSCRIBER };
  const body = { name, to: target, payload: payload || {} };

  if (NOVU_MOCK) {
    return { ok: true, mock: true, workflow: name, to: target, payload: body.payload,
             message: 'Mode simulation : aucun appel Novu emis' };
  }
  if (!NOVU_API_KEY) {
    return { ok: false, mock: false, workflow: name, error: 'NOVU_API_KEY absente : envoi impossible' };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), NOVU_TIMEOUT);
  try {
    const r = await fetch(`${NOVU_API_URL}/v1/events/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${NOVU_API_KEY}`,
        'Idempotency-Key': `carewatch-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!r.ok) {
      const err = data?.message || data?.error || `HTTP ${r.status}`;
      console.error('Novu error:', r.status, err);
      return { ok: false, mock: false, workflow: name, status: r.status, error: err };
    }
    return { ok: true, mock: false, workflow: name, status: r.status,
             acknowledged: data?.data?.acknowledged ?? true,
             transactionId: data?.data?.transactionId || null,
             message: 'Evenement Novu declenche' };
  } catch (e) {
    console.error('Novu unreachable:', e.message);
    return { ok: false, mock: false, workflow: name,
             error: e.name === 'AbortError' ? `Delai depasse (${NOVU_TIMEOUT} ms)` : e.message };
  } finally {
    clearTimeout(timer);
  }
}

/** État du service : configuré, joignable, liste des workflows. */
export async function novuStatus() {
  const base = {
    enabled: isEnabled(),
    mock: NOVU_MOCK,
    apiUrl: NOVU_API_URL,
    workflow: NOVU_WORKFLOW,
    subscriberId: NOVU_SUBSCRIBER,
    hasKey: Boolean(NOVU_API_KEY),
  };
  if (NOVU_MOCK) return { ...base, reachable: true, note: 'Mode simulation actif' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), NOVU_TIMEOUT);
  try {
    // Test de joignabilité via /v1/workflows (valable sur Cloud ET en local).
    // /v1/health n'existe que sur l'auto-hébergé (404 sur api.novu.co).
    let reachable = false;
    let workflows = [];
    try {
      const wr = await fetch(`${NOVU_API_URL}/v1/workflows`, {
        headers: { Authorization: `ApiKey ${NOVU_API_KEY}` },
        signal: ctl.signal,
      });
      if (wr.ok) {
        const wd = await wr.json();
        workflows = (wd.data || []).map((w) => w.name || w._id);
        reachable = true;
      }
    } catch { /* non joignable */ }
    if (!reachable) {
      try {
        const hr = await fetch(`${NOVU_API_URL}/v1/health`, { signal: ctl.signal });
        reachable = hr.ok;
      } catch { /* non joignable */ }
    }
    return { ...base, reachable, workflows };
  } catch (e) {
    return { ...base, reachable: false, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

export function registerNovuRoutes(app) {
  // ── GET /api/novu/status ──────────────────────────────────────────
  app.get('/api/novu/status', async (_req, res) => {
    try {
      const st = await novuStatus();
      res.json({ ...st, telegram: telegramStatus() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/novu/test ───────────────────────────────────────────
  // Declenche le workflow avec une charge utile de demonstration.
  app.post('/api/novu/test', async (req, res) => {
    try {
      const { workflow, to, payload } = req.body || {};
      const result = await triggerNovu({
        workflow: workflow || NOVU_WORKFLOW,
        to: to || { subscriberId: NOVU_SUBSCRIBER },
        payload: {
          app: 'CareWatch',
          alert_type: 'test',
          severity: 'medium',
          message: 'Test de notification CareWatch',
          recorded_at: new Date().toISOString(),
          heart_rate: 78,
          spo2: 97,
          stress: 42,
          ...(payload || {}),
        },
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/novu/notify ─────────────────────────────────────────
  // Declenchement generique (alerte, rappel de medication, rapport).
  app.post('/api/novu/notify', async (req, res) => {
    try {
      const { workflow, to, payload } = req.body || {};
      if (!workflow && !NOVU_WORKFLOW) {
        return res.status(400).json({ error: 'workflow manquant' });
      }
      const result = await triggerNovu({ workflow, to, payload });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log(`✓ Novu routes registered: /api/novu/{status,test,notify} (${isEnabled() ? 'actif' : 'inactif, cle absente'})`);
}
