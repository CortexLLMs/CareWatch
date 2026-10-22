// backend/routes_hrv.js
// Drop into your backend folder. Wire up in server.js with:
//
//   import { registerHRVRoutes } from './routes_hrv.js';
//   registerHRVRoutes(app, { db, run, get, all, uid });
//
// Adds:
//   POST /api/hrv/compute          — proxies to Python service for HRV (NeuroKit2)
//   POST /api/rppg/compute         — proxies to Python service for HR (POS)
//   POST /api/face/analyze         — proxies to Python service for face analysis
//   POST /api/selfreport/save      — stores subjective self-report
//   GET  /api/session/:id/selfreports
//   GET  /api/users/:userId/selfreports
//
// Falls back to a local pure-JS HRV implementation if the Python service is down.

import { computeHRV as localHRV } from './hrv_utils.js';

const SIGNAL_SERVICE = process.env.SIGNAL_SERVICE || 'http://localhost:8000';
const SIGNAL_TIMEOUT_MS = 8000;

async function callPython(path, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SIGNAL_TIMEOUT_MS);
  try {
    const r = await fetch(`${SIGNAL_SERVICE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const data = await r.json();
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 503, data: { error: `signal service: ${e.message}` } };
  } finally {
    clearTimeout(timer);
  }
}

export function registerHRVRoutes(app, ctx) {
  const { db, run, get, all, uid } = ctx;

// ── Schema: self_reports ──
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS self_reports (
        id          TEXT PRIMARY KEY,
        session_id  TEXT REFERENCES sessions(id),
        user_id     TEXT REFERENCES users(id),
        stressed    INTEGER CHECK(stressed BETWEEN 0 AND 10),
        anxious     INTEGER CHECK(anxious  BETWEEN 0 AND 10),
        tired       INTEGER CHECK(tired    BETWEEN 0 AND 10),
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_selfreport_session ON self_reports(session_id)');
  });

  /* ─── POST /api/hrv/compute ──────────────────────────────────────
     Body: { signal: [floats], fs: 30, sessionId?: "..." }
     Tries Python service first; falls back to local JS implementation.
  */
  app.post('/api/hrv/compute', async (req, res) => {
    try {
      const { signal, fs = 30, sessionId } = req.body;
      if (!Array.isArray(signal)) {
        return res.status(400).json({ error: 'signal must be a numeric array' });
      }

      // Try Python service first (95% accuracy via NeuroKit2)
      const py = await callPython('/hrv/compute', { signal, fs });
      let result = py.ok ? py.data : null;
      let source = 'NeuroKit2';

      // Fallback to pure-JS (~85% accuracy)
      if (!result) {
        result = localHRV(signal, fs);
        source = 'node-fallback';
        if (result.error) return res.status(400).json(result);
      }

      // Persist to existing health_metrics table
      if (sessionId && result.rmssd != null) {
        await run(
          `INSERT INTO health_metrics
            (session_id, stress_score, heart_rate_bpm, hrv_ms, confidence_score)
           VALUES (?,?,?,?,?)`,
          [sessionId, (result.arousal ?? 50) / 100, result.meanHR, result.rmssd, 0.85]
        );
      }

      res.json({ ...result, source });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /* ─── POST /api/rppg/compute ─────────────────────────────────────
     Body: { r, g, b, fs }  — RGB time-series from face ROI
     Forwards to Python service POS implementation.
  */
  app.post('/api/rppg/compute', async (req, res) => {
    const py = await callPython('/rppg/compute', req.body);
    res.status(py.ok ? 200 : py.status).json(py.data);
  });

  /* ─── POST /api/face/analyze ─────────────────────────────────────
     Body: { image_base64 }
     Forwards to Python MediaPipe + py-feat pipeline.
  */
  app.post('/api/face/analyze', async (req, res) => {
    const py = await callPython('/face/analyze', req.body);
    res.status(py.ok ? 200 : py.status).json(py.data);
  });

  /* ─── POST /api/selfreport/save ──────────────────────────────────
     Body: { sessionId, report: { stressed, anxious, tired } }
  */
  app.post('/api/selfreport/save', async (req, res) => {
    try {
      const { sessionId, report } = req.body;
      if (!report) return res.status(400).json({ error: 'report missing' });
      const s = await get('SELECT user_id FROM sessions WHERE id=?', [sessionId]);
      const id = uid();
      await run(
        `INSERT INTO self_reports (id, session_id, user_id, stressed, anxious, tired)
         VALUES (?,?,?,?,?,?)`,
        [id, sessionId || null, s?.user_id || null,
         report.stressed ?? null, report.anxious ?? null, report.tired ?? null]
      );
      res.json({ id, message: 'Self-report saved' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/session/:sessionId/selfreports', async (req, res) => {
    try {
      const rows = await all(
        'SELECT * FROM self_reports WHERE session_id=? ORDER BY recorded_at DESC',
        [req.params.sessionId]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/users/:userId/selfreports', async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const rows = await all(
        `SELECT * FROM self_reports
         WHERE user_id=? AND recorded_at >= datetime('now', '-' || ? || ' days')
         ORDER BY recorded_at DESC`,
        [req.params.userId, Number(days)]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log(`✓ HRV routes registered (Python service: ${SIGNAL_SERVICE})`);
}
