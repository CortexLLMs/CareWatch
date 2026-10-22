// src/components/SelfReport.jsx
// Subjective self-report — captures user-reported anxiety/mood, which CAN'T
// be reliably inferred from a webcam. Stored alongside the session.

import { useState } from "react";
import { IconBrain, IconClose, IconCheck } from "./Icons";
import { useT } from "../i18n.jsx";

const QUESTIONS = [
  { key: "stressed", lk: "srModal.q1", lo: "srModal.q1lo", hi: "srModal.q1hi" },
  { key: "anxious",  lk: "srModal.q2", lo: "srModal.q2lo", hi: "srModal.q2hi" },
  { key: "tired",    lk: "srModal.q3", lo: "srModal.q3lo", hi: "srModal.q3hi" },
];

export default function SelfReport({ onSubmit, onClose }) {
  const { t } = useT();
  const [vals, setVals] = useState({ stressed: 5, anxious: 5, tired: 5 });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(8, 8, 10, 0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)", overflow: "hidden"
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--accent)" }}><IconBrain size={16}/></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("srModal.title")}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.08em" }}>{t("srModal.ten")}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--fg-dim)", cursor: "pointer", padding: 4 }}>
            <IconClose size={14}/>
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-mute)", lineHeight: 1.5 }}>
            {t("srModal.intro")}
          </p>
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <div style={{ fontSize: 13, color: "var(--fg)", marginBottom: 8 }}>{t(q.lk)}</div>
              <input
                type="range" min="0" max="10" value={vals[q.key]}
                onChange={(e) => setVals((v) => ({ ...v, [q.key]: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
              <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--fg-dim)", marginTop: 4 }}>
                <span>0 · {t(q.lo)}</span>
                <span className="tabular">{vals[q.key]}</span>
                <span>{t(q.hi)} · 10</span>
              </div>
            </div>
          ))}
          <button onClick={() => onSubmit(vals)} style={{
            padding: "10px 14px", borderRadius: "var(--r-sm)",
            background: "var(--accent)", color: "#ffffff",
            border: "1px solid var(--accent-line)", fontWeight: 600, fontSize: 13,
            cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6
          }}>
            <IconCheck size={13} stroke={2.5}/> {t("srModal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
