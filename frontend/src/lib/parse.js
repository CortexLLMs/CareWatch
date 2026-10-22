// src/lib/parse.js
// Extract times and medication names from free-form user input.

export function parseTimes(str) {
  const matches = (str || "").match(/\b\d{1,2}(?:[h:]\d{0,2})?\s*(?:am|pm)?\b/gi) || [];
  const out = [];
  for (let raw of matches) {
    let s = raw.toLowerCase().trim();
    const isPm = /pm/.test(s);
    const isAm = /am/.test(s);
    s = s.replace(/am|pm/g, "").replace(/h/, ":").trim();
    if (!s.includes(":")) s = s + ":00";
    let [h, m] = s.split(":");
    h = parseInt(h, 10);
    m = parseInt(m || "0", 10);
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      out.push(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
    }
  }
  return [...new Set(out)];
}

export function parseMedNames(str) {
  return (str || "")
    .split(/,| and |&|\band\b|\n/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export const formatTime = () =>
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
