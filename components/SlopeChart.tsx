"use client";

import { useState } from "react";

import { linear, niceTicks } from "@/lib/viz";

export type SlopeRow = { code: string; name: string; ols: number; ts: number };

const W = 940;
const ROW = 17;
const PAD = { top: 26, right: 22, bottom: 26, left: 118 };

export function SlopeChart({ rows }: { rows: SlopeRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const sorted = [...rows].sort((a, b) => b.ols - a.ols);
  const H = PAD.top + sorted.length * ROW + PAD.bottom;
  const lo = Math.min(0, ...sorted.flatMap((r) => [r.ols, r.ts]));
  const hi = Math.max(0, ...sorted.flatMap((r) => [r.ols, r.ts]));
  const pad = (hi - lo) * 0.06 || 1;
  const x = linear(lo - pad, hi + pad, PAD.left, W - PAD.right);
  const ticks = niceTicks(lo - pad, hi + pad, 7);

  return (
    <div className="figure__scroll">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${sorted.length} 山の初冠雪日の傾き（日 / 100 年）`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={PAD.top - 8}
              y2={H - PAD.bottom + 4}
              stroke={t === 0 ? "var(--axis)" : "var(--grid)"}
              strokeWidth={t === 0 ? 1.5 : 1}
            />
            <text x={x(t)} y={PAD.top - 12} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">
              {t > 0 ? `+${t}` : t}
            </text>
          </g>
        ))}
        <text x={W - PAD.right} y={H - PAD.bottom + 18} textAnchor="end" fontSize={11} fill="var(--ink-muted)">
          日 / 100 年（右が「遅くなる」向き）
        </text>

        {sorted.map((r, i) => {
          const y = PAD.top + i * ROW + ROW / 2;
          const on = hover === r.code;
          return (
            <g
              key={r.code}
              onPointerEnter={() => setHover(r.code)}
              onPointerLeave={() => setHover(null)}
            >
              <rect
                x={0}
                y={y - ROW / 2}
                width={W}
                height={ROW}
                fill={on ? "var(--grid)" : "transparent"}
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11.5} fill="var(--ink-2)">
                {r.name}
              </text>
              <line x1={x(0)} x2={x(r.ols)} y1={y} y2={y} stroke="var(--series)" strokeWidth={2} />
              <circle cx={x(r.ts)} cy={y} r={4} fill="none" stroke="var(--accent)" strokeWidth={2} />
              <circle cx={x(r.ols)} cy={y} r={4} fill="var(--series)" stroke="var(--surface)" strokeWidth={1.5} />
              {on && (
                <text
                  x={x(Math.max(r.ols, r.ts)) + 10}
                  y={y + 4}
                  fontSize={11}
                  fontWeight={700}
                  fill="var(--ink)"
                >
                  最小二乗 {r.ols > 0 ? "+" : ""}
                  {r.ols.toFixed(1)} ／ Theil–Sen {r.ts > 0 ? "+" : ""}
                  {r.ts.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
