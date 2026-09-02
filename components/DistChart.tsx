"use client";

import { useState } from "react";

import { ticksIn } from "@/lib/calendar";
import { histogram, linear } from "@/lib/viz";

const W = 940;
const H = 210;
const PAD = { top: 30, right: 16, bottom: 30, left: 34 };
const BIN = 5;

export function DistChart({
  indices,
  normalIndex,
  normalLabel,
  latestIndex,
  latestLabel,
  todayIndex,
  name,
}: {
  indices: number[];
  normalIndex: number;
  normalLabel: string;
  latestIndex: number;
  latestLabel: string;
  /** 今日が寒候年の何日目か。範囲外なら描かない。 */
  todayIndex: number;
  name: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const lo = Math.floor((Math.min(normalIndex, ...indices) - 3) / BIN) * BIN;
  const hi = Math.ceil((Math.max(latestIndex, ...indices) + 3) / BIN) * BIN;
  const bins = histogram(indices, lo, hi, BIN);
  const maxCount = Math.max(...bins.map((b) => b.count));

  const x = linear(lo, hi, PAD.left, W - PAD.right);
  const y = linear(0, maxCount, H - PAD.bottom, PAD.top);
  const bw = Math.max(2, x(lo + BIN) - x(lo) - 2);

  const marks = [
    { at: normalIndex, label: `平年 ${normalLabel}`, color: "var(--accent)" },
    { at: latestIndex, label: `最遅 ${latestLabel}`, color: "var(--critical)" },
  ];
  const showToday = todayIndex >= lo && todayIndex <= hi;

  return (
    <div className="figure__scroll">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${name}の初冠雪日の分布（${BIN} 日ごと・${indices.length} 年）`}
      >
        {ticksIn(Math.ceil(lo), Math.floor(hi)).map((t) => (
          <g key={t.index}>
            <line
              x1={x(t.index)}
              x2={x(t.index)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--grid)"
            />
            <text
              x={x(t.index)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={11}
              fill="var(--ink-muted)"
            >
              {t.label}
            </text>
          </g>
        ))}
        {/* 0 の目盛りは基線の上へ(横軸の目盛りと重ならないように) */}
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
            x={x(b.lo) + 1}
            y={y(b.count)}
            width={bw}
            height={H - PAD.bottom - y(b.count)}
            rx={2}
            fill="var(--series)"
            opacity={hover === b.lo ? 1 : 0.78}
            onPointerEnter={() => setHover(b.lo)}
            onPointerLeave={() => setHover(null)}
          />
        ))}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="var(--axis)"
        />

        {marks.map((m) => (
          <g key={m.label}>
            <line
              x1={x(m.at)}
              x2={x(m.at)}
              y1={PAD.top - 8}
              y2={H - PAD.bottom}
              stroke={m.color}
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            <text
              x={x(m.at)}
              y={PAD.top - 12}
              textAnchor={x(m.at) > W / 2 ? "end" : "start"}
              fontSize={11}
              fontWeight={700}
              fill={m.color}
            >
              {m.label}
            </text>
          </g>
        ))}
        {showToday && (
          <>
            <line
              x1={x(todayIndex)}
              x2={x(todayIndex)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
            <text
              x={x(todayIndex) + 4}
              y={H - PAD.bottom - 4}
              fontSize={11}
              fontWeight={700}
              fill="var(--ink)"
            >
              今日
            </text>
          </>
        )}

        {hover !== null && (
          <g transform={`translate(${Math.min(x(hover) + 6, W - 150)},${PAD.top})`} pointerEvents="none">
            <rect width={144} height={22} rx={5} fill="var(--surface)" stroke="var(--hairline)" />
            <text x={7} y={15} fontSize={11} fill="var(--ink)">
              {bins.find((b) => b.lo === hover)?.count} 年がこの 5 日間
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
