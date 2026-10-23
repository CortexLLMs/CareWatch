// src/lib/rppg.js
// Chaîne de photoplethysmographie distante (rPPG) côté navigateur.
//
//   1. POS — Plane-Orthogonal-to-Skin (Wang et al. 2017, IEEE TBME)
//   2. Passe-bande Butterworth 2e ordre (biquad RBJ) 0,7–4 Hz
//   3. Estimation HR par DFT fine + interpolation parabolique
//   4. Confiance fondée sur le rapport signal/bruit spectral (jamais constante)
//   5. SpO2 par ratio-of-ratios AC/DC rouge/vert — estimation expérimentale
//   6. Détection de pics et intervalles inter-battements pour la VFC

export const FS = 30;              // cadence nominale (Hz)
const HR_MIN = 0.7;                // 42 BPM
const HR_MAX = 4.0;                // 240 BPM
const POS_WIN_SEC = 1.6;           // fenêtre POS (Wang 2017)

/* ─── Utilitaires ─────────────────────────────────────────── */

export function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
export function std(a) {
  if (!a.length) return 0;
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2;
  return Math.sqrt(s / a.length);
}
const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ─── 0. Cadence réelle à partir des horodatages ──────────── */
// Les caméras mobiles ne délivrent pas 30 fps : on mesure la cadence
// médiane (en ignorant les pauses) au lieu de la supposer.
export function estimateFps(timestamps, fallback = FS) {
  if (!timestamps || timestamps.length < 10) return fallback;
  const d = [];
  for (let i = 1; i < timestamps.length; i++) {
    const dt = timestamps[i] - timestamps[i - 1];
    if (dt > 5 && dt < 500) d.push(dt);   // ignore doublons et coupures
  }
  if (d.length < 5) return fallback;
  d.sort((x, y) => x - y);
  return clampNum(1000 / d[Math.floor(d.length / 2)], 10, 60);
}

/* ─── 1. POS ──────────────────────────────────────────────── */
export function posSignal(rArr, gArr, bArr, fs = FS) {
  const N = rArr.length;
  const winN = Math.max(2, Math.round(POS_WIN_SEC * fs));
  const H = new Float32Array(N);

  for (let n = winN; n < N; n++) {
    const s = n - winN;
    let mR = 0, mG = 0, mB = 0;
    for (let i = s; i < n; i++) { mR += rArr[i]; mG += gArr[i]; mB += bArr[i]; }
    mR /= winN; mG /= winN; mB /= winN;
    if (mR <= 0 || mG <= 0 || mB <= 0) continue;

    const X = new Float32Array(winN);
    const Y = new Float32Array(winN);
    for (let i = 0; i < winN; i++) {
      const rN = rArr[s + i] / mR;
      const gN = gArr[s + i] / mG;
      const bN = bArr[s + i] / mB;
      X[i] = rN - gN;
      Y[i] = rN + gN - 2 * bN;
    }
    const alpha = std(X) / (std(Y) || 1e-9);
    for (let i = 0; i < winN; i++) H[s + i] += X[i] - alpha * Y[i];
  }
  return H;
}

