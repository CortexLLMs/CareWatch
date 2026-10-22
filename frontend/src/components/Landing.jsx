// src/components/Landing.jsx
// Onboarding chatbot — collects medications, schedule, email.

import { useState, useEffect, useRef, useCallback } from "react";
import { LogoMark, IconSend, IconCheck, IconSun, IconMoon } from "./Icons";
import { saveLocal } from "../lib/storage";
import { parseTimes, parseMedNames, formatTime, wait } from "../lib/parse";
import { ai } from "../lib/api";
import { useT } from "../i18n.jsx";

const STEPS = [
  { key: "ask_med", lk: "land.stepMeds" },
  { key: "names",   lk: "land.stepNames" },
  { key: "time",    lk: "land.stepTime" },
  { key: "email",   lk: "land.stepEmail" },
];
const LANG_NAMES = { fr: "French", en: "English", ar: "Arabic" };
const LOGO_MARK = `${import.meta.env.BASE_URL}logo-mark.png`;
const LOGO_FULL = `${import.meta.env.BASE_URL}logo-full.png`;

export default function Landing({ onDone }) {
  const { t, lang, cycleLang, theme, toggleTheme } = useT();
  const [msgs, setMsgs] = useState([]);
  const [chips, setChips] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [data, setData] = useState({ medNames: [], medTimes: [], contact: "" });
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollTo({ top: endRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const add = useCallback((role, text, key, vars) => setMsgs((p) => [...p, { role, text, key, vars, time: formatTime() }]), []);
  const dot = useCallback(() => setMsgs((p) => [...p, { role: "bot", typing: true }]), []);
  const undot = useCallback(() => setMsgs((p) => p.filter((m) => !m.typing)), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await wait(450);
      if (cancelled) return;
      dot();
      await wait(900);
      if (cancelled) return;
      undot();
      add("bot", null, "land.welcome");
      setChips([{ key: "land.chipYes" }, { key: "land.chipNo" }]);
      setStep("ask_med");
      setProgress(15);
    })();
    return () => { cancelled = true; };
  }, [add, dot, undot]);

  async function go(ans) {
    if (busy || !ans.trim()) return;
    setBusy(true); setChips([]); setInp("");
    add("user", ans);
    dot();
    await wait(650);

    if (step === "ask_med") {
      // Optional AI extraction — falls back to regex if AI unavailable.
      const r = await ai(
        `User answered "${ans}" to whether they take medications. Reply in ${LANG_NAMES[lang]}. Return JSON only: {"takes_med":true|false,"message":"short next reply"}`,
        "answer: " + ans
      );
      let parsed;
      try { parsed = JSON.parse(r.replace(/```json|```/g, "").trim()); }
      catch { parsed = { takes_med: /^y|yes|yeah|yep|sure|i do|take|oui|je prends|نعم|أفعل/i.test(ans.trim()), message: "" }; }

      undot();
      if (parsed.takes_med) {
        if (parsed.message) add("bot", parsed.message);
        else add("bot", null, "land.aMeds");
        setStep("names");
        setProgress(40);
      } else {
        add("bot", null, "land.aNoMeds");
        await wait(500); dot(); await wait(700); undot();
        add("bot", null, "land.toDash");
        await wait(900);
        const d = { medNames: [], medTimes: [], contact: "" };
        saveLocal(d); onDone(d);
      }
    } else if (step === "names") {
      const names = parseMedNames(ans);
      const final = names.length ? names : [ans.trim()];
      setData((d) => ({ ...d, medNames: final }));
      undot();
      add("bot", null, "land.aNames", { list: final.join(" · ") });
      setChips(["08:00", "08:00 · 20:00", "08:00 · 14:00 · 20:00"]);
      setStep("time");
      setProgress(65);
    } else if (step === "time") {
      const times = parseTimes(ans);
      const final = times.length ? times : ["08:00"];
      setData((d) => ({ ...d, medTimes: final }));
      undot();
      add("bot", null, "land.aTime", { times: final.join(" · ") });
      setStep("email");
      setProgress(85);
    } else if (step === "email") {
      undot();
      setData((prev) => {
        const final = { ...prev, contact: ans.trim() };
        saveLocal(final);
        add("bot", null, "land.aEmail", { email: ans.trim() });
        setProgress(100);
        setTimeout(() => onDone(final), 1100);
        return final;
      });
    }
    setBusy(false);
  }

  const activeIdx = Math.max(0, STEPS.findIndex((s) => s.key === step));

  const bubbleBot = {
    background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--fg)",
    padding: "12px 16px",
    borderStartStartRadius: 12, borderStartEndRadius: 12, borderEndStartRadius: 4, borderEndEndRadius: 12,
    fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap"
  };
  const bubbleUser = {
    maxWidth: 480, background: "var(--accent-soft)", border: "1px solid var(--accent-line)",
    color: "var(--fg)", padding: "12px 16px",
    borderStartStartRadius: 12, borderStartEndRadius: 12, borderEndStartRadius: 12, borderEndEndRadius: 4,
    fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap"
  };
  const switchBtn = {
    border: "1px solid var(--line)", background: "var(--bg-2)", color: "var(--fg-mute)",
    borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: 11, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
    transition: "all .15s"
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--accent) 8%, transparent), transparent 70%), radial-gradient(40% 30% at 90% 90%, color-mix(in oklab, var(--accent) 5%, transparent), transparent 70%)",
        animation: "cw-drift 18s ease-in-out infinite"
      }}/>

      <header style={{ position: "relative", padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={LOGO_MARK} alt="" width={34} height={34} style={{ display: "block" }}/>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Care<span className="brand-grad">Watch</span></span>
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-dim)", marginInlineStart: 8 }}>{t("land.v3")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--fg-mute)" }}>{t("land.setup", { a: activeIdx + 1, b: STEPS.length })}</div>
          <button onClick={toggleTheme} title={theme === "dark" ? t("theme.light") : t("theme.dark")} style={switchBtn}>
            {theme === "dark" ? <IconSun size={14}/> : <IconMoon size={14}/>}
          </button>
          <button onClick={cycleLang} title="FR / EN / AR" className="mono" style={{ ...switchBtn, letterSpacing: "0.06em" }}>
            {lang.toUpperCase()}
          </button>
        </div>
      </header>

      <main style={{ position: "relative", flex: 1, display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr" }}>
        <aside style={{ borderRight: "1px solid var(--line)", padding: "48px 32px", display: "flex", flexDirection: "column", gap: 32 }}>
          <img src={LOGO_FULL} alt="CareWatch" style={{ width: 168, alignSelf: "flex-start" }}/>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--fg-dim)", textTransform: "uppercase", marginBottom: 12 }}>{t("land.onboarding")}</div>
            <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {t("land.h1a")}<br/>{t("land.h1b")}
            </h1>
            <p style={{ color: "var(--fg-mute)", fontSize: 14, lineHeight: 1.55, marginTop: 16, maxWidth: 280 }}>
              {t("land.intro")}
            </p>
          </div>

          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {STEPS.map((s, i) => {
              const done = i < activeIdx, active = i === activeIdx;
              return (
                <li key={s.key} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: "var(--r-md)",
                  background: active ? "var(--bg-2)" : "transparent",
                  border: active ? "1px solid var(--line)" : "1px solid transparent"
                }}>
                  <span className="mono" style={{
                    width: 18, height: 18, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${done ? "var(--accent-line)" : active ? "var(--line-hi)" : "var(--line)"}`,
                    background: done ? "var(--accent-soft)" : "transparent",
                    color: done ? "var(--accent)" : active ? "var(--fg)" : "var(--fg-dim)",
                    fontSize: 10, fontWeight: 600
                  }}>
                    {done ? <IconCheck size={11} stroke={2}/> : i + 1}
                  </span>
                  <span style={{ fontSize: 13, color: active ? "var(--fg)" : done ? "var(--fg-mute)" : "var(--fg-dim)" }}>{t(s.lk)}</span>
                </li>
              );
            })}
          </ol>

          <div>
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fg-dim)", marginBottom: 8 }}>
              <span>{t("land.progress")}</span><span className="tabular">{progress}%</span>
            </div>
            <div style={{ height: 2, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: progress + "%", height: "100%", background: "var(--accent)", transition: "width .5s cubic-bezier(.4,0,.2,1)" }}/>
            </div>
          </div>

          <div className="mono" style={{ marginTop: "auto", fontSize: 11, color: "var(--fg-faint)", lineHeight: 1.6 }}>
            {t("land.dataLocal")}<br/>{t("land.noAccount")}
          </div>

          <div style={{
               display: "flex", alignItems: "center", gap: 8,
               padding: "10px 0", marginTop: 8,
               borderTop: "1px solid var(--line)",
               color: "var(--fg-dim)",
               fontSize: 11,
             }}>
            <span>{t("common.by")} <span style={{ color: "var(--fg)" }}>CortexLLM</span></span>
          </div>
        </aside>

        <section style={{ display: "flex", flexDirection: "column", padding: "32px 40px", maxWidth: 720, width: "100%", margin: "0 auto" }}>
          <div ref={endRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingInlineEnd: 4 }}>
            {msgs.map((m, i) => {
              if (m.typing) {
                return (
                  <div key={i} className="fade-in" style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 560 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <LogoMark size={14}/>
                    </span>
                    <div style={{ ...bubbleBot, display: "inline-flex", gap: 5 }}>
                      {[0, 0.15, 0.3].map((d, j) =>
                        <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-mute)", display: "inline-block", animation: "cw-bounce 1.2s infinite", animationDelay: d + "s" }}/>
                      )}
                    </div>
                  </div>
                );
              }
              if (m.role === "user") {
                return <div key={i} className="fade-in" style={{ display: "flex", justifyContent: "flex-end" }}><div style={bubbleUser}>{m.text}</div></div>;
              }
              return (
                <div key={i} className="fade-in" style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: 560 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4 }}>
                    <LogoMark size={14}/>
                  </span>
                  <div style={bubbleBot}>{m.key ? t(m.key, m.vars) : m.text}</div>
                </div>
              );
            })}
          </div>

          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {chips.map((c, i) => {
                const label = typeof c === "string" ? c : t(c.key);
                return (
                  <button key={i} onClick={() => go(label)} style={{
                    padding: "8px 14px", borderRadius: 999, border: "1px solid var(--line-hi)",
                    background: "var(--bg-2)", color: "var(--fg)", fontSize: 13, cursor: "pointer", transition: "all .15s"
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-line)"; e.currentTarget.style.background = "var(--bg-3)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line-hi)"; e.currentTarget.style.background = "var(--bg-2)"; }}
                  >{label}</button>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "8px 16px" }}>
            <input
              value={inp}
              onChange={(e) => setInp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go(inp)}
              placeholder={step === "email" ? "you@email.com" : step === "time" ? t("land.phTime") : step === "names" ? t("med.phMeds") : t("land.phMsg")}
              disabled={busy}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--fg)", fontSize: 14, padding: "6px 0" }}
            />
            <button onClick={() => go(inp)} disabled={busy || !inp.trim()} style={{
              width: 32, height: 32, borderRadius: 6,
              background: inp.trim() ? "var(--accent)" : "var(--bg-3)",
              color: inp.trim() ? "#ffffff" : "var(--fg-dim)",
              border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
              cursor: inp.trim() && !busy ? "pointer" : "default", transition: "all .15s"
            }}>
              <IconSend size={15} stroke={2.2}/>
            </button>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 8 }}>{t("land.toSend")}</div>
        </section>
      </main>
    </div>
  );
}
