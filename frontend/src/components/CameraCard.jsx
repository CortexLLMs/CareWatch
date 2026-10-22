// src/components/CameraCard.jsx
import { IconCamera, IconPlay, IconStop } from "./Icons";
import { useT } from "../i18n.jsx";

export default function CameraCard({ running, onStart, onStop, videoRef, canvasRef, backendOk }) {
  const { t } = useT();
  return (
    <div style={{
      background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
      overflow: "hidden", display: "flex", flexDirection: "column"
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--fg-mute)" }}><IconCamera size={14}/></span>
        <span style={{ fontSize: 12, color: "var(--fg)" }}>{t("cam.title")}</span>
        {running && (
          <span className="mono" style={{ marginInlineStart: "auto", fontSize: 10, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--danger)", animation: "cw-pulse 1s infinite" }}/>
            {t("cam.live")}
          </span>
        )}
      </div>
      <div style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--bg-3)" }}>
        {!running && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--fg-mute)" }}>
            <span style={{
              width: 52, height: 52, borderRadius: "50%", border: "1px solid var(--line-hi)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-mute)"
            }}>
              <IconCamera size={22}/>
            </span>
            <span style={{ fontSize: 13 }}>{t("cam.off")}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("cam.permission")}</span>
          </div>
        )}
        <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: running ? "block" : "none" }}/>
        <canvas ref={canvasRef} style={{ display: "none" }}/>
        {running && (
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, bottom: 12, pointerEvents: "none" }}>
            {[{ t: 0, l: 0 }, { t: 0, r: 0 }, { b: 0, l: 0 }, { b: 0, r: 0 }].map((p, i) => (
              <div key={i} style={{
                position: "absolute", width: 14, height: 14,
                ...(p.t === 0 ? { top: 0, borderTop: "1.5px solid var(--accent)" } : { bottom: 0, borderBottom: "1.5px solid var(--accent)" }),
                ...(p.l === 0 ? { left: 0, borderLeft: "1.5px solid var(--accent)" } : { right: 0, borderRight: "1.5px solid var(--accent)" })
              }}/>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--line)" }}>
        <button onClick={running ? onStop : onStart} style={{
          padding: "7px 12px", borderRadius: "var(--r-sm)",
          border: "1px solid " + (running ? "var(--line-hi)" : "var(--accent-line)"),
          background: running ? "var(--bg-2)" : "var(--accent-soft)",
          color: running ? "var(--fg)" : "var(--accent)",
          fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500
        }}>
          {running ? <IconStop size={11}/> : <IconPlay size={11}/>}
          {running ? t("cam.stop") : t("cam.start")}
        </button>
        <span className="mono" style={{ marginInlineStart: "auto", fontSize: 10, color: backendOk ? "var(--accent)" : "var(--fg-dim)" }}>
          {backendOk ? t("cam.backendOk") : t("cam.offline")} · {running ? t("cam.acquiring") : t("cam.idle")}
        </span>
      </div>
    </div>
  );
}
