"use client";

import { useRef, useState } from "react";

import { formatSlash, formatSlashFull, ticksIn } from "@/lib/calendar";
import { linear, niceTicks, runs } from "@/lib/viz";

export type SeriesPoint = { year: number; value: string; index: number | null };

const W = 940;
const H = 380;
const PAD = { top: 18, right: 96, bottom: 34, left: 46 };
const RAIL = 22; // 欠測・現象なしを置く帯の高さ

export function SeriesChart({
  points,
  normalIndex,
  normalLabel,
  name,
}: {
  points: SeriesPoint[];
  normalIndex: number;
  normalLabel: string;
  name: string;
}) {
  const [hover, setHover] = useState<SeriesPoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const dated = points.filter((p) => p.index !== null) as Array<SeriesPoint & { index: number }>;
  const y0 = Math.min(...points.map((p) => p.year));
  const y1 = Math.max(...points.map((p) => p.year));
  const i0 = Math.min(normalIndex, ...dated.map((p) => p.index)) - 4;
  const i1 = Math.max(normalIndex, ...dated.map((p) => p.index)) + 4;

  const plotBottom = H - PAD.bottom - RAIL;
  const x = linear(y0, y1, PAD.left, W - PAD.right);
  const y = linear(i0, i1, PAD.top, plotBottom);

  const xTicks = niceTicks(y0, y1, 8).filter((v) => v >= y0 && v <= y1);
  const yTicks = ticksIn(Math.ceil(i0), Math.floor(i1));

  const earliest = dated.reduce((a, b) => (b.index < a.index ? b : a));
  const latest = dated.reduce((a, b) => (b.index > a.index ? b : a));
  const undated = points.filter((p) => p.index === null);

  function onMove(ev: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const year = Math.round(
      y0 + ((px - PAD.left) / (W - PAD.right - PAD.left)) * (y1 - y0),
    );
    const found = points.find((p) => p.year === year) ?? null;
    setHover(found);
  }

  return (
    <div className="figure__scroll">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${name}の初冠雪日 ${y0}〜${y1} 寒候年`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* 目盛り */}
        {yTicks.map((t) => (
          <g key={t.index}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t.index)}
              y2={y(t.index)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t.index) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--ink-muted)"
            >
              {t.label}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            fontSize={11}
            fill="var(--ink-muted)"
          >
            {t}
          </text>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={plotBottom}
          y2={plotBottom}
          stroke="var(--axis)"
          strokeWidth={1}
        />

        {/* 平年値 */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(normalIndex)}
          y2={y(normalIndex)}
          stroke="var(--accent)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        <text
          x={W - PAD.right + 6}
          y={y(normalIndex) + 4}
          fontSize={11}
          fill="var(--accent)"
          fontWeight={700}
        >
          平年 {normalLabel}
        </text>

        {/* 系列 */}
        {runs(points).map((run, i) => (
          <polyline
            key={i}
            fill="none"
            stroke="var(--series)"
            strokeWidth={1.6}
            strokeOpacity={0.55}
            strokeLinejoin="round"
            points={run.map((p) => `${x(p.year)},${y(p.index as number)}`).join(" ")}
          />
        ))}
        {dated.map((p) => (
          <circle
            key={p.year}
            cx={x(p.year)}
            cy={y(p.index)}
            r={hover?.year === p.year ? 4.5 : 2.2}
            fill="var(--series)"
            stroke="var(--surface)"
            strokeWidth={hover?.year === p.year ? 2 : 0}
          />
        ))}

        {/* 最早・最遅 */}
        {[
          { p: earliest, label: `最早 ${formatSlashFull(earliest.value)}`, dy: -9 },
          { p: latest, label: `最遅 ${formatSlashFull(latest.value)}`, dy: 16 },
        ].map(({ p, label, dy }) => (
          <g key={label}>
            <circle cx={x(p.year)} cy={y(p.index)} r={5} fill="none" stroke="var(--critical)" strokeWidth={2} />
            <text
              x={Math.min(Math.max(x(p.year), PAD.left + 4), W - PAD.right - 4)}
              y={y(p.index) + dy}
              textAnchor={x(p.year) > (W - PAD.right + PAD.left) / 2 ? "end" : "start"}
              fontSize={11}
              fontWeight={700}
              fill="var(--critical)"
            >
              {label}
            </text>
          </g>
        ))}

        {/* 欠測・現象なしの帯 */}
        {/* 左端に寄せる。右寄せにすると字幅の広い環境(Linux)で枠から出る —— 実測で Windows は通り
            CI で落ちた。帯の行には他の文字が無いので、左端 0 から書いても重ならない。 */}
        <text x={2} y={H - PAD.bottom + 4} textAnchor="start" fontSize={10} fill="var(--ink-muted)">
          記録なし
        </text>
        {undated.map((p) => (
          <rect
            key={p.year}
            x={x(p.year) - 1.6}
            y={H - PAD.bottom - RAIL + 6}
            width={3.2}
            height={RAIL - 8}
            fill={p.value === "×" ? "var(--ink-muted)" : "var(--critical)"}
            opacity={0.85}
          />
        ))}

        {/* 当てた年 */}
        {hover && (
          <g pointerEvents="none">
            <line
              x1={x(hover.year)}
              x2={x(hover.year)}
              y1={PAD.top}
              y2={plotBottom}
              stroke="var(--ink-muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <g
              transform={`translate(${Math.min(x(hover.year) + 8, W - PAD.right - 110)},${PAD.top + 4})`}
            >
              <rect width={168} height={40} rx={6} fill="var(--surface)" stroke="var(--hairline)" />
              <text x={8} y={17} fontSize={12} fontWeight={700} fill="var(--ink)">
                {hover.year} 寒候年
              </text>
              <text x={8} y={32} fontSize={12} fill="var(--ink-2)">
                {hover.index === null
                  ? hover.value === "×"
                    ? "欠測"
                    : "冠雪の記録なし"
                  : `${formatSlashFull(hover.value)}（${formatSlash(hover.value)}）`}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
