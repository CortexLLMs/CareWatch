// src/components/AlertsCard.jsx
import { IconAlert, IconCheck } from "./Icons";
import { useT } from "../i18n.jsx";

const REC = {
  stress: "rec.stress",
  fatigue: "rec.fatigue",
  anxiety: "rec.anxiety",
  burnout: "rec.burnout",
  oxygen: "rec.oxygen",
  heartRate: "rec.heartRate",
  emergency: "rec.emergency",
  grimace: "rec.grimace",
};

export default function AlertsCard({ alerts }) {
  const { t } = useT();
  return (
    <div style={{
      background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
      overflow: "hidden", display: "flex", flexDirection: "column"
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--fg-mute)" }}><IconAlert size={14}/></span>
        <span style={{ fontSize: 12, color: "var(--fg)" }}>{t("alerts.title")}</span>
        <span className="mono tabular" style={{ marginInlineStart: "auto", fontSize: 11, color: alerts.length ? "var(--warn)" : "var(--fg-dim)" }}>
          {String(alerts.length).padStart(2, "0")}
        </span>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
        {alerts.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--fg-dim)", padding: "20px 0", gap: 8 }}>
            <span style={{ color: "var(--accent)", opacity: 0.6 }}><IconCheck size={20}/></span>
            <span style={{ fontSize: 12, textAlign: "center" }}>{t("alerts.ok")}</span>
          </div>
        ) : (
          alerts.map((a, i) => {
            const col = a.severity === "critical" ? "var(--danger)" : "var(--warn)";
            const colSoft = a.severity === "critical" ? "var(--danger-soft)" : "var(--warn-soft)";
            return (
              <div key={i} className="fade-in" style={{
                padding: "10px 12px", borderRadius: "var(--r-md)",
                background: colSoft, border: "1px solid " + col + "33",
                display: "flex", gap: 10
              }}>
                <span style={{ color: col, marginTop: 2 }}><IconAlert size={14}/></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--fg)", fontWeight: 500 }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-mute)", marginTop: 3 }}>{REC[a.type] ? t(REC[a.type]) : t("alerts.continue")}</div>
                </div>
                <span className="mono" style={{ fontSize: 9, color: col, letterSpacing: "0.1em", flexShrink: 0 }}>
                  {t("alerts.sev." + a.severity)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
