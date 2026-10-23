// src/lib/reportPdf.js
// Rapport mensuel de suivi physiologique, au format compte rendu d'analyse.
// Généré localement (jsPDF), sans envoi de données. Chaque rapport porte une
// référence unique et une empreinte SHA-256 du jeu de données pour la
// traçabilité. Document non diagnostique.

import { getMonth } from "./history";

const A4 = { w: 210, h: 297 };
const M = 16;
const W = A4.w - 2 * M;

const NAVY = [14, 27, 61];
const BLUE = [27, 86, 255];
const GREY = [108, 116, 132];
const LIGHT = [238, 241, 247];
const DARK = [26, 32, 44];

const ALERT_LABELS = {
  heartRate: "Fréquence cardiaque",
  fatigue: "Somnolence",
  stress: "Stress",
  oxygen: "Saturation SpO2",
  emergency: "Geste d'urgence (paume)",
  grimace: "Grimace douloureuse",
};

const pad2 = (n) => String(n).padStart(2, "0");

const fmtDuration = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${pad2(m)} min` : `${m} min`;
};

const fmt = (v, dec = 0, suffix = "") =>
  v == null || Number.isNaN(v) ? "—" : `${Number(v).toFixed(dec)}${suffix}`;

async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "indisponible";
  }
}

export async function generateMonthlyReport({ year, month, patient = "", source = "local" }) {
  const { jsPDF } = await import("jspdf");
  const data = getMonth(year, month);
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const monthLabel = new Date(year, month, 1).toLocaleDateString("fr-FR", {
    month: "long", year: "numeric",
  });
  const generatedAt = new Date();
  const generatedLabel = generatedAt.toLocaleString("fr-FR");
  const canonical = JSON.stringify({
    year, month, days: data.days, samples: data.samples,
    generatedAt: generatedAt.toISOString().slice(0, 16),
  });
  const hash = await sha256(canonical);
  const ref = `CW-${year}${pad2(month + 1)}-${hash.slice(0, 6).toUpperCase()}`;

  /* ─── Primitives de mise en page ─── */
  let y = 0;

  const header = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, A4.w, 4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text("CAREWATCH", M, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("Surveillance physiologique par webcam", M, 19.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BLUE);
    doc.text("RAPPORT DE SUIVI MENSUEL", A4.w - M, 15, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`Réf. ${ref}`, A4.w - M, 19.5, { align: "right" });

    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(M, 23, A4.w - M, 23);
    y = 31;
  };

  const section = (title) => {
    if (y > 258) { doc.addPage(); header(); }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BLUE);
    doc.text(title.toUpperCase(), M, y);
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.35);
    doc.line(M, y + 1.6, A4.w - M, y + 1.6);
    y += 7;
  };

  const keyValues = (pairs, opts = {}) => {
    const columns = opts.columns || 2;
    const colWidth = W / columns;
    const valueOffset = opts.valueOffset || 44;
    doc.setFontSize(8);
    pairs.forEach(([k, v], i) => {
      const col = i % columns;
      if (col === 0 && i > 0) y += 6;
      const x = M + col * colWidth;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GREY);
      doc.text(k, x, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(String(v), x + valueOffset, y);
    });
    y += 8;
  };

  const table = (cols, rows) => {
    const rowH = 6.2;
    const drawHead = () => {
      doc.setFillColor(...LIGHT);
      doc.rect(M, y - 4, W, rowH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      cols.forEach((c, i) => {
        doc.text(c.label, M + c.x, y, { align: c.align || "left" });
      });
      y += rowH;
    };

    drawHead();
    doc.setFont("helvetica", "normal");

    for (const row of rows) {
      if (y > 266) { doc.addPage(); header(); drawHead(); doc.setFont("helvetica", "normal"); }
      let x = M;
      cols.forEach((c, i) => {
        doc.setFontSize(7.2);
        doc.setTextColor(...DARK);
        doc.text(String(row[i] ?? "—"), x + c.x, y, { align: c.align || "left" });
        x += 0;
      });
      doc.setDrawColor(226, 230, 238);
      doc.setLineWidth(0.15);
      doc.line(M, y + 1.8, M + W, y + 1.8);
      y += rowH;
    }
    y += 3;
  };

  const paragraph = (text, size = 7.6) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...GREY);
    for (const block of String(text).split("\n")) {
      const lines = doc.splitTextToSize(block, W);
      for (const line of lines) {
        if (y > 270) { doc.addPage(); header(); }
        doc.text(line, M, y);
        y += 4;
      }
    }
    y += 2;
  };

  /* ─── Page 1 ─── */
  header();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.text("Rapport de suivi physiologique", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`Période : ${monthLabel}`, M, y);
  y += 10;

  section("1. Identification");
  keyValues([
    ["Patient", patient || "Anonyme (aucun compte)"],
    ["Période analysée", monthLabel],
    ["Source des données", source === "serveur" ? "Serveur CareWatch (SQLite)" : "Stockage local du navigateur"],
    ["Jours avec mesures", `${data.activeDays} jour(s)`],
    ["Durée cumulée", fmtDuration(data.seconds)],
    ["Édité le", generatedLabel],
  ]);

  section("2. Synthèse des constantes");
  keyValues([
    ["Fréquence cardiaque moy.", fmt(data.hrAvg, 0, " bpm")],
    ["Amplitude observée", data.hrMin != null ? `${data.hrMin} – ${data.hrMax} bpm` : "—"],
    ["SpO2 moyenne (est.)", fmt(data.spo2Avg, 1, " %")],
    ["VFC — RMSSD moyen", fmt(data.rmssdAvg, 0, " ms")],
    ["Somnolence maximale", fmt(data.drowsyMax, 0, " %")],
    ["Bâillement maximal", fmt(data.yawnMax, 0, " %")],
    ["Grimace maximale", fmt(data.grimaceMax, 0, " %")],
    ["Qualité moyenne du signal", `${fmt((data.confidence || 0) * 100, 0, " %")} — ${(data.confidence || 0) >= 0.7 ? "bonne" : (data.confidence || 0) >= 0.4 ? "moyenne" : "faible"}`],
  ]);

  section("3. Alertes enregistrées");
  const alertRows = Object.entries(data.alerts).sort((a, b) => b[1] - a[1]);
  if (alertRows.length) {
    table(
      [
        { label: "Type d'alerte", x: 2 },
        { label: "Occurrences", x: W - 2, align: "right" },
      ],
      alertRows.map(([t, n]) => [ALERT_LABELS[t] || t, n]),
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Total : ${data.alertTotal} alerte(s)`, M, y);
    y += 8;
  } else {
    paragraph("Aucune alerte enregistrée sur la période.");
  }

  /* ─── Détail quotidien ─── */
  section("4. Détail quotidien");
  if (data.days.length) {
    table(
      [
        { label: "Date", x: 2 },
        { label: "Durée", x: 30 },
        { label: "FC moy.", x: 52, align: "right" },
        { label: "FC min–max", x: 78, align: "right" },
        { label: "SpO2", x: 106, align: "right" },
        { label: "RMSSD", x: 124, align: "right" },
        { label: "Alertes", x: W - 2, align: "right" },
      ],
      data.days.map((d) => [
        new Date(d.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        fmtDuration(d.seconds),
        fmt(d.hrAvg, 0),
        d.hrMin != null ? `${d.hrMin}–${d.hrMax}` : "—",
        fmt(d.spo2Avg, 1),
        fmt(d.rmssdAvg, 0),
        d.alertTotal,
      ]),
    );
  } else {
    paragraph("Aucune mesure enregistrée pour cette période. Lancez une session pour alimenter le rapport.");
  }

  /* ─── Traçabilité ─── */
  if (y > 150) { doc.addPage(); header(); }
  section("5. Traçabilité");
  paragraph(
    "Les mesures sont acquises par photoplethysmographie distante (rPPG) sur le flux " +
    "de la webcam, traitées localement dans le navigateur. Aucune image n'est transmise. " +
    "Les valeurs sont des estimations expérimentales et ne constituent pas un diagnostic.",
  );
  keyValues([
    ["Référence rapport", ref],
    ["Échantillons agrégés", String(data.samples)],
    ["Version application", "CareWatch 3.0"],
    ["Chaîne rPPG", "POS (Wang 2017) · Butterworth 0,7–4 Hz · SNR spectral"],
    ["Vision", "MediaPipe FaceMesh / Pose / Hands"],
    ["SpO2", "Ratio-of-ratios AC/DC (expérimental)"],
    ["Somnolence", "EAR + PERCLOS · Bâillement : MAR normalisé"],
  ], { columns: 1, valueOffset: 54 });
  paragraph(`Empreinte SHA-256 du jeu de données : ${hash}`);

  /* ─── Références ─── */
  if (y > 232) { doc.addPage(); header(); }
  section("6. Références");
  paragraph(
    "1. Organisation mondiale de la Santé. Plan d'action mondial pour la prévention et la lutte " +
    "contre les maladies non transmissibles 2013-2020. Genève : OMS ; 2013.\n" +
    "2. Organisation mondiale de la Santé. Lignes directrices sur l'activité physique et les " +
    "comportements sédentaires. Genève : OMS ; 2020.\n" +
    "3. Organisation mondiale de la Santé. Rapport mondial sur l'hypertension : la course contre " +
    "un tueur silencieux. Genève : OMS ; 2023.\n" +
    "4. Organisation mondiale de la Santé. Manuel de formation à l'oxymétrie de pouls. Genève : OMS ; 2011.\n" +
    "5. Task Force of the European Society of Cardiology and the North American Society of Pacing " +
    "and Electrophysiology. Heart rate variability: standards of measurement, physiological " +
    "interpretation, and clinical use. Circulation. 1996;93(5):1043-1065.\n" +
    "6. Wang W, den Brinker AC, Stuijk S, de Haan G. Algorithmic principles of remote PPG. " +
    "IEEE Trans Biomed Eng. 2017;64(7):1479-1491.\n" +
    "7. Dinges DF, Grace R. PERCLOS: a valid psychophysiological measure of alertness as assessed " +
    "by psychomotor vigilance. Washington : Federal Highway Administration ; 1998.",
    7,
  );

  /* ─── Pieds de page ─── */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.4);
    doc.line(M, A4.h - 14, A4.w - M, A4.h - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...GREY);
    doc.text(
      "CareWatch — document non diagnostique. Les valeurs sont des estimations expérimentales.",
      M, A4.h - 10,
    );
    doc.text(`${ref}  ·  page ${p}/${pages}`, A4.w - M, A4.h - 10, { align: "right" });
  }

  const name = `CareWatch_rapport_${year}-${pad2(month + 1)}.pdf`;
  doc.save(name);
  return { name, ref };
}
