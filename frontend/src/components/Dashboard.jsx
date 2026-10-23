// src/components/Dashboard.jsx
// Scientific pipeline:
//   1. MediaPipe FaceMesh → skin ROI (forehead + cheeks) + eye landmarks
//   2. POS algorithm (Wang 2017) → 1D PPG signal
//   3. Bandpass 0.7–4 Hz → FFT → Heart rate
//   4. PPG buffer → backend /api/hrv/compute (neurokit2) → HRV → arousal
//   5. EAR + PERCLOS (Dinges 1998) → drowsiness
//   6. Self-report modal → subjective anxiety/mood (camera can't measure these)

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Sidebar from "./Sidebar";
import CameraCard from "./CameraCard";
import AlertsCard from "./AlertsCard";
import NotifyCard from "./NotifyCard";
import MedPanel from "./MedPanel";
import VitalityRing from "./VitalityRing";
import Waveform from "./Waveform";
import MetricCard from "./MetricCard";
import Disclaimer from "./Disclaimer";
import SelfReport from "./SelfReport";
import {
  IconHeart, IconLung, IconBrain, IconFlame, IconSparkle, IconShield,
  IconPlay, IconStop, IconCheck, IconAlert, IconSun, IconMoon
} from "./Icons";
import MonthlyReport from "./MonthlyReport";
import CameraSettings from "./CameraSettings";
import { recordSample, addSeconds, recordAlert } from "../lib/history";
import { cameraConstraints, fallbackConstraints, getSavedCameraId } from "../lib/camera";
import {
  checkBackend, startSession as apiStartSession, endSession as apiEndSession,
  saveMetrics as apiSaveMetrics, saveAlert as apiSaveAlert, saveSelfReport
} from "../lib/api";
import { posSignal, bandpass, estimateHR, detectPeaks, estimateFps, estimateSpO2 } from "../lib/rppg";
import { initFaceLandmarker, detect, sampleSkinROI, ear, mar, PerclosBuffer } from "../lib/face";
import { initBodyLandmarkers, detectPose, detectHands, drawOverlay } from "../lib/body";
import { isOpenPalm, palmCenter, GrimaceTracker } from "../lib/gestures";
import { initAlarm, playEmergencyAlarm } from "../lib/alarm";
import { computeHRV, localHRV } from "../lib/hrv";
import { useT } from "../i18n.jsx";

