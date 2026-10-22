// src/components/Waveform.jsx
// Live PPG-style waveform that pulses at the given heart-rate.

import { useEffect, useRef } from "react";

const W = 600;

export default function Waveform({ hr = 72, color = "var(--accent)", height = 120 }) {
  const ref = useRef(null);
  const buf = useRef([]);
  const phase = useRef(0);

  useEffect(() => {
    let raf, last = performance.now();
    const loop = (t) => {
      const dt = (t - last) / 1000; last = t;
      phase.current += dt * (hr / 60);
      const p = phase.current % 1;
      let v;
      if (p < 0.08) v = p / 0.08;
      else if (p < 0.18) v = 1 - (p - 0.08) / 0.10 * 0.7;
      else if (p < 0.26) v = 0.3 + Math.sin((p - 0.18) / 0.08 * Math.PI) * 0.18;
      else if (p < 0.55) v = 0.3 * (1 - (p - 0.26) / 0.29);
      else v = 0;
      v += (Math.random() - 0.5) * 0.02;
      buf.current.push(v);
      if (buf.current.length > 180) buf.current.shift();

      const svg = ref.current;
      if (!svg) { raf = requestAnimationFrame(loop); return; }
      const path = svg.querySelector(".wave-path");
      const head = svg.querySelector(".wave-head");
      const N = buf.current.length;
      if (N > 2) {
        const stepX = W / 180;
        const pts = buf.current.map((y, i) => [(180 - N + i) * stepX, height / 2 + 4 - y * (height * 0.7)]);
        const d = pts.map((q, i) => (i === 0 ? "M" : "L") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
        path.setAttribute("d", d);
        const tail = pts[pts.length - 1];
        head.setAttribute("cx", tail[0]);
        head.setAttribute("cy", tail[1]);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hr, height]);

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
