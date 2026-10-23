// src/components/Sidebar.jsx
import {
  IconDashboard, IconPill, IconAlert, IconPulse, IconSettings, IconUser, IconReset,
  IconSun, IconMoon
} from "./Icons";
import { useT } from "../i18n.jsx";

const LOGO = `${import.meta.env.BASE_URL}logo-mark.png`;

const NAV = [
  { key: "overview", Icon: IconDashboard },
  { key: "meds", Icon: IconPill },
  { key: "alerts", Icon: IconAlert },
  { key: "sessions", Icon: IconPulse },
  { key: "settings", Icon: IconSettings },
];
const PAGE_KEY = { overview: "dash", meds: "meds", alerts: "alerts", sessions: "session", settings: "settings" };

export default function Sidebar({ active, onNav, profile, onReset, alerts }) {
  const { t, lang, cycleLang, theme, toggleTheme } = useT();

  const switchBtn = {
    border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--fg-mute)",
    borderRadius: "var(--r-sm)", padding: "5px 9px", fontSize: 10.5, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
    transition: "all .15s"
  };

  return (
    <aside className="cw-side" style={{
      width: 220, flexShrink: 0, borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column", background: "var(--bg-0)"
    }}>
      <div style={{ padding: "20px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
        <img src={LOGO} alt="" width={30} height={30} style={{ display: "block" }}/>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Care<span className="brand-grad">Watch</span></span>
          <span className="mono" style={{ fontSize: 10, color: "var(--fg-dim)" }}>{t("side.live")}</span>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--fg-faint)", padding: "8px 10px 4px" }}>{t("side.monitor")}</div>
        {NAV.map((n) => {
          const Ic = n.Icon;
          const page = PAGE_KEY[n.key];
          const on = active === page;
          const badge = page === "alerts" && alerts > 0 ? alerts : null;
          return (
            <button key={n.key} onClick={() => onNav(page)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: "var(--r-sm)",
              border: "none", background: on ? "var(--bg-2)" : "transparent",
              color: on ? "var(--fg)" : "var(--fg-mute)",
              fontSize: 13, cursor: "pointer", textAlign: "left",
              transition: "all .15s", position: "relative"
            }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--bg-1)"; e.currentTarget.style.color = "var(--fg)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = on ? "var(--fg)" : "var(--fg-mute)"; }}
            >
              <Ic size={15}/>
              <span>{t("nav." + n.key)}</span>
              {badge && (
                <span className="mono tabular" style={{ marginInlineStart: "auto", background: "var(--danger-soft)", color: "var(--danger)", fontSize: 10, padding: "1px 6px", borderRadius: 999, fontWeight: 600 }}>
                  {badge}
                </span>
              )}
              {on && <span style={{ position: "absolute", insetInlineStart: -10, top: 8, bottom: 8, width: 2, background: "var(--accent)", borderRadius: 2 }}/>}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 12, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={toggleTheme} title={theme === "dark" ? t("theme.light") : t("theme.dark")} style={switchBtn}>
            {theme === "dark" ? <IconSun size={13}/> : <IconMoon size={13}/>}
          </button>
          <button onClick={cycleLang} title="FR / EN / AR" className="mono" style={{ ...switchBtn, letterSpacing: "0.06em" }}>
            {lang.toUpperCase()}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--bg-1)", border: "1px solid var(--line)" }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--fg-mute)" }}>
            <IconUser size={14}/>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.contact || t("side.anonymous")}
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-dim)" }}>
              {t("side.meds", { n: profile.medNames.length })}
            </div>
          </div>
          <button onClick={onReset} title={t("side.reset")} style={{ background: "transparent", border: "none", color: "var(--fg-dim)", cursor: "pointer", padding: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-dim)")}
          >
            <IconReset size={14}/>
          </button>
        </div>

        {/* Author credit — CortexLLM */}
        <div style={{
             display: "flex", alignItems: "center", gap: 8,
             padding: "4px 10px",
             borderRadius: "var(--r-md)",
             color: "var(--fg-dim)",
             fontSize: 11,
           }}>
          <span style={{ flex: 1, lineHeight: 1.3 }}>
            <span style={{ color: "var(--fg-mute)" }}>{t("common.by")} </span>
            <span style={{ color: "var(--fg)" }}>CortexLLM</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
