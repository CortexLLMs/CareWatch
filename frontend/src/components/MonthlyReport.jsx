// src/components/MonthlyReport.jsx
// Carte de génération du rapport mensuel (PDF), à partir de l'historique
// local agrégé. Aucun envoi réseau : le fichier est produit dans le navigateur.

import { useState } from "react";
import { useT } from "../i18n.jsx";
import { getMonth } from "../lib/history";
import { IconPulse } from "./Icons";

export default function MonthlyReport({ patient = "" }) {
  const { t } = useT();
  const now = new Date();
  const [value, setValue] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [year, month] = value.split("-").map(Number);
  const data = getMonth(year, (month || 1) - 1);

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { generateMonthlyReport } = await import("../lib/reportPdf");
      await generateMonthlyReport({ year, month: (month || 1) - 1, patient, source: "local" });
    } catch (e) {
      console.error("Rapport PDF", e);
      setError(t("rep.error"));
    } finally {
      setBusy(false);
    }
  };

  const btnStyle = {
    padding: "8px 14px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--accent-line)",
    background: "var(--accent)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 500,
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.6 : 1,
  };

  const inputStyle = {
    padding: "7px 10px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--line)",
    background: "var(--bg-2)",
    color: "var(--fg)",
    fontSize: 12,
    fontFamily: "inherit",
  };

  return (
    <div
      id="cw-sessions"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--accent)" }}><IconPulse size={15} /></span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("rep.title")}</span>
        <span className="mono" style={{ marginInlineStart: "auto", fontSize: 9.5, letterSpacing: "0.08em", color: "var(--fg-dim)" }}>
          PDF
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.5 }}>
        {t("rep.sub")}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label className="mono" style={{ fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.06em" }}>
          {t("rep.month").toUpperCase()}
        </label>
        <input
          type="month"
          value={value}
          max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`}
          onChange={(e) => setValue(e.target.value)}
          style={inputStyle}
        />
        <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)" }}>
          {data.activeDays} {t("rep.days")} · {data.alertTotal} {t("rep.alerts")} · {data.samples} pts
        </span>
        <button onClick={download} disabled={busy} style={{ ...btnStyle, marginInlineStart: "auto" }}>
          {busy ? t("rep.generating") : t("rep.download")}
        </button>
      </div>

      {data.activeDays === 0 && (
        <div style={{ fontSize: 11.5, color: "var(--warn)" }}>{t("rep.empty")}</div>
      )}
      {error && <div style={{ fontSize: 11.5, color: "var(--danger)" }}>{error}</div>}

      <div className="mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", letterSpacing: "0.04em" }}>
        {t("rep.note")}
      </div>
    </div>
  );
}
