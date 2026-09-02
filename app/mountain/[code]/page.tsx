import Link from "next/link";

import { DistChart } from "@/components/DistChart";
import { MountainGlyph } from "@/components/MountainGlyph";
import { SeriesChart } from "@/components/SeriesChart";
import { formatSlash, formatSlashFull, indexOf, parseAsof } from "@/lib/calendar";
import { SNOW_BANDS, byCode, latest, latestFor, meta, mountains, series, trend } from "@/lib/data";

export function generateStaticParams() {
  return mountains.map((m) => ({ code: m.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const m = byCode.get(code);
  return { title: m ? `${m.name}の初冠雪 — 初冠雪ごよみ` : "初冠雪ごよみ" };
}

export default async function MountainPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const m = byCode.get(code)!;
  const pts = series(code);
  const dated = pts.filter((p) => p.index !== null) as Array<{
    year: number;
    value: string;
    index: number;
  }>;

  const asof = parseAsof(latest.asof);
  const today = indexOf(asof.year, asof.month, asof.day);
  const row = latestFor(m.name);
  const band = row ? (SNOW_BANDS[row.band] ?? SNOW_BANDS.other) : SNOW_BANDS.other;
  const cappedThisSeason = row !== undefined && row.date !== "--";

  const toRecord = m.latest.index - today.index;
  const slope = trend.slopes[code];
  const excluded = trend.excluded.find((e) => e.code === code);

  const idx = mountains.findIndex((x) => x.code === code);
  const prev = mountains[(idx - 1 + mountains.length) % mountains.length];
  const next = mountains[(idx + 1) % mountains.length];

  return (
    <main>
      <p className="small muted">
        <Link href="/">今日の山</Link> ／ 気象庁の一覧 {m.order} 番
      </p>
      <div className="peakhead">
        <MountainGlyph step={band.step} title={m.name} code={m.code} size={64} />
        <div>
          <h1>
            {m.name}
            <span className="peakhead__kana">{m.kana}</span>
          </h1>
          <p className="lede small">
            {m.office}から観測。{m.first_year}〜{m.last_year} 寒候年の {m.n_rows} 行のうち、
            日付が入っているのは {m.n_dates} 年。
          </p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat__label">平年日（{m.normal_period}）</span>
          <span className="stat__value">{m.normal}</span>
          <span className="small muted">資料年数 {m.sample_years} 年</span>
        </div>
        <div className="stat">
          <span className="stat__label">最も早かった年</span>
          <span className="stat__value">{formatSlash(m.earliest.date.replaceAll("-", "/"))}</span>
          <span className="small muted">{m.earliest.year} 寒候年</span>
        </div>
        <div className="stat">
          <span className="stat__label">最も遅かった年</span>
          <span className="stat__value">{formatSlash(m.latest.date.replaceAll("-", "/"))}</span>
          <span className="small muted">{m.latest.year} 寒候年</span>
        </div>
        <div className="stat">
          <span className="stat__label">今季（{today.kanko} 寒候年）</span>
          <span className="stat__value">{cappedThisSeason ? row!.date : "まだ"}</span>
          <span className="small muted">{row?.snow ?? "資料なし"}</span>
        </div>
      </div>

      {!cappedThisSeason && (
        <div className="note">
          {today.index < m.normal_index ? (
            <>
              平年日まであと <strong>{m.normal_index - today.index} 日</strong>。
            </>
          ) : (
            <>
              平年日から <strong>{today.index - m.normal_index} 日</strong> が過ぎた。
            </>
          )}{" "}
          {toRecord > 0 ? (
            <>
              このまま <strong>{toRecord} 日</strong> 冠雪が出なければ、
              {m.latest.year} 寒候年（{formatSlashFull(m.latest.date.replaceAll("-", "/"))}）を超えて
              観測史上もっとも遅い記録になる。
            </>
          ) : (
            <>今季はすでに、これまでの最遅記録より遅い日に入っている。</>
          )}
        </div>
      )}

      <h2>{m.first_year}〜{m.last_year} 寒候年</h2>
      <div className="figure">
        <p className="figure__title">{m.name}の初冠雪日</p>
        <p className="figure__sub">
          縦軸は寒候年のなかの日付（8 月 1 日起点）。横軸は寒候年。線は連続した年だけをつなぐ。
        </p>
        <SeriesChart
          points={pts}
          normalIndex={m.normal_index}
          normalLabel={m.normal}
          name={m.name}
        />
        <ul className="legend">
          <li>
            <i style={{ background: "var(--series)" }} />
            初冠雪日
          </li>
          <li>
            <i style={{ background: "var(--accent)" }} />
            平年日 {m.normal}
          </li>
          <li>
            <i style={{ background: "var(--critical)" }} />
            最早・最遅 ／ 冠雪の記録なし（{m.n_none} 年）
          </li>
          <li>
            <i style={{ background: "var(--ink-muted)" }} />
            欠測（{m.n_missing} 年）
          </li>
        </ul>
      </div>

      <h2>どのあたりに集まるか</h2>
      <div className="figure">
        <p className="figure__title">初冠雪日の分布（5 日ごと・{dated.length} 年）</p>
        <p className="figure__sub">
          全期間の {dated.length} 年を 5 日きざみで数えたもの。平年日と最遅記録の位置を重ねてある。
        </p>
        <DistChart
          indices={dated.map((p) => p.index)}
          normalIndex={m.normal_index}
          normalLabel={m.normal}
          latestIndex={m.latest.index}
          latestLabel={formatSlash(m.latest.date.replaceAll("-", "/"))}
          todayIndex={today.index}
          name={m.name}
        />
      </div>

      <h2>この山の傾き</h2>
      {slope !== undefined ? (
        <p>
          {trend.window_from} 寒候年以降を直線で当てると{" "}
          <strong className="nums">
            {slope > 0 ? "+" : ""}
            {slope.toFixed(1)} 日 / 100 年
          </strong>
          （{slope > 0 ? "遅くなる" : "早くなる"}向き）。別の推定量（Theil–Sen）では{" "}
          <span className="nums">
            {trend.theil_sen.slopes[code] > 0 ? "+" : ""}
            {trend.theil_sen.slopes[code].toFixed(1)}
          </span>{" "}
          日 / 100 年。<Link href="/trend/">44 山まとめて測った結果はこちら</Link>。
        </p>
      ) : (
        <p>
          この山は傾きの計算から外してある（{excluded?.reason ?? "条件を満たさない"}
          {excluded?.count !== undefined ? `・${excluded.count} 年` : ""}）。
          冠雪が観測されなかった年をどう数えるかで答えが変わるため、
          <Link href="/trend/">まとめの画面</Link>では入れた場合の対照も出している。
        </p>
      )}

      {m.name === "富士山" && (
        <>
          <h2>富士山だけの決まり</h2>
          <blockquote className="jma">
            {meta.definition.fuji_exception}
            <cite>気象庁「初冠雪の観測」（{meta.definition.issued}）</cite>
          </blockquote>
          <p className="small">
            この決まりは記録を動かす。2022 寒候年には、いったん 2021 年 9 月 7 日として発表された初冠雪が、
            その後 9 月 20 日に日平均気温の最高値が出たために取り消され、
            {formatSlashFull(records2022(code))} に置き換わった。
            「白くなった日」ではなく「定義を満たした日」が記録になる、という一例である。
          </p>
        </>
      )}

      <h2>全記録</h2>
      <p className="small muted">
        {m.first_year}〜{m.last_year} 寒候年の {m.n_rows} 行。気象庁の公表値のまま並べてある
        （<span className="v-miss">×</span> は欠測、<span className="v-none">--</span> は
        その寒候年に冠雪が観測されなかったことを表す）。
      </p>
      <ul className="yearlist">
        {pts.map((p) => (
          <li key={p.year}>
            <span className="muted">{p.year}</span>
            <span
              className={p.value === "×" ? "v-miss" : p.value === "--" ? "v-none" : undefined}
            >
              {p.index === null ? p.value : formatSlash(p.value)}
            </span>
          </li>
        ))}
      </ul>

      <nav className="pager">
        <Link href={`/mountain/${prev.code}/`}>← {prev.name}</Link>
        <Link href={`/mountain/${next.code}/`}>{next.name} →</Link>
      </nav>
    </main>
  );
}

/** 2022 寒候年の値を記録から引く。文中の日付を手で書かないため(HC-045)。 */
function records2022(code: string): string {
  const p = series(code).find((x) => x.year === 2022);
  if (!p || p.index === null) throw new Error("2022 寒候年の日付が記録に無い");
  return p.value;
}
