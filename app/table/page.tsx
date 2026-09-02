import type { Metadata } from "next";
import Link from "next/link";

import { RecordTable, type TableRow } from "@/components/RecordTable";
import { formatSlash } from "@/lib/calendar";
import { meta, mountains } from "@/lib/data";

export const metadata: Metadata = {
  title: "表とデータ — 初冠雪ごよみ",
  description: "気象庁の初冠雪日 4,105 行を表で読み、JSON と CSV で持ち出す。",
};

export default function TablePage() {
  const rows: TableRow[] = mountains.map((m) => ({
    code: m.code,
    order: m.order,
    name: m.name,
    kana: m.kana,
    station: m.station,
    office: m.office,
    normal: m.normal,
    normalIndex: m.normal_index,
    sampleYears: m.sample_years,
    firstYear: m.first_year,
    lastYear: m.last_year,
    nRows: m.n_rows,
    nDates: m.n_dates,
    nMissing: m.n_missing,
    nNone: m.n_none,
    earliest: `${formatSlash(m.earliest.date.replaceAll("-", "/"))}（${m.earliest.year}）`,
    latest: `${formatSlash(m.latest.date.replaceAll("-", "/"))}（${m.latest.year}）`,
  }));

  return (
    <main>
      <h1>表とデータ</h1>
      <p className="lede">
        44 山の要約と、{meta.counts.rows.toLocaleString("ja-JP")} 行の記録そのもの。
        列の見出しを押すと並べ替わる。山の名前を押すと、その山の全記録に移る。
      </p>

      <h2>44 山の要約</h2>
      <RecordTable rows={rows} />

      <h2>持ち出す</h2>
      <p>
        加工前の JSON と、記録を 1 行 1 件に開いた CSV を置いてある。
        どちらも気象庁の公表値をそのまま入れたもので、欠測は <code>×</code>、
        該当現象なしは <code>--</code> のまま残している。
      </p>
      <ul>
        <li>
          <a href="/data/records.csv" download>
            records.csv
          </a>{" "}
          — 山岳コード・山岳名・観測地点・寒候年・値（{meta.counts.rows.toLocaleString("ja-JP")} 行）
        </li>
        <li>
          <a href="/data/mountains.json">mountains.json</a> — 44 山の名簿・平年値・最早・最遅
        </li>
        <li>
          <a href="/data/records.json">records.json</a> — 山岳コードごとの（寒候年, 値）
        </li>
        <li>
          <a href="/data/trend.json">trend.json</a> — 傾きと帰無分布（
          <Link href="/trend/">解説</Link>）
        </li>
        <li>
          <a href="/data/latest.json">latest.json</a> — 今季の山頂における積雪の状況
        </li>
        <li>
          <a href="/data/meta.json">meta.json</a> — 出典・定義・件数
        </li>
      </ul>

      <h2>数え上げ</h2>
      <div className="stats">
        <div className="stat">
          <span className="stat__label">行</span>
          <span className="stat__value nums">{meta.counts.rows.toLocaleString("ja-JP")}</span>
        </div>
        <div className="stat">
          <span className="stat__label">日付が入っている</span>
          <span className="stat__value nums">{meta.counts.dates.toLocaleString("ja-JP")}</span>
        </div>
        <div className="stat">
          <span className="stat__label">欠測（×）</span>
          <span className="stat__value nums">{meta.counts.missing}</span>
        </div>
        <div className="stat">
          <span className="stat__label">現象なし（--）</span>
          <span className="stat__value nums">{meta.counts.none}</span>
        </div>
      </div>
      <p className="small muted">
        いちばん古い行は {meta.counts.year_min} 寒候年、いちばん新しい行は {meta.counts.year_max} 寒候年。
        記号の意味は<Link href="/about/">観測の定義</Link>に書いた。
      </p>

      <h2>山ごとの全記録</h2>
      <p className="small muted">
        寒候年ごとの値は、各山のページの末尾に全行そのまま出してある。
      </p>
    </main>
  );
}
