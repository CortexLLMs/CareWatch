// src/components/NotifyCard.jsx
// État des notifications Novu + Telegram et test d'envoi.
import { useEffect, useState } from "react";
import { novuStatus, novuTest } from "../lib/api";
import { IconSend, IconCheck, IconAlert } from "./Icons";
import { useT } from "../i18n.jsx";

export default function NotifyCard({ contact }) {
  const { t } = useT();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  useEffect(() => {
    let alive = true;
    novuStatus().then((s) => alive && setSt(s));
    return () => { alive = false; };
  }, []);

  const isEmail = typeof contact === "string" && contact.includes("@");

  const test = async () => {
    setBusy(true); setRes(null);
    const to = isEmail
      ? { subscriberId: "carewatch-user", email: contact }
      : { subscriberId: "carewatch-user" };
    const r = await novuTest(to);
    setRes(r); setBusy(false);
    novuStatus().then(setSt);
  };

  const state = !st ? "loading" : st.mock ? "mock" : st.enabled ? (st.reachable ? "on" : "unreachable") : "off";
  const tone = { loading: "var(--fg-dim)", mock: "var(--accent)", on: "var(--ok)", unreachable: "var(--warn)", off: "var(--fg-dim)" }[state];
  const label = {
    loading: t("notify.checking"), mock: t("notify.mock"), on: t("notify.on"),
    unreachable: t("notify.unreachable"), off: t("notify.off"),
  }[state];
  const tgOn = Boolean(st?.telegram?.enabled);

  return (
    <div style={{
      background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)",
      overflow: "hidden", display: "flex", flexDirection: "column"
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--fg-mute)" }}><IconSend size={14} /></span>
        <span style={{ fontSize: 12, color: "var(--fg)" }}>{t("notify.title")}</span>
        <span className="mono" style={{ marginInlineStart: "auto", fontSize: 10, color: tone, letterSpacing: "0.08em" }}>
          {label.toUpperCase()}
        </span>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-dim)", lineHeight: 1.7 }}>
          <div>{t("notify.workflow")}&nbsp;: {st?.workflow || "alerte-carewatch"}</div>
          <div>{t("notify.api")}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {st?.apiUrl || "http://localhost:3100"}</div>
          <div>{t("notify.canal")}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {isEmail ? t("notify.canalEmail", { x: contact }) : t("notify.canalTg")}</div>
          <div style={{ color: tgOn ? "var(--ok)" : "var(--fg-dim)" }}>
            {t("notify.tgLabel")}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {tgOn ? t("notify.tgOn") : t("notify.tgOff")}
          </div>
        </div>

        <button onClick={test} disabled={busy || state === "off" || state === "loading"}
          style={{
            padding: "8px 10px", borderRadius: "var(--r-md)", cursor: busy ? "wait" : "pointer",
            border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--fg)",
            fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: state === "off" || state === "loading" ? 0.5 : 1,
          }}>
          {busy ? "…" : t("notify.testBtn")}
        </button>

        {res && (
          <div className="fade-in" style={{
            fontSize: 11, display: "flex", gap: 6, alignItems: "flex-start",
            color: res.ok ? "var(--ok)" : "var(--danger)",
            background: res.ok ? "var(--ok-soft)" : "var(--danger-soft)",
            border: `1px solid ${res.ok ? "var(--ok-line, rgba(15,157,99,0.3))" : "var(--danger)"}33`,
            borderRadius: "var(--r-md)", padding: "8px 10px",
          }}>
            {res.ok ? <IconCheck size={13} /> : <IconAlert size={13} />}
            <span>{res.ok ? (res.mock ? t("notify.okMock") : t("notify.okReal")) : (res.error || t("notify.ko"))}</span>
          </div>
        )}
      </div>
    </div>
  );
}
