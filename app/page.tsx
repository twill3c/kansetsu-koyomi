import Link from "next/link";

import { PeakGrid, type Peak } from "@/components/PeakGrid";
import { formatSlash, indexOf, parseAsof } from "@/lib/calendar";
import { SNOW_BANDS, latest, latestFor, meta, mountains, series } from "@/lib/data";
import { median } from "@/lib/viz";

export default function Home() {
  const asof = parseAsof(latest.asof);
  const { kanko, index } = indexOf(asof.year, asof.month, asof.day);

  const peaks: Peak[] = mountains.map((m) => {
    const row = latestFor(m.name);
    const band = row ? (SNOW_BANDS[row.band] ?? SNOW_BANDS.other) : SNOW_BANDS.other;
    return {
      code: m.code,
      order: m.order,
      name: m.name,
      kana: m.kana,
      station: m.station,
      normal: m.normal,
      normalIndex: m.normal_index,
      step: band.step,
      snow: row?.snow ?? "資料なし",
      capDate: row?.date ?? "--",
      daysFromNormal: index - m.normal_index,
    };
  });

  const capped = peaks.filter((p) => p.capDate !== "--").length;
  const byNormal = [...peaks].sort((a, b) => a.normalIndex - b.normalIndex);
  const first = byNormal[0];
  const last = byNormal[byNormal.length - 1];

  // 富士山の「平均と中央値のずれ」は、この場でこの記録から出す(HC-045)。
  const fuji = mountains.find((m) => m.name === "富士山")!;
  const fujiWindow = series(fuji.code).filter(
    (p) => p.index !== null && p.year >= 1992 && p.year <= 2021,
  );
  const fujiMedian = median(fujiWindow.map((p) => p.index as number));
  const fujiMedianLabel = formatSlash(
    fujiWindow.find((p) => p.index === fujiMedian)?.value ??
      fujiWindow.reduce((a, b) =>
        Math.abs((b.index as number) - fujiMedian) < Math.abs((a.index as number) - fujiMedian) ? b : a,
      ).value,
  );

  return (
    <main>
      <h1>{kanko} 寒候年の初冠雪</h1>
      <p className="lede">
        気象庁は全国 44 の山で、冬の入口を「山頂が白く見えた日」として記録してきた。
        いちばん古い記録は {meta.counts.year_min} 寒候年、いちばん有名な記録は 1895 寒候年から続く富士山である。
        この画面は今季の 44 山と、その平年日を並べたもの。山を押すと、その山の全記録が出る。
      </p>

      <div className="stats">
        <div className="stat">
          <span className="stat__label">今季 冠雪が出た山</span>
          <span className="stat__value nums">
            {capped}
            <span className="stat__unit">/ 44</span>
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">いちばん早い平年日</span>
          <span className="stat__value">{first.normal}</span>
          <span className="small muted">{first.name}（{first.station}）</span>
        </div>
        <div className="stat">
          <span className="stat__label">いちばん遅い平年日</span>
          <span className="stat__value">{last.normal}</span>
          <span className="small muted">{last.name}（{last.station}）</span>
        </div>
        <div className="stat">
          <span className="stat__label">記録の総数</span>
          <span className="stat__value nums">
            {meta.counts.rows.toLocaleString("ja-JP")}
            <span className="stat__unit">行</span>
          </span>
          <span className="small muted">日付 {meta.counts.dates.toLocaleString("ja-JP")}</span>
        </div>
      </div>

      <div className="note">
        <strong>今季の値は、これまでと同じものではない。</strong>
        {meta.method_change.note}
        目視で数えた {meta.method_change.last_visual_year} 寒候年までの記録と、
        {meta.method_change.first_analysis_year} 寒候年からの値を、同じ線の上に置いてはいけない。
        <Link href="/about/">観測の定義</Link>にくわしく書いた。
      </div>

      <PeakGrid
        peaks={peaks}
        todayLabel={`${asof.year}年${asof.month}月${asof.day}日 ${asof.hour} 時`}
      />

      <h2>この記録の読み方</h2>
      <dl className="deflist">
        <dt>初冠雪は「降った日」ではない</dt>
        <dd>
          気象台から山頂が白く見えた日である。雲が続けば、雪が降っていても記録は後ろへずれる。
          この一点が、以下すべての数字の性格を決めている。
        </dd>
        <dt>平年日は 30 年の平均であって、ふつうの年ではない</dt>
        <dd>
          統計期間は {fuji.normal_period}。8 月の初冠雪のような外れ値が入ると、平均はそちらへ引かれる。
          富士山の平年は {fuji.normal} だが、同じ 30 年の中央は {fujiMedianLabel} である。
        </dd>
        <dt>「まだ」の年がある</dt>
        <dd>
          その寒候年に一度も冠雪が観測されなければ「記録なし」になる（全体で {meta.counts.none} 件）。
          戦中戦後には欠測も多い（{meta.counts.missing} 件）。どちらも空白として描き、0 で埋めない。
        </dd>
      </dl>
      <p>
        <Link href="/trend/">44 山の記録を並べて、初冠雪が遅くなっているかを測った →</Link>
      </p>
    </main>
  );
}
