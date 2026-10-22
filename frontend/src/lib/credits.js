// src/lib/credits.js
// ─────────────────────────────────────────────────────────────────
//   CareWatch — built by CortexLLM
//   This credit must remain in any fork or redistribution per LICENSE.
// ─────────────────────────────────────────────────────────────────

export const AUTHOR = Object.freeze({
  name: "CortexLLM",
});

// Print credit to browser console on load.
if (typeof window !== "undefined" && !window.__carewatch_credit_shown) {
  window.__carewatch_credit_shown = true;
  const style = "background:#0e1b3d;color:#3d7bff;padding:6px 12px;border-radius:4px;font-weight:600;font-family:monospace";
  console.log("%c CareWatch — Built by CortexLLM ", style);
}
