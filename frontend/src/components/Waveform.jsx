// src/components/Waveform.jsx
// Live waveform rendered from the measured band-pass PPG signal.

import { useEffect, useRef } from "react";

const W = 600;

export default function Waveform({ signal = [], color = "var(--accent)", height = 120 }) {
  const ref = useRef(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return undefined;
    const path = svg.querySelector(".wave-path");
    const head = svg.querySelector(".wave-head");
    const samples = Array.from(signal || []).slice(-180);
    if (samples.length < 3) {
      path.removeAttribute("d");
      head.setAttribute("visibility", "hidden");
      return undefined;
    }

    let min = Infinity, max = -Infinity;
    for (const sample of samples) {
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    const span = max - min || 1;
    const stepX = W / Math.max(179, samples.length - 1);
    const pts = samples.map((sample, i) => [
      (180 - samples.length + i) * stepX,
      height - ((sample - min) / span) * height * 0.72 - height * 0.14
    ]);
    path.setAttribute("d", pts.map((q, i) => (i === 0 ? "M" : "L") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" "));
    const tail = pts[pts.length - 1];
    head.setAttribute("cx", tail[0]);
    head.setAttribute("cy", tail[1]);
    head.setAttribute("visibility", "visible");
    return undefined;
  }, [signal, height]);

  return (
    <svg ref={ref} width="100%" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <g opacity="0.15">
        {[0.25, 0.5, 0.75].map((y, i) => (
          <line key={i} x1="0" x2={W} y1={height * y} y2={height * y} stroke="var(--fg-mute)" strokeDasharray="2 6" strokeWidth="0.5"/>
        ))}
      </g>
      <path className="wave-path" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle className="wave-head" r="3" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }}/>
    </svg>
  );
}
