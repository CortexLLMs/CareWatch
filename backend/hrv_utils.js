// backend/hrv_utils.js
// Pure-JS HRV computation. No external math libraries needed.
//
// Inputs: bandpass-filtered PPG signal samples (Float32Array or number[])
// Outputs: RMSSD, SDNN, pNN50, LF/HF ratio, mean HR, physiological arousal index
//
// Algorithms:
//   - Peak detection: adaptive threshold (mean + 0.4·σ) with min RR gap
//   - Time-domain HRV: RMSSD, SDNN, pNN50 — standard formulas
//   - Frequency-domain: Lomb-Scargle-style periodogram on RR series
//   - Arousal index: maps RMSSD → 0..100 (lower RMSSD = higher arousal)

const FS_DEFAULT = 30;            // PPG sample rate (Hz)
const HR_MIN_HZ = 0.7;            // 42 BPM
const HR_MAX_HZ = 4.0;            // 240 BPM
const LF_BAND = [0.04, 0.15];     // Low-frequency band (sympathetic + parasympathetic)
const HF_BAND = [0.15, 0.4];      // High-frequency band (parasympathetic)

function mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function std(a)  { const m = mean(a); let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2; return Math.sqrt(s / a.length); }

/* ─── Detect peaks → return inter-beat intervals (RR, in ms) ─── */
function detectPeaks(signal, fs) {
  const peaks = [];
  const minDist = Math.round(fs * 60 / 200);   // refractory: 200 BPM max
  const m = mean(signal);
  const sd = std(signal);
  const thr = m + sd * 0.4;
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > thr && signal[i] > signal[i - 1] && signal[i] >= signal[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDist) peaks.push(i);
    }
  }
  const rr = [];
  for (let i = 1; i < peaks.length; i++) rr.push(((peaks[i] - peaks[i - 1]) / fs) * 1000);
  return { peaks, rr };
}

/* ─── Time-domain HRV ───
   RMSSD: root mean square of successive RR differences (parasympathetic activity)
   SDNN:  standard deviation of RR intervals (overall variability)
   pNN50: % of consecutive RR pairs differing > 50ms
*/
function timeDomain(rr) {
  if (rr.length < 4) return { rmssd: null, sdnn: null, pnn50: null, meanHR: null };
  const m = mean(rr);
  const sdnn = std(rr);
  let sq = 0, pnn50 = 0;
  for (let i = 1; i < rr.length; i++) {
    const d = rr[i] - rr[i - 1];
    sq += d * d;
    if (Math.abs(d) > 50) pnn50++;
  }
  const rmssd = Math.sqrt(sq / (rr.length - 1));
  return {
    rmssd: Math.round(rmssd * 10) / 10,
    sdnn:  Math.round(sdnn * 10) / 10,
    pnn50: Math.round((pnn50 / (rr.length - 1)) * 1000) / 10,
    meanHR: Math.round(60000 / m)
  };
}

/* ─── Frequency-domain HRV via simple periodogram ───
   Interpolates RR series to 4 Hz uniform sampling, then DFT in LF and HF bands.
*/
function frequencyDomain(rr) {
  if (rr.length < 8) return { lf: null, hf: null, lfhf: null };
  // Cumulative time series (ms)
  const t = [0];
  for (let i = 0; i < rr.length; i++) t.push(t[i] + rr[i]);
  const totalSec = t[t.length - 1] / 1000;
  if (totalSec < 10) return { lf: null, hf: null, lfhf: null };
  // Resample to 4 Hz uniform
  const fs = 4;
  const N = Math.floor(totalSec * fs);
  const x = new Float64Array(N);
  // Linear interpolation
  for (let i = 0; i < N; i++) {
    const tMs = (i / fs) * 1000;
    // Find bracketing t
    let k = 0;
    while (k < t.length - 1 && t[k + 1] < tMs) k++;
    if (k >= rr.length) { x[i] = rr[rr.length - 1]; continue; }
    const t0 = t[k], t1 = t[k + 1];
    const v0 = rr[Math.max(0, k - 1)] || rr[0];
    const v1 = rr[k];
    x[i] = t1 > t0 ? v0 + (v1 - v0) * (tMs - t0) / (t1 - t0) : v1;
  }
  // Detrend
  const mx = mean(x);
  for (let i = 0; i < N; i++) x[i] -= mx;
  // DFT in LF + HF bands
  const power = (band) => {
    let p = 0;
    for (let f = band[0]; f <= band[1]; f += 0.005) {
      let re = 0, im = 0;
      const w = 2 * Math.PI * f / fs;
      for (let n = 0; n < N; n++) {
        re += x[n] * Math.cos(w * n);
        im -= x[n] * Math.sin(w * n);
      }
      p += (re * re + im * im) / N;
    }
    return p;
  };
  const lf = power(LF_BAND);
  const hf = power(HF_BAND);
  const lfhf = hf > 0 ? lf / hf : null;
  return {
    lf:   Math.round(lf  * 100) / 100,
    hf:   Math.round(hf  * 100) / 100,
    lfhf: lfhf != null ? Math.round(lfhf * 100) / 100 : null
  };
}

/* ─── Baevsky stress index (simplified) ─── */
function baevskyStress(rr) {
  if (rr.length < 8) return null;
  const m = mean(rr);
  const amoBand = 50; // ms window around mode
  let amo = 0;
  for (const v of rr) if (Math.abs(v - m) < amoBand) amo++;
  amo = amo / rr.length;
  const mxdmn = (Math.max(...rr) - Math.min(...rr)) / 1000;
  if (mxdmn <= 0) return null;
  const si = amo / (2 * (m / 1000) * mxdmn);
  return Math.round(si * 100) / 100;
}

/* ─── Map HRV → arousal index (0..100) ───
   Lower RMSSD = lower parasympathetic activity = higher arousal/stress.
   Normal adult RMSSD: 20–100 ms. Map linearly to arousal.
*/
function rmssdToArousal(rmssd) {
  if (rmssd == null) return 50;
  return Math.max(0, Math.min(100, Math.round(100 - (rmssd - 10) * 1.2)));
}

/* ─── Public: full HRV pipeline ─── */
export function computeHRV(signal, fs = FS_DEFAULT) {
  if (!signal || signal.length < fs * 5) {
    return { error: "Signal too short — need at least 5 seconds" };
  }
  const { rr, peaks } = detectPeaks(signal, fs);
  if (rr.length < 4) {
    return { error: "Not enough peaks for HRV (need ≥4 beats)" };
  }
  const td = timeDomain(rr);
  const fd = frequencyDomain(rr);
  const stressIndex = baevskyStress(rr);
  const arousal = rmssdToArousal(td.rmssd);
  return {
    rmssd: td.rmssd,
    sdnn: td.sdnn,
    pnn50: td.pnn50,
    meanHR: td.meanHR,
    lf: fd.lf,
    hf: fd.hf,
    lfhf: fd.lfhf,
    arousal,
    stressIndex,
    nBeats: peaks.length,
    source: "node-pure-js"
  };
}
