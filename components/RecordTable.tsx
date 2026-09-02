"use client";

import Link from "next/link";
import { useState } from "react";

export type TableRow = {
  code: string;
  order: number;
  name: string;
  kana: string;
  station: string;
  office: string;
  normal: string;
  normalIndex: number;
  sampleYears: number;
  firstYear: number;
  lastYear: number;
  nRows: number;
  nDates: number;
  nMissing: number;
  nNone: number;
  earliest: string;
  latest: string;
};

type Key = "order" | "name" | "station" | "normalIndex" | "firstYear" | "nDates" | "nMissing" | "nNone";

const COLS: Array<{ key: Key; label: string; num?: boolean }> = [
  { key: "order", label: "№", num: true },
  { key: "name", label: "山岳名" },
  { key: "station", label: "観測地点" },
  { key: "normalIndex", label: "平年日" },
  { key: "firstYear", label: "記録の始まり", num: true },
  { key: "nDates", label: "日付のある年", num: true },
  { key: "nMissing", label: "欠測", num: true },
  { key: "nNone", label: "なし", num: true },
];

export function RecordTable({ rows }: { rows: TableRow[] }) {
  const [key, setKey] = useState<Key>("order");
  const [asc, setAsc] = useState(true);

  const sorted = [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ja");
    return asc ? c : -c;
  });

  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th
                key={c.key}
                className={c.num ? "num" : undefined}
                aria-sort={key === c.key ? (asc ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  className="sortth"
                  onClick={() => {
                    if (key === c.key) setAsc(!asc);
                    else {
                      setKey(c.key);
                      setAsc(true);
                    }
                  }}
                >
                  {c.label}
                  {key === c.key ? (asc ? " ▲" : " ▼") : ""}
                </button>
              </th>
            ))}
            <th>最早</th>
            <th>最遅</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.code}>
              <td className="num nums">{r.order}</td>
              <td>
                <Link href={`/mountain/${r.code}/`}>{r.name}</Link>
                <span className="muted small"> {r.kana}</span>
              </td>
              <td>{r.station}</td>
              <td className="nums">{r.normal}</td>
              <td className="num nums">{r.firstYear}</td>
              <td className="num nums">{r.nDates}</td>
              <td className="num nums">{r.nMissing || ""}</td>
              <td className="num nums">{r.nNone || ""}</td>
              <td className="nums">{r.earliest}</td>
              <td className="nums">{r.latest}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
