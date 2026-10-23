// src/lib/history.js
// Historique physiologique local, agrégé par jour, pour le rapport mensuel.
// Aucune donnée n'est envoyée : tout reste dans le localStorage du navigateur.
// Une écriture au maximum toutes les 10 s limite l'usure du stockage.

const KEY = "carewatch_history_v1";
const KEEP_DAYS = 400;
const WRITE_EVERY_MS = 10000;

let lastWrite = 0;
let pendingSeconds = 0;

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const emptyDay = () => ({
  seconds: 0, samples: 0,
  hrN: 0, hrSum: 0, hrMin: null, hrMax: null,
  spo2N: 0, spo2Sum: 0,
  rmssdN: 0, rmssdSum: 0,
  drowsyMax: 0, yawnMax: 0, grimaceMax: 0,
  confSum: 0, confN: 0,
  alerts: {},
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const db = raw ? JSON.parse(raw) : null;
    return db && db.days ? db : { days: {} };
  } catch {
    return { days: {} };
  }
}

function write(db) {
  try {
    const keys = Object.keys(db.days).sort();
    while (keys.length > KEEP_DAYS) delete db.days[keys.shift()];
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Quota dépassé ou stockage désactivé : le rapport reste générable
    // avec les données de la session en cours.
  }
}

/** Enregistre un instantané de mesures (throttlé à 10 s). */
export function recordSample(m, force = false) {
  if (!m) return;
  const now = Date.now();
  if (!force && now - lastWrite < WRITE_EVERY_MS) return;
  lastWrite = now;

  const db = read();
  const k = dayKey();
  const d = db.days[k] || emptyDay();

  const hr = Number(m.heartRate) || 0;
  if (hr > 0) {
    d.hrN++;
    d.hrSum += hr;
    d.hrMin = d.hrMin == null ? hr : Math.min(d.hrMin, hr);
    d.hrMax = d.hrMax == null ? hr : Math.max(d.hrMax, hr);
  }
  const spo2 = Number(m.oxygen) || 0;
  if (spo2 > 0) { d.spo2N++; d.spo2Sum += spo2; }
  const rmssd = Number(m.rmssd) || 0;
  if (rmssd > 0) { d.rmssdN++; d.rmssdSum += rmssd; }

  d.drowsyMax = Math.max(d.drowsyMax, Math.min(100, Number(m.drowsiness) || 0));
  d.yawnMax = Math.max(d.yawnMax, Math.min(100, Number(m.yawnLevel) || 0));
  d.grimaceMax = Math.max(d.grimaceMax, Math.min(100, Number(m.grimace) || 0));

  const conf = Number(m.confidence) || 0;
  if (conf > 0) { d.confSum += conf; d.confN++; }

  d.samples++;
  d.seconds += pendingSeconds;
  pendingSeconds = 0;

  db.days[k] = d;
  write(db);
}

/** Ajoute du temps de session (appelé chaque seconde pendant l'acquisition). */
export function addSeconds(n = 1) {
  pendingSeconds += n;
  if (pendingSeconds >= 10) {
    const db = read();
    const k = dayKey();
    const d = db.days[k] || emptyDay();
    d.seconds += pendingSeconds;
    pendingSeconds = 0;
    db.days[k] = d;
    write(db);
  }
}

/** Comptabilise une alerte (déjà dédupliquée par l'appelant). */
export function recordAlert(type) {
  if (!type) return;
  const db = read();
  const k = dayKey();
  const d = db.days[k] || emptyDay();
  d.alerts[type] = (d.alerts[type] || 0) + 1;
  db.days[k] = d;
  write(db);
}

/** Agrège un mois (month : 0..11). */
export function getMonth(year, month) {
  const db = read();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const days = Object.keys(db.days)
    .filter((k) => k.startsWith(prefix))
    .sort()
    .map((k) => {
      const d = db.days[k];
      return {
        date: k,
        seconds: d.seconds || 0,
        samples: d.samples || 0,
        hrAvg: d.hrN ? d.hrSum / d.hrN : null,
        hrMin: d.hrMin,
        hrMax: d.hrMax,
        spo2Avg: d.spo2N ? d.spo2Sum / d.spo2N : null,
        rmssdAvg: d.rmssdN ? d.rmssdSum / d.rmssdN : null,
        drowsyMax: Math.min(100, d.drowsyMax || 0),
        yawnMax: Math.min(100, d.yawnMax || 0),
        grimaceMax: Math.min(100, d.grimaceMax || 0),
        confidence: d.confN ? d.confSum / d.confN : 0,
        hrN: d.hrN || 0,
        spo2N: d.spo2N || 0,
        rmssdN: d.rmssdN || 0,
        confN: d.confN || 0,
        alerts: d.alerts || {},
        alertTotal: Object.values(d.alerts || {}).reduce((a, b) => a + b, 0),
      };
    });

  const sum = (key) => days.reduce((a, d) => a + (Number(d[key]) || 0), 0);
  const weighted = (avgKey, nKey) => {
    const num = days.reduce((a, d) => a + (d[avgKey] || 0) * (d[nKey] || 0), 0);
    const den = sum(nKey);
    return den ? num / den : null;
  };

  const hrVals = days.filter((d) => d.hrN > 0 && d.hrMin != null && d.hrMax != null);
  const byType = {};
  for (const d of days) for (const [t, n] of Object.entries(d.alerts)) byType[t] = (byType[t] || 0) + n;

  return {
    year, month, days,
    activeDays: days.filter((d) => d.samples > 0).length,
    seconds: sum("seconds"),
    samples: sum("samples"),
    hrAvg: weighted("hrAvg", "hrN"),
    hrMin: hrVals.length ? Math.min(...hrVals.map((d) => d.hrMin)) : null,
    hrMax: hrVals.length ? Math.max(...hrVals.map((d) => d.hrMax)) : null,
    spo2Avg: weighted("spo2Avg", "spo2N"),
    rmssdAvg: weighted("rmssdAvg", "rmssdN"),
    drowsyMax: Math.max(0, ...days.map((d) => d.drowsyMax)),
    yawnMax: Math.max(0, ...days.map((d) => d.yawnMax)),
    grimaceMax: Math.max(0, ...days.map((d) => d.grimaceMax)),
    confidence: weighted("confidence", "confN"),
    alerts: byType,
    alertTotal: Object.values(byType).reduce((a, b) => a + b, 0),
  };
}
