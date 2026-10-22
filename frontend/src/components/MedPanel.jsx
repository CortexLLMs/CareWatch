// src/components/MedPanel.jsx
import { useState, useEffect } from "react";
import { IconPill, IconEdit, IconClose, IconCheck, IconMail } from "./Icons";
import { saveLocal } from "../lib/storage";
import { parseTimes } from "../lib/parse";
import { mail } from "../lib/api";
import { useT } from "../i18n.jsx";

export default function MedPanel({ medData, onUpdate }) {
  const { t } = useT();
  const [edit, setEdit] = useState(false);
  const [n, setN] = useState(medData.medNames.join(", "));
  const [times, setTimes] = useState(medData.medTimes.join(", "));
  const [e, setE] = useState(medData.contact);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const has = medData.medNames.length > 0;

  useEffect(() => {
    setN(medData.medNames.join(", "));
    setTimes(medData.medTimes.join(", "));
    setE(medData.contact);
  }, [medData]);

  const inp = {
    background: "var(--bg-2)", border: "1px solid var(--line)",
    borderRadius: "var(--r-sm)", padding: "8px 12px",
    color: "var(--fg)", fontSize: 13, outline: "none", width: "100%"
  };

  function doSave() {
    const d = {
      medNames: n.split(",").map((s) => s.trim()).filter(Boolean),
      medTimes: parseTimes(times).length ? parseTimes(times) : medData.medTimes,
      contact: e || medData.contact
    };
    saveLocal(d); onUpdate(d); setEdit(false); setSent(false);
  }

  async function doMail() {
    setSending(true);
    const ok = await mail(medData.contact, medData.medNames, medData.medTimes);
    setSending(false);
    if (ok) {
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    }
  }

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--fg-mute)" }}><IconPill size={14}/></span>
        <span style={{ fontSize: 12, color: "var(--fg)" }}>{t("med.title")}</span>
        <span className="mono" style={{ marginInlineStart: "auto", fontSize: 10, color: "var(--fg-dim)" }}>
          {has ? t("med.count", { n: medData.medNames.length }) : t("med.none")}
        </span>
        <button onClick={() => setEdit(!edit)} style={{
          padding: "4px 10px", borderRadius: "var(--r-sm)",
          border: "1px solid var(--line-hi)", background: "var(--bg-2)",
          color: "var(--fg-mute)", fontSize: 11, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5
        }}>
          {edit ? <IconClose size={11}/> : <IconEdit size={11}/>}
          {edit ? t("med.cancel") : t("med.edit")}
        </button>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {edit ? (
          <>
            <div>
              <label className="mono" style={{ fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.1em" }}>{t("med.labelMeds")}</label>
              <input value={n} onChange={(x) => setN(x.target.value)} placeholder={t("med.phMeds")} style={{ ...inp, marginTop: 6 }}/>
            </div>
            <div>
              <label className="mono" style={{ fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.1em" }}>{t("med.labelTimes")}</label>
              <input value={times} onChange={(x) => setTimes(x.target.value)} placeholder="08:00, 14:00, 20:00" style={{ ...inp, marginTop: 6 }}/>
            </div>
            <div>
              <label className="mono" style={{ fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.1em" }}>{t("med.labelEmail")}</label>
              <input value={e} onChange={(x) => setE(x.target.value)} placeholder="you@email.com" style={{ ...inp, marginTop: 6 }}/>
            </div>
            <button onClick={doSave} style={{
              marginTop: 4, padding: "9px 12px", borderRadius: "var(--r-sm)",
              border: "1px solid var(--accent-line)", background: "var(--accent)",
              color: "#ffffff", fontWeight: 600, fontSize: 12, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6
            }}>
              <IconCheck size={12} stroke={2.5}/> {t("med.save")}
            </button>
          </>
        ) : has ? (
          <>
            {medData.medNames.map((m, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", background: "var(--bg-2)",
                border: "1px solid var(--line)", borderRadius: "var(--r-md)"
              }}>
                <span style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", background: "var(--bg-3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                  <IconPill size={14}/>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{m}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-dim)", marginTop: 2, letterSpacing: "0.04em" }}>
                    {medData.medTimes.join(" · ") || "—"}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.1em" }}>{t("med.active")}</span>
              </div>
            ))}
            <button onClick={doMail} disabled={sending || sent} style={{
              marginTop: 4, padding: "9px 12px", borderRadius: "var(--r-sm)",
              border: "1px solid var(--line-hi)", background: sent ? "var(--accent-soft)" : "var(--bg-2)",
              color: sent ? "var(--accent)" : "var(--fg)", fontSize: 12, cursor: sending ? "default" : "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 500
            }}>
              {sending ? (
                <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid var(--line-hi)", borderTopColor: "var(--fg)", display: "inline-block", animation: "cw-spin 0.8s linear infinite" }}/>
              ) : sent ? (
                <IconCheck size={12} stroke={2.5}/>
              ) : (
                <IconMail size={12}/>
              )}
              {sending ? t("med.sending") : sent ? t("med.sent") : t("med.sendTest")}
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 6, color: "var(--fg-dim)" }}>
            <span style={{ opacity: 0.6 }}><IconPill size={20}/></span>
            <span style={{ fontSize: 12 }}>{t("med.empty")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
