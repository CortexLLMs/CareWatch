// src/lib/face.js
// MediaPipe FaceLandmarker wrapper.
// — Provides skin ROI mean RGB (forehead + cheeks) for rPPG
// — Provides EAR (Eye Aspect Ratio) + PERCLOS for drowsiness/fatigue
// — Provides MAR (Mouth Aspect Ratio) for yawn detection

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarker = null;
let initPromise = null;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

export async function initFaceLandmarker() {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });
    return landmarker;
  })();
  return initPromise;
}

/* ─── Landmark groups (MediaPipe FaceMesh 468-point model) ───
   Forehead patch (between brows, above): 10, 109, 67, 297, 338, 151
   Right cheek: 50, 117, 118, 119, 120, 100
   Left cheek:  280, 346, 347, 348, 349, 329
   Right eye (for EAR): 33, 160, 158, 133, 153, 144
   Left eye  (for EAR): 362, 385, 387, 263, 373, 380
   Mouth corners + lips: 78, 308, 13, 14
*/

const FOREHEAD = [10, 109, 67, 297, 338, 151];
const R_CHEEK = [50, 117, 118, 119, 120, 100];
const L_CHEEK = [280, 346, 347, 348, 349, 329];
const SKIN_ROI = [...FOREHEAD, ...R_CHEEK, ...L_CHEEK];

const R_EYE = [33, 160, 158, 133, 153, 144];
const L_EYE = [362, 385, 387, 263, 373, 380];

const MOUTH_TOP = 13;
const MOUTH_BOT = 14;
const MOUTH_LEFT = 78;
const MOUTH_RIGHT = 308;

/* ─── Detect once per frame ─── */
export function detect(videoEl, tMs) {
  if (!landmarker) return null;
  try {
    const r = landmarker.detectForVideo(videoEl, tMs);
    if (!r?.faceLandmarks?.length) return null;
    return r.faceLandmarks[0];
  } catch {
    return null;
  }
}

/* ─── Skin ROI: sample mean R/G/B over forehead + cheeks ─── */
export function sampleSkinROI(landmarks, ctx, w, h) {
  if (!landmarks) return null;
  let R = 0, G = 0, B = 0, n = 0;
  const patchSize = 8; // half-side in pixels
  for (const idx of SKIN_ROI) {
    const lm = landmarks[idx];
    const cx = Math.round(lm.x * w);
    const cy = Math.round(lm.y * h);
    const x0 = Math.max(0, cx - patchSize);
    const y0 = Math.max(0, cy - patchSize);
    const pw = Math.min(w - x0, patchSize * 2);
    const ph = Math.min(h - y0, patchSize * 2);
    if (pw <= 0 || ph <= 0) continue;
    const px = ctx.getImageData(x0, y0, pw, ph).data;
    for (let i = 0; i < px.length; i += 4) {
      R += px[i];
      G += px[i + 1];
      B += px[i + 2];
      n++;
    }
  }
  if (!n) return null;
  return { r: R / n, g: G / n, b: B / n };
}

/* ─── EAR (Eye Aspect Ratio) ───
   EAR = (||p2-p6|| + ||p3-p5||) / (2·||p1-p4||)
   < 0.20 typically = eye closed
*/
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function earFor(lms, eye) {
  const p1 = lms[eye[0]], p2 = lms[eye[1]], p3 = lms[eye[2]];
  const p4 = lms[eye[3]], p5 = lms[eye[4]], p6 = lms[eye[5]];
  const v = dist(p2, p6) + dist(p3, p5);
  const h = 2 * dist(p1, p4);
  return h > 0 ? v / h : 0;
}

export function ear(landmarks) {
  if (!landmarks) return null;
  return (earFor(landmarks, R_EYE) + earFor(landmarks, L_EYE)) / 2;
}

/* ─── MAR (Mouth Aspect Ratio) for yawn detection ─── */
export function mar(landmarks) {
  if (!landmarks) return null;
  const top = landmarks[MOUTH_TOP], bot = landmarks[MOUTH_BOT];
  const left = landmarks[MOUTH_LEFT], right = landmarks[MOUTH_RIGHT];
  const v = dist(top, bot);
  const h = dist(left, right);
  return h > 0 ? v / h : 0;
}

/* ─── PERCLOS — percentage of eye-closure over rolling window ───
   Gold standard for drowsiness (Dinges & Grace 1998).
   Returns 0..1 — typically > 0.15 indicates drowsiness.
*/
export class PerclosBuffer {
  constructor(windowSec = 60, fs = 30, earThreshold = 0.20) {
    this.size = windowSec * fs;
    this.thr = earThreshold;
    this.buf = [];
    this.blinks = 0;
    this.closedFrames = 0;
    this._wasClosed = false;
  }
  push(earVal) {
    if (earVal == null) return;
    const closed = earVal < this.thr;
    this.buf.push(closed ? 1 : 0);
    if (this.buf.length > this.size) this.buf.shift();
    // Blink detection: rising edge of closure
    if (closed && !this._wasClosed) this.blinks++;
    this._wasClosed = closed;
  }
  perclos() {
    if (!this.buf.length) return 0;
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  blinkRate() {
    // blinks per minute, scaled by buffer fill
    const seconds = Math.min(this.buf.length / 30, 60);
    return seconds > 0 ? (this.blinks / seconds) * 60 : 0;
  }
  reset() { this.buf = []; this.blinks = 0; this._wasClosed = false; }
}
