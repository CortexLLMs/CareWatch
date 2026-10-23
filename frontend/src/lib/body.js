// src/lib/body.js
// MediaPipe PoseLandmarker (corps) + HandLandmarker (mains) et dessin du
// squelette superposé à la vidéo : corps, mains, oval facial + traits.
// Les modèles sont chargés depuis le CDN MediaPipe (GPU → WASM en repli) ;
// un échec de chargement n'est PAS bloquant : la caméra rPPG reste utilisable.

import { PoseLandmarker, HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const POSE_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const HANDS_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let poseLm = null;
let handsLm = null;
let initPromise = null;

export async function initBodyLandmarkers() {
  if (poseLm && handsLm) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const [p, h] = await Promise.all([
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HANDS_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    ]);
    poseLm = p;
    handsLm = h;
    return true;
  })().catch((e) => { initPromise = null; throw e; });
  return initPromise;
}

export function detectPose(video, tMs) {
  if (!poseLm) return null;
  try {
    const r = poseLm.detectForVideo(video, tMs);
    const lm = r && r.landmarks && r.landmarks[0];
    return lm && lm.length ? lm : null;
  } catch { return null; }
}

export function detectHands(video, tMs) {
  if (!handsLm) return null;
  try {
    const r = handsLm.detectForVideo(video, tMs);
    return r && r.landmarks && r.landmarks.length ? r.landmarks : null;
  } catch { return null; }
}

/* ─── Connexions du squelette (index MediaPipe) ─── */
export const POSE_LINKS = [
  // épaules + bras
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  // torse
  [11, 23], [12, 24], [23, 24],
  // jambes
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

export const HAND_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// Oval facial (anneau), yeux, sourcils, lèvres — FaceLandmarker 478 points.
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 178, 146, 91, 81, 82, 13, 195, 4, 94, 151, 172,
  136, 175, 150, 149, 176,
];
const FACE_FEATURES = [
  // œil droit
  [33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155],
  [155, 133], [133, 173], [173, 157], [157, 158], [158, 159], [159, 160],
  [160, 161], [161, 246], [246, 33],
  // œil gauche
  [362, 382], [382, 381], [381, 380], [380, 374], [374, 373], [373, 390],
  [390, 249], [249, 263], [263, 466], [466, 388], [388, 387], [387, 386],
  [386, 385], [385, 384], [384, 398], [398, 362],
  // sourcils
  [70, 63], [63, 105], [105, 66], [66, 107], [107, 55], [55, 193],
  [300, 293], [293, 334], [334, 296], [296, 336], [336, 265], [265, 46],
  // lèvres (extérieur + intérieur)
  [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267], [267, 269],
  [269, 270], [270, 409], [409, 291], [291, 375], [375, 321], [321, 405],
  [405, 314], [314, 17], [17, 84], [84, 181], [181, 91], [91, 146], [146, 61],
  [78, 191], [191, 80], [80, 81], [81, 82], [82, 13], [13, 312], [312, 311],
  [311, 310], [310, 415], [415, 308], [308, 324], [324, 318], [318, 402],
  [402, 317], [317, 14], [14, 87], [87, 88], [88, 95], [95, 78],
];

const C = {
  body: "#00c2ff",
  bodyJoint: "#8fe4ff",
  hand: "#2ee6a8",
  handAlert: "#ffb020",
  palmAlert: "#ff4d5e",
  face: "#7aa2ff",
  faceGrimace: "#ff5a68",
};

/* ─── Dessin de l'overlay squelette ───
   ctx       : contexte 2D du canvas superposé à la vidéo
   map(lm)   : landmark normalisé (0..1) → pixel canvas (gère object-fit cover)
   Options   : face / pose / hands / grimaceScore / palm (bool) / palmCenter
               / emergency (bool) / tMs (pour le pulsé) / showFace (bool)      */
export function drawOverlay(ctx, o) {
  const { W, H, map, face, pose, hands } = o;
  ctx.clearRect(0, 0, W, H);
  if (!W || !H) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const seg = (a, b, color, w, alpha = 1) => {
    const pa = map(a), pb = map(b);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  };
  const dot = (p, color, r) => {
    const pp = map(p);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  /* Corps */
  if (pose) {
    for (const [a, b] of POSE_LINKS) {
      const la = pose[a], lb = pose[b];
      if (!la || !lb) continue;
      if ((la.visibility != null && la.visibility < 0.5) ||
          (lb.visibility != null && lb.visibility < 0.5)) continue;
      seg(la, lb, C.body, 2.5, 0.9);
    }
    for (let i = 11; i <= 32; i++) {
      const l = pose[i];
      if (!l || (l.visibility != null && l.visibility < 0.5)) continue;
      dot(l, C.bodyJoint, 3);
    }
  }

  /* Mains */
  if (hands) {
    for (const hand of hands) {
      const alert = o.palm || o.emergency;
      const col = alert ? C.palmAlert : C.hand;
      for (const [a, b] of HAND_LINKS) {
        if (!hand[a] || !hand[b]) continue;
        seg(hand[a], hand[b], col, 2.2, 0.95);
      }
      for (const tip of [4, 8, 12, 16, 20]) {
        if (hand[tip]) dot(hand[tip], col, 3.2);
      }
      if (alert && o.palmCenter) {
        const pc = map(o.palmCenter);
        const pulse = 0.5 + 0.5 * Math.sin((o.tMs || 0) / 140);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = C.palmAlert;
        ctx.lineWidth = 2 + 2 * pulse;
        ctx.beginPath();
        ctx.arc(pc.x, pc.y, 26 + 10 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(pc.x, pc.y, 40 + 14 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /* Visage */
  if (o.showFace !== false && face) {
    const grim = (o.grimaceScore || 0) >= 60;
    const faceCol = grim ? C.faceGrimace : C.face;
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = faceCol;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < FACE_OVAL.length; i++) {
      const p = map(face[FACE_OVAL[i]]);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.globalAlpha = grim ? 1 : 0.65;
    ctx.strokeStyle = faceCol;
    ctx.beginPath();
    for (const [a, b] of FACE_FEATURES) {
      const pa = map(face[a]), pb = map(face[b]);
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();

    if (grim) {
      // Cadre "douleur" autour du visage
      const xs = [], ys = [];
      for (const i of FACE_OVAL) { const p = map(face[i]); xs.push(p.x); ys.push(p.y); }
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = C.faceGrimace;
      ctx.lineWidth = 2;
      const c = Math.min(16, (x1 - x0) / 4, (y1 - y0) / 4);
      ctx.beginPath();
      // 4 coins
      ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0);
      ctx.moveTo(x1 - c, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + c);
      ctx.moveTo(x1, y1 - c); ctx.lineTo(x1, y1); ctx.lineTo(x1 - c, y1);
      ctx.moveTo(x0 + c, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - c);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
}
