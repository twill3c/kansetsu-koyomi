"use client";

import { useState } from "react";

import { histogram, linear, niceTicks } from "@/lib/viz";

const W = 940;
const H = 250;
const PAD = { top: 34, right: 20, bottom: 34, left: 40 };

/**
 * 帰無分布と観測値。棒はデータから作った度数で、注記の位置も同じデータから出す(HC-045)。
 */
export function NullChart({
  values,
  observed,
  binWidth,
  xLabel,
  observedLabel,
}: {
  values: number[];
  observed: number;
  binWidth: number;
  xLabel: string;
  observedLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const lo = Math.floor(Math.min(observed, ...values) / binWidth) * binWidth;
  const hi = Math.ceil((Math.max(observed, ...values) + binWidth) / binWidth) * binWidth;
  const bins = histogram(values, lo, hi, binWidth);
  const maxCount = Math.max(...bins.map((b) => b.count));

  const x = linear(lo, hi, PAD.left, W - PAD.right);
  const y = linear(0, maxCount, H - PAD.bottom, PAD.top);
  const bw = Math.max(1.5, x(lo + binWidth) - x(lo) - 1.5);
  const atLeast = values.filter((v) => v >= observed).length;

  return (
    <div className="figure__scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`帰無分布と観測値（${observedLabel}）`}>
        {niceTicks(lo, hi, 8).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--grid)" />
            <text x={x(t)} y={H - PAD.bottom + 15} textAnchor="middle" fontSize={11} fill="var(--ink-muted)">
              {Math.round(t * 10) / 10}
            </text>
          </g>
        ))}
        {/* 0 の目盛りは基線の「上」に置く。下に置くと横軸のいちばん左の目盛りと重なる。 */}
        {[0, maxCount].map((v) => (
          <text
            key={v}
            x={PAD.left - 6}
            y={y(v) + (v === 0 ? -5 : 4)}
            textAnchor="end"
            fontSize={11}
            fill="var(--ink-muted)"
          >
            {v}
          </text>
        ))}
        {bins.map((b) => (
          <rect
            key={b.lo}
            x={x(b.lo) + 0.75}
            y={y(b.count)}
            width={bw}
            height={H - PAD.bottom - y(b.count)}
            rx={1.5}
            fill="var(--ink-muted)"
            opacity={hover === b.lo ? 0.95 : 0.5}
            onPointerEnter={() => setHover(b.lo)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--axis)" />
        <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize={11} fill="var(--ink-muted)">
          {xLabel}
        </text>

        <line
          x1={x(observed)}
          x2={x(observed)}
          y1={PAD.top - 10}
          y2={H - PAD.bottom}
          stroke="var(--critical)"
          strokeWidth={2.5}
        />
        <text
          x={x(observed) > W * 0.6 ? x(observed) - 8 : x(observed) + 8}
          y={PAD.top - 14}
          textAnchor={x(observed) > W * 0.6 ? "end" : "start"}
          fontSize={12}
          fontWeight={700}
          fill="var(--critical)"
        >
          観測 {observedLabel}（置換 {values.length} 回のうち {atLeast} 回が同じか上）
        </text>

        {hover !== null && (
          <g transform={`translate(${Math.min(x(hover) + 6, W - 130)},${PAD.top + 2})`} pointerEvents="none">
            <rect width={124} height={22} rx={5} fill="var(--surface)" stroke="var(--hairline)" />
            <text x={7} y={15} fontSize={11} fill="var(--ink)">
              {bins.find((b) => b.lo === hover)?.count} 回
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
