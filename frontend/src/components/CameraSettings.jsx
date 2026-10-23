// src/components/CameraSettings.jsx
// Choix de la source vidéo. Indispensable pour utiliser une caméra
// virtuelle (iVCam) alimentée par un téléphone.

import { useEffect, useState } from "react";
import { useT } from "../i18n.jsx";
import { IconCamera } from "./Icons";
import {
  getSavedCameraId, setSavedCameraId, listCameras,
  requestCameraPermission, isVirtualCamera,
} from "../lib/camera";

export default function CameraSettings({ running = false }) {
  const { t } = useT();
  const [saved, setSaved] = useState(() => getSavedCameraId());
  const [devices, setDevices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const refresh = async () => {
    const list = await listCameras();
    setDevices(list);
    return list;
  };

  useEffect(() => {
    refresh();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return undefined;
    const onChange = () => refresh();
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, []);

  const detect = async () => {
    setBusy(true);
    const ok = await requestCameraPermission();
    setDenied(!ok);
    await refresh();
    setBusy(false);
  };

  const choose = (id) => {
    setSavedCameraId(id);
    setSaved(id);
  };

  const known = devices.some((d) => d.id === saved);
  const current = devices.find((d) => d.id === saved);
  const virtuals = devices.filter((d) => isVirtualCamera(d.label));

  const box = {
    background: "var(--bg-1)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
  const input = {
    padding: "7px 10px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--line)",
    background: "var(--bg-2)",
    color: "var(--fg)",
    fontSize: 12,
    fontFamily: "inherit",
    maxWidth: "100%",
  };
  const btn = {
    padding: "7px 12px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--line-hi)",
    background: "var(--bg-2)",
    color: "var(--fg)",
    fontSize: 12,
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--accent)" }}><IconCamera size={15} /></span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("set.camTitle")}</span>
        <span className="mono" style={{ marginInlineStart: "auto", fontSize: 9.5, letterSpacing: "0.08em", color: "var(--fg-dim)" }}>
          SOURCE
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.5 }}>
        {t("set.camSub")}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={known ? saved : ""}
          onChange={(e) => choose(e.target.value)}
          style={{ ...input, flex: "1 1 220px" }}
          aria-label={t("set.camTitle")}
        >
          <option value="">{t("set.camDefault")}</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
          {saved && !known && (
            <option value="" disabled>{t("set.camMissing")}</option>
          )}
        </select>
        <button type="button" onClick={detect} disabled={busy} style={btn}>
          {busy ? t("set.camScanning") : t("set.camDetect")}
        </button>
      </div>

      {current && (
        <div style={{ fontSize: 11.5, color: "var(--fg-mute)" }}>
          {t("set.camSelected")} <strong style={{ color: "var(--fg)" }}>{current.label}</strong>
          {isVirtualCamera(current.label) ? ` · ${t("set.camVirtual")}` : ""}
        </div>
      )}

      {virtuals.length > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--accent)" }}>
          {t("set.camVirtualFound")} {virtuals.map((d) => d.label).join(", ")}
        </div>
      )}

      {denied && (
        <div style={{ fontSize: 11.5, color: "var(--warn)" }}>{t("set.camDenied")}</div>
      )}

      {devices.length === 0 && !denied && (
        <div style={{ fontSize: 11.5, color: "var(--warn)" }}>{t("set.camNone")}</div>
      )}

      <div style={{ fontSize: 11, color: "var(--fg-faint)", lineHeight: 1.55 }}>
        {t("set.camSteps")}{" "}
        <a href="https://www.e2esoft.com/ivcam/" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
          e2esoft.com/ivcam
        </a>
      </div>

      <div className="mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", letterSpacing: "0.04em" }}>
        {running ? t("set.camRunning") : t("set.camHint")}
      </div>
    </div>
  );
}
