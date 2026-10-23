// src/lib/camera.js
// Sélection de la source vidéo. Permet de choisir une caméra précise
// (webcam intégrée, caméra USB, ou caméra virtuelle iVCam alimentée par
// un téléphone). Le choix est mémorisé localement.

const KEY = "carewatch_camera_id";

export function getSavedCameraId() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setSavedCameraId(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : le choix reste valable pour la session en cours.
  }
}

/** Demande l'autorisation caméra, puis la relâche immédiatement. */
export async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

/** Liste les entrées vidéo. Les libellés exigent une autorisation préalable. */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({
        id: d.deviceId,
        label: d.label || `Caméra ${i + 1}`,
      }));
  } catch {
    return [];
  }
}

/** Reconnaît les caméras virtuelles courantes (iVCam, OBS, DroidCam, Iriun). */
export function isVirtualCamera(label = "") {
  return /ivcam|e2esoft|virtual|obs|droidcam|iriun/i.test(label);
}

/** Contraintes getUserMedia : caméra mémorisée, sinon caméra frontale. */
export function cameraConstraints() {
  const id = getSavedCameraId();
  const base = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30 },
  };
  return id ? { ...base, deviceId: { exact: id } } : { ...base, facingMode: "user" };
}

/** Contraintes de repli lorsque la caméra mémorisée a disparu. */
export function fallbackConstraints() {
  return {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: "user",
    frameRate: { ideal: 30 },
  };
}
