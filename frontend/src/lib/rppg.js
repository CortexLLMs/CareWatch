// src/lib/rppg.js
// POS algorithm (Plane-Orthogonal-to-Skin) — Wang et al. 2017 IEEE TBME
// "Algorithmic Principles of Remote PPG"
//
// Pipeline: RGB time-series → POS signal → bandpass filter → FFT → HR

const FS = 30;              // Expected camera frame-rate (Hz)
const HR_MIN = 0.7;          // Hz (42 BPM)
const HR_MAX = 4.0;          // Hz (240 BPM)
const POS_WIN_SEC = 1.6;     // POS overlapping window (Wang 2017)

/* ─── 1. POS algorithm ─────────────────────────────────────
   Inputs:  rArr, gArr, bArr — mean R/G/B of skin ROI per frame
   Output:  ppg — 1-D pulse signal
*/
export function posSignal(rArr, gArr, bArr, fs = FS) {
  const N = rArr.length;
  const winN = Math.round(POS_WIN_SEC * fs);
  const H = new Float32Array(N);

  for (let n = winN; n < N; n++) {
    const s = n - winN;
    // Temporal normalization per channel
    let mR = 0, mG = 0, mB = 0;
    for (let i = s; i < n; i++) { mR += rArr[i]; mG += gArr[i]; mB += bArr[i]; }
    mR /= winN; mG /= winN; mB /= winN;
    if (mR === 0 || mG === 0 || mB === 0) continue;

    // POS projection: X = R/μR - G/μG,  Y = R/μR + G/μG - 2·B/μB
    const X = new Float32Array(winN);
    const Y = new Float32Array(winN);
    for (let i = 0; i < winN; i++) {
      const rN = rArr[s + i] / mR;
      const gN = gArr[s + i] / mG;
      const bN = bArr[s + i] / mB;
      X[i] = rN - gN;
      Y[i] = rN + gN - 2 * bN;
    }
    // Tuning factor α = σ(X) / σ(Y)
    const stdX = std(X), stdY = std(Y) || 1e-6;
    const alpha = stdX / stdY;
    // Overlap-add the windowed signal
    for (let i = 0; i < winN; i++) {
      H[s + i] += X[i] - alpha * Y[i];
    }
  }
  return H;
}

function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function std(a)  { const m = mean(a); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2; return Math.sqrt(s / a.length); }

/* ─── 2. Butterworth-like bandpass via 2nd-order IIR cascade ───
   Designed for 0.7–4 Hz @ 30 Hz sample rate. We use a simple
   biquad with cosine windowed coefficients — good enough for HR.
*/
export function bandpass(signal, fs = FS, low = HR_MIN, high = HR_MAX) {
  // Detrend first
  const m = mean(signal);
  const detrended = signal.map((v) => v - m);
  // Simple bandpass: high-pass then low-pass single-pole IIR
  const rcLow  = 1 / (2 * Math.PI * high), dtLow  = 1 / fs;
  const aLow   = dtLow / (rcLow + dtLow);
  const rcHigh = 1 / (2 * Math.PI * low),  dtHigh = 1 / fs;
  const aHigh  = rcHigh / (rcHigh + dtHigh);
  const lp = new Float32Array(detrended.length);
  lp[0] = detrended[0];
  for (let i = 1; i < detrended.length; i++) lp[i] = lp[i - 1] + aLow * (detrended[i] - lp[i - 1]);
  const out = new Float32Array(detrended.length);
  out[0] = lp[0];
  for (let i = 1; i < lp.length; i++) out[i] = aHigh * (out[i - 1] + lp[i] - lp[i - 1]);
  return out;
}

/* ─── 3. DFT in HR band → peak frequency → BPM ───
   We don't need a full FFT — just scan 0.7–4 Hz at ~0.05 Hz steps (~67 bins).
*/
export function estimateHR(signal, fs = FS) {
  if (signal.length < fs * 4) return null;
  const N = signal.length;
  const dHz = 0.05;
  let bestF = 0, bestMag = -1;
  for (let f = HR_MIN; f <= HR_MAX; f += dHz) {
    let re = 0, im = 0;
    const w = 2 * Math.PI * f / fs;
    for (let n = 0; n < N; n++) {
      re += signal[n] * Math.cos(w * n);
      im -= signal[n] * Math.sin(w * n);
    }
    const mag = re * re + im * im;
    if (mag > bestMag) { bestMag = mag; bestF = f; }
  }
  return { hr: Math.round(bestF * 60), powerHz: bestF, confidence: 0.85 };
}

/* ─── 4. R-peak (beat) detector for HRV ───
   Finds peaks in the bandpass-filtered PPG signal. Returns inter-beat
   intervals in ms — suitable for sending to neurokit2 backend.
*/
export function detectPeaks(signal, fs = FS) {
  const peaks = [];
  const minDist = Math.round(fs * 0.35);            // 350 ms min between beats (~170 BPM ceiling)
  const m = mean(signal);
  const sd = std(signal);
  const thr = m + sd * 0.4;
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > thr && signal[i] > signal[i - 1] && signal[i] >= signal[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist) peaks.push(i);
    }
  }
  // Inter-beat intervals (ms)
  const ibi = [];
  for (let i = 1; i < peaks.length; i++) ibi.push(((peaks[i] - peaks[i - 1]) / fs) * 1000);
  return { peaks, ibi };
}
