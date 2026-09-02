"use client";

import Link from "next/link";
import { useState } from "react";

import { MountainGlyph } from "./MountainGlyph";

export type Peak = {
  code: string;
  order: number;
  name: string;
  kana: string;
  station: string;
  normal: string;
  normalIndex: number;
  step: number;
  snow: string;
  capDate: string;
  /** 平年日を過ぎているか(今日を基準にした日数。負なら平年前)。 */
  daysFromNormal: number;
};

type Sort = "official" | "normal";

export function PeakGrid({ peaks, todayLabel }: { peaks: Peak[]; todayLabel: string }) {
  const [sort, setSort] = useState<Sort>("official");
  const ordered =
    sort === "official"
      ? [...peaks].sort((a, b) => a.order - b.order)
      : [...peaks].sort((a, b) => a.normalIndex - b.normalIndex || a.order - b.order);

  return (
    <>
      <div className="sortbar">
        <span className="muted small">並び</span>
        <button
          type="button"
          className={sort === "official" ? "is-on" : ""}
          onClick={() => setSort("official")}
          aria-pressed={sort === "official"}
        >
          気象庁の一覧順(北の官署から南へ)
        </button>
        <button
          type="button"
          className={sort === "normal" ? "is-on" : ""}
          onClick={() => setSort("normal")}
          aria-pressed={sort === "normal"}
        >
          平年日の早い順
        </button>
      </div>
      <ul className="peaks">
        {ordered.map((p) => (
          <li key={p.code}>
            <Link className="peak" href={`/mountain/${p.code}/`}>
              <span className="peak__head">
                <MountainGlyph step={p.step} title={p.name} code={p.code} size={34} />
                <span>
                  <span className="peak__name">{p.name}</span>
                  <span className="peak__meta">
                    {p.station}／平年 {p.normal}
                  </span>
                </span>
              </span>
              <span className="peak__state">
                {p.capDate === "--" ? (
                  <span className="muted">
                    まだ／{p.daysFromNormal < 0 ? `平年まで ${-p.daysFromNormal} 日` : `平年から ${p.daysFromNormal} 日`}
                  </span>
                ) : (
                  <>
                    <strong>{p.capDate}</strong>
                    <span className="muted"> ・{p.snow}</span>
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="small muted">
        {todayLabel} 時点。しるしの形は何も表していない（標高は使っていない）。白い冠の深さだけが、
        気象庁が公開している今季の山頂の積雪階級である。
      </p>
    </>
  );
}
