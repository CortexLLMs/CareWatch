// src/lib/alarm.js
// Alarme sonore d'urgence (Web Audio API), sans fichier audio externe.
// Le contexte doit être créé/relancé sur un geste utilisateur (démarrage
// de session), sinon les navigateurs mobiles le laissent suspendu.

let ctx = null;

export function initAlarm() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    ctx = null;
  }
}

// Trois double-bips type moniteur de surveillance (880 Hz puis 660 Hz).
export function playEmergencyAlarm() {
  try {
    initAlarm();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const base = t0 + i * 0.5;
      [[880, 0], [660, 0.18]].forEach(([freq, off]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, base + off);
        gain.gain.exponentialRampToValueAtTime(0.16, base + off + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, base + off + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(base + off);
        osc.stop(base + off + 0.17);
      });
    }
  } catch {
    // Audio indisponible (politique navigateur) : l'alerte visuelle reste active.
  }
}

export function stopAlarm() {
  try { if (ctx) ctx.close(); } catch {}
  ctx = null;
}