/* ─── 2. Biquad Butterworth (RBJ Audio EQ Cookbook) ───────── */
function biquadCoeffs(type, f0, Q, fs) {
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw = Math.cos(w0), sinw = Math.sin(w0);
  const alpha = sinw / (2 * Q);
  let b0, b1, b2;
  if (type === "highpass") {
    b0 = (1 + cosw) / 2; b1 = -(1 + cosw); b2 = (1 + cosw) / 2;
  } else {
    b0 = (1 - cosw) / 2; b1 = 1 - cosw; b2 = (1 - cosw) / 2;
  }
  const a0 = 1 + alpha, a1 = -2 * cosw, a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function biquad(signal, c) {
  const out = new Float32Array(signal.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < signal.length; i++) {
    const x = signal[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }
  return out;
}

export function bandpass(signal, fs = FS, low = HR_MIN, high = HR_MAX) {
  if (!signal || signal.length < 8) return new Float32Array(signal ? signal.length : 0);
  const m = mean(signal);
  const d = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) d[i] = signal[i] - m;

  const hp = biquad(d, biquadCoeffs("highpass", low, Math.SQRT1_2, fs));
  return biquad(hp, biquadCoeffs("lowpass", high, Math.SQRT1_2, fs));
}

/* ─── 3. Estimation HR + SNR ──────────────────────────────── */
// Balayage fin 0,7–4 Hz (pas 0,01 Hz), fenêtre de Hann, interpolation
// parabolique autour du pic. La confiance est le SNR spectral : rapport
// entre la puissance dans ±0,2 Hz autour du pic et le reste de la bande.
export function estimateHR(signal, fs = FS) {
  if (!signal || signal.length < fs * 4) return null;
  const N = signal.length;
  const m = mean(signal);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = (signal[i] - m) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));

  const bins = [];
  for (let f = HR_MIN; f <= HR_MAX + 1e-9; f += 0.01) {
    let re = 0, im = 0;
    const w = (2 * Math.PI * f) / fs;
    for (let n = 0; n < N; n++) {
      re += win[n] * Math.cos(w * n);
      im -= win[n] * Math.sin(w * n);
    }
    bins.push({ f, p: re * re + im * im });
  }
  if (!bins.length) return null;

  let peak = 0;
  for (let i = 1; i < bins.length; i++) if (bins[i].p > bins[peak].p) peak = i;

  // Interpolation parabolique (précision sous le pas de 0,01 Hz)
  let fPeak = bins[peak].f;
  if (peak > 0 && peak < bins.length - 1) {
    const y0 = bins[peak - 1].p, y1 = bins[peak].p, y2 = bins[peak + 1].p;
    const den = y0 - 2 * y1 + y2;
    if (Math.abs(den) > 1e-12) fPeak += 0.005 * ((y0 - y2) / den);
  }

  // SNR : pic ±0,2 Hz vs reste de la bande
  let pIn = 0, pTot = 0;
  for (const b of bins) {
    pTot += b.p;
    if (Math.abs(b.f - fPeak) <= 0.2) pIn += b.p;
  }
  const pOut = Math.max(pTot - pIn, 1e-12);
  const snrDb = 10 * Math.log10(Math.max(pIn, 1e-12) / pOut);
  const confidence = clampNum((snrDb + 3) / 13, 0, 1);

  return {
    hr: Math.round(fPeak * 60),
    powerHz: fPeak,
    snrDb,
    confidence,
    quality: snrDb > 6 ? "good" : snrDb > 2 ? "fair" : "poor",
  };
}

/* ─── 4. Pics et intervalles inter-battements (VFC) ───────── */
export function detectPeaks(signal, fs = FS) {
  const peaks = [];
  const minDist = Math.round(fs * 0.33);   // 330 ms ≈ 180 BPM
  if (!signal || signal.length < 4) return { peaks, ibi: [] };

  const m = mean(signal);
  const sd = std(signal);
  const thr = m + sd * 0.35;

  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > thr && signal[i] > signal[i - 1] && signal[i] >= signal[i + 1]) {
      if (!peaks.length || i - peaks[peaks.length - 1] >= minDist) peaks.push(i);
    }
  }

  const ibi = [];
  for (let i = 1; i < peaks.length; i++) {
    const ms = ((peaks[i] - peaks[i - 1]) / fs) * 1000;
    if (ms >= 330 && ms <= 2000) ibi.push(ms);   // filtre les artefacts
  }
  return { peaks, ibi };
}

/* ─── 5. SpO2 par ratio-of-ratios (expérimental) ──────────── */
// R = (AC_rouge/DC_rouge) / (AC_vert/DC_vert)
// La relation R → SpO2 dépend du capteur ; le modèle linéaire ci-dessous est
// une approximation de démonstration, NON calibrée cliniquement.
// Retourne une valeur + une confiance fondée sur le SNR des deux canaux.
export function estimateSpO2(rArr, gArr, fs = FS) {
  if (!rArr || !gArr || rArr.length < fs * 4) return { value: null, confidence: 0 };
  const dcR = mean(rArr), dcG = mean(gArr);
  if (dcR < 5 || dcG < 5) return { value: null, confidence: 0 };

  const acR = std(bandpass(rArr, fs));
  const acG = std(bandpass(gArr, fs));
  if (acG < 1e-6) return { value: null, confidence: 0 };

  const ratio = (acR / dcR) / (acG / dcG);
  const value = Math.round(clampNum(100 - 18 * (ratio - 0.5), 85, 100));

  // Confiance : amplitude AC exploitable sur les deux canaux
  const ampR = acR / dcR, ampG = acG / dcG;
  const confidence = clampNum(Math.min(ampR, ampG) / 0.01, 0, 1);

  return { value, confidence, ratio };
}
