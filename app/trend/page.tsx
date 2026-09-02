import type { Metadata } from "next";
import Link from "next/link";

import { NullChart } from "@/components/NullChart";
import { SlopeChart, type SlopeRow } from "@/components/SlopeChart";
import { byCode, discarded, meta, mountains, trend } from "@/lib/data";

export const metadata: Metadata = {
  title: "遅くなっている — 初冠雪ごよみ",
  description:
    `${trend.window_from} 寒候年以降、条件を満たす ${trend.n_mountains} 山のうち ${trend.n_positive} 山で` +
    "初冠雪は遅くなる向きに動いている。帰無モデルと対照つきで示す。",
};

export default function TrendPage() {
  const rows: SlopeRow[] = Object.entries(trend.slopes).map(([code, ols]) => ({
    code,
    name: byCode.get(code)!.name,
    ols,
    ts: trend.theil_sen.slopes[code],
  }));
  const flipped = rows.filter((r) => r.ols > 0 !== r.ts > 0);
  const fujiSkew = discarded.later_than_normal.per_mountain.find((r) => r.name === "富士山")?.skew_days;
  // 打ち切って戻したとき負になる山と、そのうち「33 山の側」だったもの。
  // 前者だけを数えると「8 山で符号が変わる」と読めてしまうが、実際には 33 山は動かない。
  const censoredNegative = Object.entries(trend.censored.slopes).filter(([, v]) => v <= 0);
  const censoredFlipsInside = censoredNegative.filter(([code]) => trend.slopes[code] !== undefined);

  return (
    <main>
      <h1>初冠雪は遅くなっている</h1>
      <p className="lede">
        {trend.window_from} 寒候年以降、記録の途切れていない <strong>{trend.n_mountains} 山</strong> を
        直線で当てたところ、<strong>{trend.n_positive} 山すべて</strong>で
        「遅くなる」向きだった。中央値は{" "}
        <strong className="nums">+{trend.median_slope_per_century.toFixed(1)} 日 / 100 年</strong>。
        この主張は測る前に登録してあり、外れたら落ちるように検査（G-10）にしてある。
      </p>

      <div className="stats">
        <div className="stat">
          <span className="stat__label">遅くなる向きの山</span>
          <span className="stat__value nums">
            {trend.n_positive}
            <span className="stat__unit">/ {trend.n_mountains}</span>
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">傾きの中央値</span>
          <span className="stat__value nums">
            +{trend.median_slope_per_century.toFixed(1)}
            <span className="stat__unit">日 / 100 年</span>
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">偶然にこうなる確率</span>
          <span className="stat__value nums">{trend.null.p_positive.toFixed(4)}</span>
          <span className="small muted">置換 {trend.null.iterations.toLocaleString("ja-JP")} 回</span>
        </div>
        <div className="stat">
          <span className="stat__label">別の推定量でも正</span>
          <span className="stat__value nums">
            {trend.theil_sen.n_positive}
            <span className="stat__unit">/ {trend.n_mountains}</span>
          </span>
          <span className="small muted">Theil–Sen</span>
        </div>
      </div>

      <h2>山ごとの傾き</h2>
      <div className="figure">
        <p className="figure__title">
          {trend.window_from}–{meta.counts.year_max} 寒候年の傾き（日 / 100 年）
        </p>
        <p className="figure__sub">
          棒と塗りつぶした丸が最小二乗、白抜きの丸が Theil–Sen。右へ伸びるほど「遅くなっている」。
        </p>
        <SlopeChart rows={rows} />
        <ul className="legend">
          <li>
            <i style={{ background: "var(--series)" }} />
            最小二乗
          </li>
          <li>
            <i style={{ background: "transparent", borderColor: "var(--accent)", borderWidth: 2 }} />
            Theil–Sen（全対の傾きの中央値）
          </li>
        </ul>
      </div>

      <h2>偶然ではこうならない</h2>
      <p>
        44 の山は独立ではない。同じ寒気が北日本の山を同時に白くするので、「{trend.n_mountains} 山が
        そろって正だった」をそのまま証拠の量として数えることはできない。そこで帰無モデルは、
        <strong>全部の山に同じ年の入れ替えを当てる</strong>ことにした。山どうしの相関はそのまま残り、
        年と日付の対応だけが壊れる。
      </p>
      <div className="figure">
        <p className="figure__title">置換したときの「傾きの中央値」の分布</p>
        <p className="figure__sub">
          seed {trend.null.seed}・{trend.null.iterations.toLocaleString("ja-JP")} 回。
          置換後の中央値は {trend.null.median_of_median_slopes.toFixed(2)} 日 / 100 年で、
          モデルが偏っていないことを示す（検査 G-12）。
        </p>
        <NullChart
          values={trend.null.median_slopes_per_century}
          observed={trend.median_slope_per_century}
          binWidth={1}
          xLabel="傾きの中央値（日 / 100 年）"
          observedLabel={`+${trend.median_slope_per_century.toFixed(1)}`}
        />
      </div>
      <div className="figure">
        <p className="figure__title">置換したときの「正の傾きだった山の数」の分布</p>
        <p className="figure__sub">
          平均は {trend.null.mean_positive.toFixed(1)} 山。{trend.n_mountains} 山そろったのは
          {trend.null.iterations.toLocaleString("ja-JP")} 回中{" "}
          {trend.null.positive_counts.filter((v) => v >= trend.n_positive).length} 回だけだった。
        </p>
        <NullChart
          values={trend.null.positive_counts}
          observed={trend.n_positive}
          binWidth={1}
          xLabel="正の傾きだった山の数"
          observedLabel={`${trend.n_positive} 山`}
        />
      </div>

      <h2>この主張が届かないところ</h2>
      <div className="note">
        <strong>1. 「白くならなかった年」を持つ {trend.excluded.length} 山を外している。</strong>
        その年は日付が無いので直線に載らない。外したままにせず、寒候年の最終日で打ち切って
        44 山に戻すと{" "}
        <span className="nums">
          {trend.censored.n_positive} / {trend.censored.n_mountains}
        </span>{" "}
        山・中央値{" "}
        <span className="nums">+{trend.censored.median_slope_per_century.toFixed(1)} 日 / 100 年</span>。
        負に転じる <span className="nums">{censoredNegative.length}</span> 山は
        <strong>すべて外していた側</strong>で、
        {censoredFlipsInside.length === 0 ? "33 山の符号は一つも動かない" : `33 山のうち ${censoredFlipsInside.length} 山も動く`}。
        ただし打ち切りに使う「7 月 31 日」は観測ではないので、こちらを主たる結果にはしない
        —— 1960〜80 年代に集中する「なし」の年を最も遅い日に置くと、傾きは
        <span className="nums"> −131</span> 日 / 100 年のような、その置き方だけで決まる値になる。
      </div>
      <div className="note">
        <strong>
          2. 推定量を変えると {flipped.length} 山で向きが変わる。
        </strong>
        最小二乗を Theil–Sen に替えると{" "}
        {flipped.length === 0
          ? "すべての山で符号が一致する"
          : `${flipped.map((f) => f.name).join("・")}が負に転じる`}
        。8 月や 9 月初めの外れ値をどれだけ効かせるかで、境目の山は動く。
      </div>
      <div className="note">
        <strong>3. これは「山に雪が降った日」の傾きではない。</strong>
        初冠雪は気象台から白く見えた日である。観測の体制・見通し・都市化のような
        「見え方」の変化も、そのままこの傾きに入る。ここで測ったのは
        <strong>記録が遅くなっていること</strong>であって、その原因ではない。
      </div>

      <h2>外した山</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>山</th>
              <th>観測</th>
              <th>理由</th>
              <th className="num">件数</th>
              <th>その年</th>
            </tr>
          </thead>
          <tbody>
            {trend.excluded.map((e) => (
              <tr key={e.code}>
                <td>
                  <Link href={`/mountain/${e.code}/`}>{byCode.get(e.code)?.name ?? e.name}</Link>
                </td>
                <td>{byCode.get(e.code)?.station}</td>
                <td>{e.reason}</td>
                <td className="num nums">{e.count}</td>
                <td className="nums">{(e.years ?? []).join("・") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>測って捨てた話</h2>
      <p>
        最初に立てたのは別の主張だった。「平年値は平均だから、早い側の外れ値に引かれて、
        <strong>『平年より遅い』が多数派になっているはず</strong>」。
        {mountains[0].normal_period} の 30 年で数えると、平年日より遅かった年は平均{" "}
        <span className="nums">{discarded.later_than_normal.mean_ratio.toFixed(1)}%</span>、
        半分を超えた山は {mountains.length} 山中{" "}
        <span className="nums">{discarded.later_than_normal.n_over_half}</span> 山にとどまった。
        <strong>成り立たない。</strong>
        中央値と平均の差も、44 山の中央で{" "}
        <span className="nums">{discarded.later_than_normal.median_skew_days.toFixed(1)}</span> 日しかない。
        富士山だけは中央が{" "}
        <span className="nums">
          {fujiSkew !== undefined ? `${fujiSkew > 0 ? "+" : ""}${fujiSkew.toFixed(1)}` : "—"}
        </span>{" "}
        日ぶん遅く、この一山を見て一般化しかけていた。
      </p>
      <p>
        もうひとつ捨てたのは「見る場所が変われば日付が変わる」。富士山は{" "}
        {discarded.vantage.rows.map((r) => r.station).join("・")}でも観測されていた時期があり、
        別の場所から見た平年値が残っている。統計期間を揃えて甲府と突き合わせた結果:
      </p>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>観測した官署</th>
              <th>統計期間</th>
              <th>その官署の平年</th>
              <th>甲府の同期間平均</th>
              <th className="num">差</th>
              <th className="num">年数</th>
            </tr>
          </thead>
          <tbody>
            {discarded.vantage.rows.map((r) => (
              <tr key={r.page}>
                <td>{r.station ?? r.page}</td>
                <td className="nums">{r.period}</td>
                <td>{r.their_normal}</td>
                <td>{r.kofu_mean}</td>
                <td className="num nums">{r.diff_days} 日</td>
                <td className="num nums">{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        差は最大 {discarded.vantage.max_diff_days} 日。効果はあるが、単独の主張にするには小さい。
        「見えた日であって降った日ではない」という性質は、
        <Link href="/about/">観測の定義</Link>の側に残すことにした。
      </p>
    </main>
  );
}
