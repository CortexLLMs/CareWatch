// src/components/VitalityRing.jsx
export default function VitalityRing({ score = 78, size = 180 }) {
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score >= 70 ? "var(--accent)" : score >= 45 ? "var(--warn)" : "var(--danger)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth="6"/>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1), stroke .3s" }}
      />
      <g>
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const r1 = r + 9, r2 = r + 12;
          const x1 = size / 2 + Math.cos(a) * r1, y1 = size / 2 + Math.sin(a) * r1;
          const x2 = size / 2 + Math.cos(a) * r2, y2 = size / 2 + Math.sin(a) * r2;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={i % 5 === 0 ? "var(--fg-dim)" : "var(--fg-faint)"}
              strokeWidth={i % 5 === 0 ? 1 : 0.5}
            />
          );
        })}
      </g>
    </svg>
  );
}
