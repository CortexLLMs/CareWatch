// src/lib/hrv.js
// HRV client — buffers PPG signal, posts to backend for neurokit2 computation.

import axios from "axios";
import { API } from "./api";

/**
 * Send PPG signal buffer to backend for HRV computation.
 *
 * @param {Float32Array|number[]} signal - bandpass-filtered PPG samples
 * @param {number} fs - sample rate (Hz)
 * @returns {Promise<{rmssd, sdnn, lfhf, meanHR, stressIndex}|null>}
 */
export async function computeHRV(signal, fs = 30) {
  try {
    const arr = Array.from(signal);
    const r = await axios.post(`${API}/hrv/compute`, { signal: arr, fs }, { timeout: 8000 });
    return r.data;
  } catch (_) {
    return null;
  }
}

/* ─── Local fallback if backend offline ───
   Computes basic time-domain HRV from inter-beat intervals (IBI in ms).
*/
export function localHRV(ibiMs) {
  if (!ibiMs || ibiMs.length < 4) return null;
  // SDNN: standard deviation of all NN intervals
  const m = ibiMs.reduce((a, b) => a + b, 0) / ibiMs.length;
  const sdnn = Math.sqrt(ibiMs.reduce((a, b) => a + (b - m) ** 2, 0) / ibiMs.length);

  // RMSSD: root mean square of successive differences (parasympathetic)
  let sq = 0;
  for (let i = 1; i < ibiMs.length; i++) sq += (ibiMs[i] - ibiMs[i - 1]) ** 2;
  const rmssd = Math.sqrt(sq / (ibiMs.length - 1));

  // pNN50: % of consecutive NN intervals differing > 50ms
  let pnn50 = 0;
  for (let i = 1; i < ibiMs.length; i++) if (Math.abs(ibiMs[i] - ibiMs[i - 1]) > 50) pnn50++;
  pnn50 = (pnn50 / (ibiMs.length - 1)) * 100;

  // Rough stress proxy: lower RMSSD → higher arousal
  // Normal RMSSD 20–100ms. Map → arousal 0..100 (lower RMSSD = higher arousal)
  const arousal = Math.max(0, Math.min(100, 100 - (rmssd - 10) * 1.2));

  return {
    rmssd: Math.round(rmssd * 10) / 10,
    sdnn: Math.round(sdnn * 10) / 10,
    pnn50: Math.round(pnn50 * 10) / 10,
    meanHR: Math.round(60000 / m),
    arousal: Math.round(arousal),
    source: "local"
  };
}