const FS = 30;                  // expected sample rate
const RPPG_WIN_SEC = 10;        // PPG analysis window
const HRV_INTERVAL_MS = 15000;  // recompute HRV every 15s
const HIST_LEN = 30;
const POSE_MS = 55;             // cadence détection corps (~18 Hz)
const HANDS_MS = 70;            // cadence détection mains (~14 Hz)
const EMERGENCY_COOLDOWN_MS = 30000; // cooldown du geste d'urgence
const EMERGENCY_SHOW_MS = 10000;     // durée d'affichage de la bannière
const PALM_HOLD_MS = 450;            // maintien requis de la paume ouverte
const PALM_GRACE_MS = 350;           // tolérance entre deux détections
const ALERT_POST_MS = 15000;         // anti-spam envoi alerte Novu/Telegram

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export default function Dashboard({ medData, onMedUpdate, onReset }) {
  const { t, locale, lang, theme, toggleTheme, cycleLang } = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const [active, setActive] = useState("dash");
  const [running, setRunning] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [sessId, setSessId] = useState(null);
  const [backendOk, setBackendOk] = useState(null);
  const [faceReady, setFaceReady] = useState(false);
  const [bodyReady, setBodyReady] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [gesture, setGesture] = useState({ palm: false, grimace: false });
  const [selfReportOpen, setSelfReportOpen] = useState(false);
  const [selfReport, setSelfReport] = useState(null);

  const [metrics, setMetrics] = useState({
    heartRate: 0,
    oxygen: 0,            // RGB-only SpO₂ — flagged as estimate
    arousal: 0,           // from HRV RMSSD
    drowsiness: 0,        // from PERCLOS
    blinkRate: 0,         // blinks/min
    yawnLevel: 0,         // MAR
    grimace: 0,           // expression de douleur (sourcils + lèvres)
    brightness: 0,
    motion: 0,
    rmssd: 0, sdnn: 0, lfhf: 0,
    confidence: 0
  });

  const [history, setHistory] = useState({
    heartRate: [], arousal: [], drowsiness: [], oxygen: [], grimace: []
  });
  const [alerts, setAlerts] = useState([]);

  const videoRef = useRef(null), canvasRef = useRef(null), overlayRef = useRef(null);
  const rgbBuf = useRef({ r: [], g: [], b: [], t: [] });
  const ppgBuf = useRef([]);
  const perclos = useRef(new PerclosBuffer(60, FS, 0.20));
  const lastHRV = useRef(0);
  const hrHist = useRef([]);           // 5 dernières estimations HR (lissage médian)
  const sessSecs = useRef(0);
  const [, force] = useState(0);

  // ─── Vision corps / mains / gestes ───
  const poseBuf = useRef(null);          // { lm, at } — dernier squelette corps
  const handsBuf = useRef(null);         // { lm, at } — dernières mains
  const lastPoseAt = useRef(0), lastHandsAt = useRef(0);
  const palmHold = useRef(0);            // paume ouverte (0/1) avec tolérance
  const palmC = useRef(null);            // centre de paume (coordonnées 0..1)
  const palmSince = useRef(null);        // début du maintien de la paume
  const palmSeenAt = useRef(-Infinity);  // dernière détection de paume
  const emergencyAt = useRef(-Infinity); // timestamp du dernier déclenchement
  const yawnLevel = useRef(0);           // niveau de bâillement lissé (0..100)
  const yawnBase = useRef(null);         // ouverture de bouche au repos (adaptatif)
  const grimaceTrk = useRef(new GrimaceTracker());
  const gestureRef = useRef({ palm: false, grimace: false });
  const alertPostAt = useRef({});        // anti-spam Novu/Telegram par type

  /* ─── Clock + backend check + face init ─── */
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { checkBackend().then(setBackendOk); }, []);
  useEffect(() => {
    initFaceLandmarker()
      .then(() => setFaceReady(true))
      .catch((e) => { console.error("FaceLandmarker init failed", e); setFaceReady(false); });
    // Squelette corps + mains — échec non bloquant (CDN indisponible, etc.)
    initBodyLandmarkers()
      .then(() => setBodyReady(true))
      .catch((e) => { console.warn("Pose/Hands init failed (overlay désactivé)", e); setBodyReady(false); });
  }, []);

  useEffect(() => {
    if (!running) { sessSecs.current = 0; return; }
    const id = setInterval(() => {
      sessSecs.current++;
      addSeconds(1);
      force((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Navigation latérale : chaque entrée amène à sa section (ancres).
  const NAV_ANCHOR = {
    dash: "cw-overview", meds: "cw-meds", alerts: "cw-alerts",
    session: "cw-sessions", settings: "cw-settings",
  };
  useEffect(() => {
    const id = NAV_ANCHOR[active];
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);

  /* ─── Start / Stop ─── */
  const startSession = useCallback(async () => {
    try {
      // Débloque l'audio d'urgence sur ce geste utilisateur (politique mobile).
      initAlarm();
      // La caméra s'ouvre immédiatement : l'API ne doit jamais la bloquer.
      // La source mémorisée (iVCam, webcam USB) est prioritaire ; si elle a
      // disparu, on retombe sur la caméra par défaut sans bloquer la session.
      const savedCam = getSavedCameraId();
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints() });
      } catch (camErr) {
        if (!savedCam) throw camErr;
        console.warn("Caméra mémorisée indisponible, repli sur la caméra par défaut.", camErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: fallbackConstraints() });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rgbBuf.current = { r: [], g: [], b: [], t: [] };
      ppgBuf.current = [];
      hrHist.current = [];
      perclos.current.reset();
      lastHRV.current = 0;
      poseBuf.current = null;
      handsBuf.current = null;
      palmHold.current = 0;
      palmC.current = null;
      palmSince.current = null;
      palmSeenAt.current = -Infinity;
      yawnLevel.current = 0;
      yawnBase.current = null;
      lastPoseAt.current = 0;
      lastHandsAt.current = 0;
      grimaceTrk.current.reset();
      alertPostAt.current = {};
      emergencyAt.current = -Infinity;
      setEmergency(false);
      setGesture({ palm: false, grimace: false });
      gestureRef.current = { palm: false, grimace: false };
      setRunning(true);

      // Identifiant de session en arrière-plan (backend si joignable, sinon local).
      const sid = await apiStartSession(/Mobi/.test(navigator.userAgent) ? "mobile" : "pc", FS);
      setSessId(sid);
    } catch (err) {
      alert(tRef.current("dash.startErr") + (err.response?.data?.error || err.message || err));
    }
  }, []);

  const stopSession = useCallback(async () => {
    videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
    if (sessId) await apiEndSession(sessId);
    setRunning(false); setSessId(null);
    palmHold.current = 0; palmSince.current = null; palmC.current = null;
    setGesture({ palm: false, grimace: false });
    gestureRef.current = { palm: false, grimace: false };
  }, [sessId]);

  /* ─── Main analysis loop ─── */
  useEffect(() => {
    if (!running || !sessId) return;
    let raf, lastSave = 0;

    const loop = async () => {
      const v = videoRef.current, c = canvasRef.current;
      if (!v || !c || v.readyState < 2) { raf = requestAnimationFrame(loop); return; }

      const ctx = c.getContext("2d", { willReadFrequently: true });
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      ctx.drawImage(v, 0, 0);

      const tMs = performance.now();
      const landmarks = faceReady ? detect(v, tMs) : null;

      /* ─── Squelette corps + mains (détections cadencées) ─── */
      if (bodyReady && tMs - lastPoseAt.current > POSE_MS) {
        lastPoseAt.current = tMs;
        const p = detectPose(v, tMs);
        if (p) poseBuf.current = { lm: p, at: tMs };
      }
      if (bodyReady && tMs - lastHandsAt.current > HANDS_MS) {
        lastHandsAt.current = tMs;
        const det = detectHands(v, tMs);
        if (det) handsBuf.current = { lm: det.hands, at: tMs };

        let open = null;
        if (det) {
          for (let i = 0; i < det.hands.length; i++) {
            if (isOpenPalm(det.hands[i], det.world?.[i])) { open = det.hands[i]; break; }
          }
        }

        // Maintien temporel avec tolérance : les détections de main sont
        // intermittentes, un simple comptage de frames ne déclenchait jamais.
        if (open) {
          palmSeenAt.current = tMs;
          if (!palmSince.current) palmSince.current = tMs;
          palmHold.current = 1;
          palmC.current = palmCenter(open);

          if (tMs - palmSince.current >= PALM_HOLD_MS &&
              tMs - emergencyAt.current > EMERGENCY_COOLDOWN_MS) {
            emergencyAt.current = tMs;
            palmSince.current = null;
            setEmergency(true);
            setTimeout(() => setEmergency(false), EMERGENCY_SHOW_MS);
            playEmergencyAlarm();

            // Envoi immédiat (ne dépend pas du cycle rPPG de 500 ms).
            const contact = medData?.contact || "";
            const notify = {
              subscriberId: "carewatch-user",
              ...(contact.includes("@") ? { email: contact } : {}),
              ...(contact && !contact.includes("@") ? { telegram: contact } : {}),
            };
            alertPostAt.current["emergency"] = Date.now();
            recordAlert("emergency");
            apiSaveAlert(sessId, {
              type: "emergency", severity: "critical",
              message: tRef.current("alerts.lbl.emergency"),
            }, notify);
          }
        } else if (tMs - palmSeenAt.current > PALM_GRACE_MS) {
          palmHold.current = 0;
          palmSince.current = null;
          palmC.current = null;
        }
      }

      /* ─── Grimace (expression de douleur) ─── */
      const g = grimaceTrk.current.push(landmarks, tMs);

      // Synchronisation des puces d'état (uniquement si changement)
      const gestNow = { palm: palmHold.current > 0, grimace: g.active };
      if (gestNow.palm !== gestureRef.current.palm || gestNow.grimace !== gestureRef.current.grimace) {
        gestureRef.current = gestNow;
        setGesture(gestNow);
      }

      let rgb = null;
      let earVal = null;
      let marVal = null;

      if (landmarks) {
        rgb = sampleSkinROI(landmarks, ctx, c.width, c.height);
        earVal = ear(landmarks);
        marVal = mar(landmarks);
      } else {
        // Fallback: sample a fixed center rectangle (degraded)
        const fw = Math.floor(c.width * 0.3), fh = Math.floor(c.height * 0.15);
        const fx = Math.floor(c.width * 0.35), fy = Math.floor(c.height * 0.1);
        const data = ctx.getImageData(fx, fy, fw, fh).data;
        let R = 0, G = 0, B = 0;
        for (let i = 0; i < data.length; i += 4) { R += data[i]; G += data[i + 1]; B += data[i + 2]; }
        const n = data.length / 4;
        rgb = { r: R / n, g: G / n, b: B / n };
      }

      if (rgb) {
        rgbBuf.current.r.push(rgb.r);
        rgbBuf.current.g.push(rgb.g);
        rgbBuf.current.b.push(rgb.b);
        rgbBuf.current.t.push(tMs);
        const maxN = FS * RPPG_WIN_SEC;
        if (rgbBuf.current.r.length > maxN) {
          rgbBuf.current.r.shift(); rgbBuf.current.g.shift();
          rgbBuf.current.b.shift(); rgbBuf.current.t.shift();
        }
      }

      // ─── Bâillement : ouverture de bouche normalisée, calculée en continu ───
      // Indépendant du tampon rPPG : l'affichage ne doit pas rester à zéro si
      // le visage est détecté mais que le signal cardiaque est encore court.
      if (marVal != null) {
        const base = yawnBase.current ?? marVal;
        const floor = Math.max(0.09, base * 1.25);   // ouverture de repos
        const raw = clamp(((marVal - floor) / 0.36) * 100, 0, 100);
        yawnLevel.current = yawnLevel.current * 0.75 + raw * 0.25;
        if (raw < 25) yawnBase.current = base * 0.98 + marVal * 0.02;
      } else {
        yawnLevel.current *= 0.92;
      }

      // PERCLOS
      if (earVal != null) perclos.current.push(earVal);

      // Brightness for camera quality
      const full = ctx.getImageData(0, 0, c.width, c.height).data;
      let brightness = 0;
      for (let i = 0; i < full.length; i += 16) brightness += (full[i] + full[i + 1] + full[i + 2]) / 3;
      brightness /= full.length / 16;

      const now = Date.now();
      if (now - lastSave > 500) {
        lastSave = now;

        const hasSignal = rgbBuf.current.r.length > FS * 4;
        let fsNow = FS, bp = null, hr = 0, confidence = 0, oxygen = 0, oxygenConf = 0;

        if (hasSignal) {
          // ─── 1. POS → bandpass → HR (cadence réelle mesurée) ───
          fsNow = estimateFps(rgbBuf.current.t, FS);
          const pos = posSignal(rgbBuf.current.r, rgbBuf.current.g, rgbBuf.current.b, fsNow);
          bp = bandpass(pos, fsNow);
          ppgBuf.current = Array.from(bp);
          const hrRes = estimateHR(bp, fsNow);
          confidence = hrRes ? hrRes.confidence : 0;

          // Lissage médian sur 5 estimations (stabilité d'affichage)
          if (hrRes && hrRes.hr > 0 && confidence > 0.15) {
            hrHist.current.push(hrRes.hr);
            if (hrHist.current.length > 5) hrHist.current.shift();
          }
          hr = hrHist.current.length ? Math.round(median(hrHist.current)) : 0;

          // ─── 2. SpO₂ par ratio-of-ratios (expérimental, confiance dédiée) ───
          const spo2 = estimateSpO2(rgbBuf.current.r, rgbBuf.current.g, fsNow);
          oxygen = spo2.value != null ? spo2.value : 0;
          oxygenConf = spo2.confidence || 0;
        }

        // ─── 3. PERCLOS → somnolence ; bâillement calculé en continu ───
        const p = perclos.current.perclos();
        const drowsiness = Math.round(clamp(p * 100 * 3, 0, 100));   // PERCLOS > 15% → drowsy
        const blinkRate = perclos.current.blinkRate();
        const yawnPct = Math.round(clamp(yawnLevel.current, 0, 100));

        // ─── 4. HRV via backend (every 15s) ───
        let hrvMetrics = null;
        if (bp && now - lastHRV.current > HRV_INTERVAL_MS && ppgBuf.current.length >= fsNow * 8) {
          lastHRV.current = now;
          if (backendOk) {
            hrvMetrics = await computeHRV(ppgBuf.current, fsNow);
          }
          if (!hrvMetrics) {
            // Local fallback
            const { ibi } = detectPeaks(bp, fsNow);
            hrvMetrics = localHRV(ibi);
          }
        }

        setMetrics((prev) => {
          // Preliminary stress from HR + drowsiness when HRV not yet available.
          // Resting HR baseline ~70 BPM. Each BPM above 80 adds ~1.5 to stress.
          // Drowsiness contributes a small amount because tired people score higher on stress scales.
          let prelimStress = 0;
          if (hr > 0) {
            prelimStress = clamp((hr - 70) * 1.2 + drowsiness * 0.25, 0, 100);
          }

          const next = {
            ...prev,
            heartRate: hr || prev.heartRate,
            oxygen: oxygen || prev.oxygen,
            oxygenConfidence: oxygen ? Math.round(oxygenConf * 100) : prev.oxygenConfidence,
            drowsiness,
            blinkRate: Math.round(blinkRate),
            yawnLevel: yawnPct,
            grimace: g.score,
            brightness: Math.round(brightness),
            motion: 0,
            confidence: confidence ? Math.round(confidence * 100) : prev.confidence,
            // If HRV not yet computed, use preliminary HR-based estimate.
            // If we already had an HRV-based arousal value, keep it.
            arousal: prev.rmssd > 0 ? prev.arousal : Math.round(prelimStress),
          };
          if (hrvMetrics) {
            next.rmssd = hrvMetrics.rmssd || prev.rmssd;
            next.sdnn = hrvMetrics.sdnn || prev.sdnn;
            next.lfhf = hrvMetrics.lfhf || prev.lfhf;
            next.arousal = hrvMetrics.arousal != null ? hrvMetrics.arousal : prev.arousal;
          }
          return next;
        });

        // ─── 5. Save to backend ───
        recordSample({
          heartRate: hr, oxygen, drowsiness,
          yawnLevel: yawnPct, grimace: g.score,
          confidence, rmssd: hrvMetrics?.rmssd,
        });
        if (hasSignal) {
          apiSaveMetrics(sessId, {
            heartRate: hr, oxygen, drowsiness, arousal: hrvMetrics?.arousal,
            rmssd: hrvMetrics?.rmssd, sdnn: hrvMetrics?.sdnn, lfhf: hrvMetrics?.lfhf,
            blinkRate, yawnLevel: yawnPct, brightness, confidence
          });
        }

        // ─── 6. Alerts ───
        const triggers = [];
        // Les alertes cardiaques et SpO2 exigent un signal exploitable :
        // sans cette garde, le bruit rPPG déclenchait des alertes en continu.
        const hrOk = hr > 0 && confidence > 0.3 && hrHist.current.length >= 3;
        if (hrOk && hr > 110)        triggers.push({ type: "heartRate", severity: "high", label: tRef.current("alerts.lbl.elevatedHR") });
        if (hrOk && hr < 50)         triggers.push({ type: "heartRate", severity: "high", label: tRef.current("alerts.lbl.lowHR") });
        if (drowsiness > 60) triggers.push({ type: "fatigue",   severity: "high",     label: tRef.current("alerts.lbl.drowsy") });
        if (drowsiness > 80) triggers.push({ type: "fatigue",   severity: "critical", label: tRef.current("alerts.lbl.criticalDrowsy") });
        if (hrvMetrics?.arousal > 75) triggers.push({ type: "stress", severity: "high", label: tRef.current("alerts.lbl.arousal") });
        if (oxygen > 0 && oxygen < 92 && oxygenConf > 0.5)
          triggers.push({ type: "oxygen", severity: "critical", label: tRef.current("alerts.lbl.lowSpo2") });
        // Geste d'urgence : paume ouverte levée vers la caméra
        if (tMs - emergencyAt.current < EMERGENCY_SHOW_MS)
          triggers.push({ type: "emergency", severity: "critical", label: tRef.current("alerts.lbl.emergency") });
        // Grimace douloureuse maintenue
        if (g.active)
          triggers.push({ type: "grimace", severity: "high", label: tRef.current("alerts.lbl.grimace") });
        const contact = medData?.contact || "";
        const notify = {
          subscriberId: "carewatch-user",
          ...(contact.includes("@") ? { email: contact } : {}),
          ...(contact && !contact.includes("@") ? { telegram: contact } : {}),
        };
        // Anti-spam : 1 envoi Novu/Telegram maximum par type toutes les 15 s
        triggers.forEach((tr) => {
          const last = alertPostAt.current[tr.type] || 0;
          if (now - last < ALERT_POST_MS) return;
          alertPostAt.current[tr.type] = now;
          recordAlert(tr.type);
          apiSaveAlert(sessId, { type: tr.type, severity: tr.severity, message: tr.label }, notify);
        });
        setAlerts(triggers);
      }

      /* ─── Superposition du squelette (corps · mains · visage) ─── */
      const ov = overlayRef.current;
      if (ov) {
        const CW = ov.clientWidth, CH = ov.clientHeight;
        if (CW > 0 && CH > 0) {
          if (ov.width !== CW) ov.width = CW;
          if (ov.height !== CH) ov.height = CH;
          const octx = ov.getContext("2d");
          const vw = v.videoWidth || 640, vh = v.videoHeight || 480;
          // Même recadrage object-fit:cover que la balise <video>
          const sc = Math.max(CW / vw, CH / vh);
          const ox = (CW - vw * sc) / 2, oy = (CH - vh * sc) / 2;
          const map = (lm) => ({ x: ox + lm.x * vw * sc, y: oy + lm.y * vh * sc });
          const fresh = (b) => (b && tMs - b.at < 800 ? b.lm : null);
          drawOverlay(octx, {
            W: CW, H: CH, map,
            face: landmarks,
            pose: fresh(poseBuf),
            hands: fresh(handsBuf),
            grimaceScore: g.score,
            palm: palmHold.current > 0,
            palmCenter: palmC.current,
            emergency: tMs - emergencyAt.current < EMERGENCY_SHOW_MS,
            tMs,
          });
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, sessId, faceReady, bodyReady, backendOk]);

  /* ─── History buffer ─── */
  useEffect(() => {
    setHistory((h) => {
      const push = (arr, v) => { const next = [...arr, v]; if (next.length > HIST_LEN) next.shift(); return next; };
      return {
        heartRate:  push(h.heartRate,  metrics.heartRate),
        arousal:    push(h.arousal,    metrics.arousal),
        drowsiness: push(h.drowsiness, metrics.drowsiness),
        oxygen:     push(h.oxygen,     metrics.oxygen),
        grimace:    push(h.grimace,    metrics.grimace),
      };
    });
  }, [metrics.heartRate, metrics.arousal, metrics.drowsiness, metrics.oxygen, metrics.grimace]);

  const sessClock = () => {
    const s = sessSecs.current;
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  /* ─── Composite Vitality Score (defensible composition) ─── */
  const score = useMemo(() => {
    const arousalPen = metrics.arousal * 0.4;
    const drowsyPen = metrics.drowsiness * 0.3;
    let base = 100 - arousalPen - drowsyPen;
    if (metrics.heartRate > 100) base -= (metrics.heartRate - 100) * 0.5;
    if (metrics.oxygen > 0 && metrics.oxygen < 95) base -= (95 - metrics.oxygen) * 1.5;
    return Math.round(clamp(base, 0, 100));
  }, [metrics]);

  const scoreLabel = score >= 80 ? t("score.excellent") : score >= 65 ? t("score.good") : score >= 45 ? t("score.moderate") : score >= 25 ? t("score.low") : t("score.critical");
  const scoreColor = score >= 65 ? "var(--accent)" : score >= 45 ? "var(--warn)" : "var(--danger)";

  const statusLabel = !running ? t("dash.idle") : alerts.some((a) => a.severity === "critical") ? t("dash.critical") : alerts.length ? t("dash.watch") : t("dash.normal");
  const statusColor = !running ? "var(--fg-dim)" : alerts.some((a) => a.severity === "critical") ? "var(--danger)" : alerts.length ? "var(--warn)" : "var(--accent)";

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg-0)" }}>
      <Sidebar active={active} onNav={setActive} profile={medData} onReset={onReset} alerts={alerts.length}/>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="cw-head" style={{ padding: "14px 28px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{t("dash.live")}</h2>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-dim)", letterSpacing: "0.04em", marginTop: 2 }}>
              {clock.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
              {clock.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
            </span>
          </div>
          <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {/* Switchers thème + langue — affichés uniquement sur mobile (sidebar masquée) */}
            <div className="cw-mob-switch" style={{ display: "none", gap: 6 }}>
              <button onClick={toggleTheme} title={t(theme === "dark" ? "theme.light" : "theme.dark")} className="mono" style={{
                border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--fg-mute)",
                borderRadius: "var(--r-sm)", padding: "5px 9px", fontSize: 11, cursor: "pointer"
              }}>{theme === "dark" ? <IconSun size={13}/> : <IconMoon size={13}/>}</button>
              <button onClick={cycleLang} title="FR / EN / AR" className="mono" style={{
                border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--fg-mute)",
                borderRadius: "var(--r-sm)", padding: "5px 9px", fontSize: 11, cursor: "pointer"
              }}>{lang.toUpperCase()}</button>
            </div>
            {bodyReady && running && (
              <span className="mono" style={{ fontSize: 10, color: "var(--accent-2)", padding: "5px 10px", borderRadius: 999, background: "var(--bg-1)", border: "1px solid var(--line)", letterSpacing: "0.08em" }}>
                {t("dash.poseReady")}
              </span>
            )}
            {faceReady && (
              <span className="mono" style={{ fontSize: 10, color: "var(--accent)", padding: "5px 10px", borderRadius: 999, background: "var(--bg-1)", border: "1px solid var(--line)", letterSpacing: "0.08em" }}>
                {t("dash.faceReady")}
              </span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, background: "var(--bg-1)", border: "1px solid var(--line)", fontSize: 11.5, color: statusColor }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, animation: running ? "cw-pulse 1.5s infinite" : "none" }}/>
              {statusLabel}
            </span>
            <span className="mono tabular" style={{ fontSize: 11.5, color: "var(--fg-mute)", padding: "5px 10px", borderRadius: 999, background: "var(--bg-1)", border: "1px solid var(--line)" }}>
              {sessClock()}
            </span>
            <button onClick={running ? stopSession : startSession} style={{
              padding: "7px 14px", borderRadius: "var(--r-sm)",
              border: "1px solid " + (running ? "var(--line-hi)" : "var(--accent-line)"),
              background: running ? "var(--bg-2)" : "var(--accent)",
              color: running ? "var(--fg)" : "#ffffff",
              fontSize: 12.5, fontWeight: 500, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6
            }}>
              {running ? <><IconStop size={11}/> {t("dash.stop")}</> : <><IconPlay size={11}/> {t("dash.start")}</>}
            </button>
          </div>
        </header>

        <Disclaimer/>

        <div className="cw-content" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
          {/* Hero */}
          <section id="cw-overview" className="cw-grid-hero" style={{ display: "grid", gridTemplateColumns: "minmax(0, 380px) 1fr", gap: 20 }}>
            <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 20, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 80% at 50% 100%, ${scoreColor}1F, transparent 70%)`, pointerEvents: "none" }}/>
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--fg-mute)" }}>{t("dash.vitality")}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.1em" }}>{t("dash.composite")}</span>
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, marginTop: 12 }}>
                <div style={{ position: "relative" }}>
                  <VitalityRing score={score} size={140}/>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span className="mono tabular" style={{ fontSize: 38, fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.03em", lineHeight: 1 }}>{score}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: scoreColor, marginTop: 4, letterSpacing: "0.06em" }}>{scoreLabel.toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: t("bar.stress"),      v: metrics.arousal },
                    { label: t("bar.fatigue"),     v: metrics.drowsiness },
                    { label: t("bar.anxiety"),     v: selfReport?.anxious ? selfReport.anxious * 10 : 0, ghost: !selfReport },
                    { label: t("bar.confidence"),  v: metrics.confidence }
                  ].map((b) => {
                    const col = b.ghost ? "var(--fg-faint)" : b.v >= 70 ? "var(--danger)" : b.v >= 50 ? "var(--warn)" : "var(--accent)";
                    return (
                      <div key={b.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 3 }}>
                          <span style={{ color: "var(--fg-mute)" }}>{b.label}{b.ghost ? t("bar.none") : ""}</span>
                          <span className="mono tabular" style={{ color: b.ghost ? "var(--fg-dim)" : "var(--fg)" }}>{b.ghost ? "—" : Math.round(b.v)}</span>
                        </div>
                        <div style={{ height: 3, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: (b.ghost ? 0 : b.v) + "%", height: "100%", background: col, transition: "width .4s, background .3s" }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: "16px 20px 12px", display: "flex", flexDirection: "column", gap: 6, minHeight: 184 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--fg-mute)" }}><IconHeart size={14}/></span>
                  <span style={{ fontSize: 12, color: "var(--fg-mute)" }}>{t("hr.title")}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="mono tabular" style={{ fontSize: 28, fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {Math.round(metrics.heartRate) || "--"}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg-dim)" }}>bpm</span>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 100 }}>
                {running && metrics.heartRate > 0 ? (
                  <Waveform hr={metrics.heartRate} color="var(--accent)" height={130}/>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--fg-dim)", fontSize: 12 }}>
                    <span className="mono" style={{ letterSpacing: "0.1em" }}>
                      {running ? t("hr.acquiring") : t("hr.waiting")}
                    </span>
                  </div>
                )}
              </div>
              <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--fg-faint)", letterSpacing: "0.1em" }}>
                <span>HRV RMSSD {metrics.rmssd || "--"} ms</span>
                <span>SDNN {metrics.sdnn || "--"} ms</span>
                <span>CONF {metrics.confidence}%</span>
              </div>
            </div>
          </section>

          {/* Metrics */}
          <section className="cw-grid-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <MetricCard Icon={IconFlame}    label={t("mc.stress")}   value={metrics.arousal}    unit="%"   history={history.arousal}    warn={50} danger={70}/>
            <MetricCard Icon={IconSparkle}  label={t("mc.fatigue")}  value={metrics.drowsiness} unit="%"   history={history.drowsiness} warn={40} danger={65}/>
            <MetricCard Icon={IconHeart}    label={t("mc.hr")}       value={Math.round(metrics.heartRate)} unit="bpm" history={history.heartRate} max={140} warn={95} danger={110}/>
            <MetricCard Icon={IconLung}     label={t("mc.spo2")}     value={metrics.oxygen}     unit="%"   history={history.oxygen}    warn={95} danger={92} inverse/>
            <MetricCard Icon={IconBrain}    label={t("mc.blink")}    value={metrics.blinkRate}  unit="/min" history={[]} max={40} warn={25} danger={35}/>
            <MetricCard Icon={IconShield}   label={t("mc.yawn")}     value={metrics.yawnLevel}  unit="%"   history={[]} warn={50} danger={75}/>
            <MetricCard Icon={IconAlert}    label={t("mc.grimace")}  value={metrics.grimace}    unit="%"   history={history.grimace} warn={50} danger={75}/>
          </section>

          {/* Self-report row */}
          <section style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 16px",
            background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-md)"
          }}>
            <span style={{ color: "var(--fg-mute)" }}><IconBrain size={16}/></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{t("sr.ask")}</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-mute)", marginTop: 2 }}>
                {selfReport
                  ? t("sr.sum", { s: selfReport.stressed, a: selfReport.anxious, t: selfReport.tired })
                  : t("sr.hint")}
              </div>
            </div>
            <button onClick={() => setSelfReportOpen(true)} style={{
              padding: "7px 14px", borderRadius: "var(--r-sm)",
              border: "1px solid var(--line-hi)", background: "var(--bg-2)",
              color: "var(--fg)", fontSize: 12.5, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6
            }}>
              {selfReport ? <><IconCheck size={11} stroke={2.5}/> {t("sr.recheck")}</> : t("sr.checkIn")}
            </button>
          </section>

          {/* Session strip */}
          <StatStrip stats={[
            { label: t("strip.session"),    value: sessId ? sessId.slice(0, 12) : "—" },
            { label: t("strip.faceMesh"),   value: faceReady ? t("strip.tracking") : t("strip.loading"), color: faceReady ? "var(--accent)" : "var(--warn)" },
            { label: t("strip.body"),       value: bodyReady ? t("strip.bodyOn") : t("strip.loading"), color: bodyReady ? "var(--accent-2)" : "var(--warn)" },
            { label: t("strip.brightness"), value: metrics.brightness + " lx" },
            { label: t("strip.rmssd"),      value: metrics.rmssd ? metrics.rmssd + " ms" : "—" },
            { label: t("strip.backend"),    value: backendOk ? t("strip.connected") : t("strip.offline"), color: backendOk ? "var(--accent)" : "var(--danger)" }
          ]}/>

          <section className="cw-grid-bottom" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14 }}>
            <CameraCard
              running={running} onStart={startSession} onStop={stopSession}
              videoRef={videoRef} canvasRef={canvasRef} overlayRef={overlayRef}
              backendOk={backendOk} bodyReady={bodyReady} gesture={gesture} emergency={emergency}
            />
            <div id="cw-alerts" style={{ minWidth: 0 }}><AlertsCard alerts={alerts}/></div>
            <div id="cw-meds" style={{ minWidth: 0 }}><MedPanel medData={medData} onUpdate={onMedUpdate}/></div>
            <div id="cw-settings" style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <CameraSettings running={running} />
              <NotifyCard contact={medData?.contact}/>
            </div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            <MonthlyReport patient={medData?.contact || ""} />
          </section>
        </div>
      </main>

      {selfReportOpen && (
        <SelfReport
          onClose={() => setSelfReportOpen(false)}
          onSubmit={(v) => {
            setSelfReport(v);
            if (sessId) saveSelfReport(sessId, v);
            setSelfReportOpen(false);
          }}
        />
      )}
    </div>
  );
}

function StatStrip({ stats }) {
  return (
    <div className="cw-grid-strip" style={{
      display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 1,
      background: "var(--line)", border: "1px solid var(--line)",
      borderRadius: "var(--r-md)", overflow: "hidden"
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{ background: "var(--bg-1)", padding: "10px 14px" }}>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--fg-dim)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
          <div className="mono tabular" style={{ fontSize: 13, color: s.color || "var(--fg)", fontWeight: 500, marginTop: 4 }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}
