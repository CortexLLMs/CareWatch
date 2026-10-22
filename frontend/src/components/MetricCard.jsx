// src/components/MetricCard.jsx
import Sparkline from "./Sparkline";
import { useT } from "../i18n.jsx";

export default function MetricCard({ Icon, label, value, unit, history, max = 100, warn, danger, inverse = false }) {
  const { t } = useT();
  const status = inverse
    ? (value <= danger ? "danger" : value <= warn ? "warn" : "ok")
    : (value >= danger ? "danger" : value >= warn ? "warn" : "ok");
  const color = status === "danger" ? "var(--danger)" : status === "warn" ? "var(--warn)" : "var(--accent)";
  const statusLabel = status === "danger" ? t("mc.elevated") : status === "warn" ? t("mc.watch") : t("mc.normal");
  return (
    <div style={{
      background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
      padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 12,
      position: "relative", overflow: "hidden"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-mute)" }}>
          <Icon size={14}/>
          <span style={{ fontSize: 12 }}>{label}</span>
        </div>
        <span className="mono" style={{ fontSize: 9, letterSpacing: "0.12em", color, opacity: 0.8 }}>
          ● {statusLabel}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span className="mono tabular" style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--fg)", lineHeight: 1 }}>
            {value}
          </span>
          <span className="mono" style={{ fontSize: 12, color: "var(--fg-dim)" }}>{unit}</span>
        </div>
        <Sparkline data={history} color={color} width={80} height={28}/>
      </div>
      <div style={{ height: 2, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: Math.min(100, (value / max) * 100) + "%", height: "100%", background: color, transition: "width .4s, background .3s" }}/>
      </div>
    </div>
  );
}
