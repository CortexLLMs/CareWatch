// src/lib/gestures.js
// Logique PURE de reconnaissance de gestes et d'expressions faciales.
// Aucune dépendance MediaPipe → testable en Node et réutilisable quel que
// soit le modèle de landmarks (FaceMesh 478 pts, Pose 33 pts, Hands 21 pts).

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ─── Paume ouverte face caméra (geste d'urgence) ─────────────────────────
   Le test 2D « la pointe du doigt est plus loin du poignet que la phalange »
   échoue précisément quand la paume fait face à la caméra : les doigts
   pointent vers l'objectif et se projettent près du poignet. On utilise donc
   les landmarks 3D (worldLandmarks, en mètres) fournis par MediaPipe :
   1. au moins 4 des 5 doigts tendus, mesurés en 3D ;
   2. paume suffisamment grande dans l'image (main levée, proche) ;
   3. normale de la paume orientée vers la caméra (si les points 3D existent).

   `hand`  : 21 landmarks normalisés (0..1), pour la taille apparente.
   `world` : 21 landmarks métriques (optionnel) pour l'extension des doigts.
   Retourne un booléen ; le maintien temporel est géré par l'appelant. */
export function isOpenPalm(hand, world = null, minPalmRatio = 0.055) {
  if (!hand || hand.length < 21) return false;
  const src = world && world.length >= 21 ? world : null;

  const d = src ? dist3 : (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pts = src || hand;
  const wrist = pts[0];

  const extended = (tip, pip) => d(pts[tip], wrist) > d(pts[pip], wrist) * 1.06;
  const fingers = [
    extended(8, 6),    // index
    extended(12, 10),  // majeur
    extended(16, 14),  // annulaire
    extended(20, 18),  // auriculaire
  ];
  const thumb = d(pts[4], pts[5]) > d(pts[3], pts[5]) * 1.05;
  const count = fingers.filter(Boolean).length + (thumb ? 1 : 0);
  if (count < 4) return false;

  // Taille apparente : longueur ou largeur de paume (invariante à l'orientation).
  const palmLen = dist(hand[0], hand[9]);
  const palmWid = dist(hand[5], hand[17]);
  if (Math.max(palmLen, palmWid * 0.8) < minPalmRatio) return false;

  // Orientation : la normale de la paume doit viser la caméra.
  if (src) {
    const v1 = { x: src[17].x - src[5].x, y: src[17].y - src[5].y, z: (src[17].z || 0) - (src[5].z || 0) };
    const v2 = { x: src[9].x - src[0].x, y: src[9].y - src[0].y, z: (src[9].z || 0) - (src[0].z || 0) };
    const nx = v1.y * v2.z - v1.z * v2.y;
    const ny = v1.z * v2.x - v1.x * v2.z;
    const nz = v1.x * v2.y - v1.y * v2.x;
    const norm = Math.hypot(nx, ny, nz);
    if (norm > 1e-9 && Math.abs(nz) / norm < 0.25) return false;
  }
  return true;
}

/* ─── Centre approximatif de la paume (pour l'anneau d'alerte) ─── */
export function palmCenter(hand) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0, y = 0;
  for (const i of ids) { x += hand[i].x; y += hand[i].y; }
  return { x: x / ids.length, y: y / ids.length };
}

/* ─── Grimace (expression de douleur) ─────────────────────────────────────
   Trois signaux extraits du maillage facial, normalisés par la largeur du
   visage (invariant à la distance caméra) :
   • abaissement des sourcils (froncement)      — 50 %
   • remontée du haut de la lèvre (mimique nasale) — 30 %
   • ouverture modérée de la bouche (entre bouche close et bâillement) — 40 %
   Les lignes de base s'adaptent lentement (EMA) et UNIQUEMENT au repos,
   pour suivre le visage sans "absorber" une grimace persistante.
   Score ≥ 60 % maintenu ~0,2 s → état actif ; alerte avec cooldown 30 s. */

const MOUTH = { top: 13, bot: 14, left: 78, right: 308 };
const BROW_R = 105;   // sourcil droit
const BROW_L = 334;   // sourcil gauche
const EYE_TOP_R = 159;
const EYE_TOP_L = 386;
const NOSE_BOT = 1;   // extrémité du nez
const FACE_L = 234, FACE_R = 454; // oval facial — largeur de référence

export class GrimaceTracker {
  constructor() { this.reset(); }
  reset() {
    this.baseBrow = null;
    this.baseNose = null;
    this.score = 0;
    this.active = false;
    this._hold = 0;
    this._lastAlertAt = -Infinity;
    this.lastFeatures = null;
  }

  push(landmarks, tMs = 0) {
    if (!landmarks || landmarks.length < 455) {
      this.score = 0; this.active = false; this._hold = 0;
      return this;
    }
    const faceW = Math.max(1e-6, dist(landmarks[FACE_L], landmarks[FACE_R]));
    const mar = dist(landmarks[MOUTH.top], landmarks[MOUTH.bot]) /
                Math.max(1e-6, dist(landmarks[MOUTH.left], landmarks[MOUTH.right]));
    const brow = (dist(landmarks[BROW_R], landmarks[EYE_TOP_R]) +
                  dist(landmarks[BROW_L], landmarks[EYE_TOP_L])) / 2 / faceW;
    const noseLip = dist(landmarks[NOSE_BOT], landmarks[MOUTH.top]) / faceW;

    if (this.baseBrow == null) {
      this.baseBrow = brow; this.baseNose = noseLip;
    } else if (!this.active) {
      this.baseBrow = this.baseBrow * 0.97 + brow * 0.03;
      this.baseNose = this.baseNose * 0.97 + noseLip * 0.03;
    }

    const browDrop  = clamp((this.baseBrow - brow) / (this.baseBrow * 0.22), 0, 1);
    const noseRaise = clamp((this.baseNose - noseLip) / (this.baseNose * 0.30), 0, 1);
    const mouthOpen = clamp((mar - 0.30) / 0.35, 0, 1);

    this.score = Math.round(clamp(100 * (0.50 * browDrop + 0.30 * noseRaise + 0.40 * mouthOpen), 0, 100));
    this.lastFeatures = { mar: +mar.toFixed(3), brow: +brow.toFixed(3), noseLip: +noseLip.toFixed(3) };

    if (this.score >= 60) this._hold++;
    else this._hold = Math.max(0, this._hold - 1);

    if (!this.active && this._hold >= 6) this.active = true;
    else if (this.active && this._hold === 0) this.active = false;
    return this;
  }

  /** true au plus une fois par cooldownMs — évite le spam Novu/Telegram. */
  shouldAlert(tMs, cooldownMs = 30000) {
    if (this.active && tMs - this._lastAlertAt >= cooldownMs) {
      this._lastAlertAt = tMs;
      return true;
    }
    return false;
  }
}
