// src/components/Disclaimer.jsx
// Medical disclaimer banner — appears at the top of the dashboard.

import { useState } from "react";
import { IconShield, IconClose } from "./Icons";
import { useT } from "../i18n.jsx";

export default function Disclaimer() {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div style={{
      margin: "0 28px 0 28px", marginTop: 16,
      padding: "10px 14px",
      background: "var(--warn-soft)",
      border: "1px solid color-mix(in oklab, var(--warn) 30%, transparent)",
      borderRadius: "var(--r-md)",
      display: "flex", alignItems: "center", gap: 10,
      fontSize: 11.5, color: "var(--fg)"
    }}>
      <span style={{ color: "var(--warn)", flexShrink: 0 }}><IconShield size={14}/></span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>
        <b style={{ fontWeight: 600 }}>{t("dis.title")}</b>{" "}
        <span style={{ color: "var(--fg-mute)" }}>
          {t("dis.text")}
        </span>
      </span>
      <button onClick={() => setOpen(false)} style={{
        background: "transparent", border: "none", color: "var(--fg-dim)",
        cursor: "pointer", padding: 4, display: "inline-flex"
      }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-dim)")}
      >
        <IconClose size={12}/>
      </button>
    </div>
  );
}
