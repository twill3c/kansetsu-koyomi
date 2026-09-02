import type { Metadata } from "next";
import Link from "next/link";

import { crosscheck, discarded, meta, mountains, records } from "@/lib/data";

export const metadata: Metadata = {
  title: "観測の定義 — 初冠雪ごよみ",
  description:
    "初冠雪は「山が白くなった日」ではなく「気象台からそう見えた日」である。気象庁の定義・寒候年・記号・富士山の例外・2026 寒候年での終了までを書く。",
};

export default function AboutPage() {
  const fuji = mountains.find((m) => m.name === "富士山")!;
  const crossN =
    Object.keys(crosscheck["富士山"]).length + Object.keys(crosscheck["甲斐駒ヶ岳"]).length;
  const oldest = mountains.reduce((a, b) => (b.first_year < a.first_year ? b : a));

  return (
    <main>
      <h1>観測の定義</h1>
      <p className="lede">
        この画面の数字は、すべて気象庁が公開している記録である。加工したのは並べ方だけで、
        平年値も日付も公表値をそのまま出している。ただし、その公表値が何を数えたものなのかは、
        知らずに読むと確実に取り違える。ここに書いておく。
      </p>

      <h2>冠雪とは何か</h2>
      <blockquote className="jma">
        {meta.definition.kansetsu}
        <cite>気象庁「初冠雪の観測」（{meta.definition.issued}）</cite>
      </blockquote>
      <blockquote className="jma">
        {meta.definition.hatsukansetsu}
        <cite>同上</cite>
      </blockquote>
      <p>
        <strong>「気象台から初めて見えた時」である。</strong>
        山に雪が降った日ではない。雲が数日続けば、雪が積もっていても記録は後ろへずれる。
        逆に、遠くから白く見えさえすれば量は問わない。この一点が、
        <Link href="/trend/">傾きの画面</Link>で測った数字の性格も決めている。
      </p>

      <h2>寒候年</h2>
      <p>
        前年 8 月 1 日から当年 7 月 31 日まで。{meta.method_change.first_analysis_year} 寒候年なら
        {meta.method_change.first_analysis_year - 1} 年 8 月 1 日から
        {meta.method_change.first_analysis_year} 年 7 月 31 日である。
        年をまたぐ冬をひとつの単位にするための数え方で、暦年とは 1 ずれる。
        この画面の横軸・見出しの「◯◯ 寒候年」はすべてこの意味である。
      </p>
      <p className="small muted">
        たとえば富士山の 2024 年 11 月 7 日（統計開始以来もっとも遅い記録）は、
        <strong>2025 寒候年</strong>の値として記録されている。
      </p>

      <h2>富士山だけの決まり</h2>
      <blockquote className="jma">
        {meta.definition.fuji_exception}
        <cite>気象庁「初冠雪の観測」（{meta.definition.issued}）</cite>
      </blockquote>
      <p>
        高い山では夏のあいだにも冠雪が見えることがあるため、富士山だけは
        「その年の暑さの頂上を過ぎたあと」という条件が付く。
        条件は記録を動かす。2022 寒候年には、いったん 2021 年 9 月 7 日として発表された初冠雪が、
        その後 9 月 20 日に日平均気温の最高値が出たため取り消され、
        記録は {fujiValue(2022)} になった。
      </p>

      <h2>記号</h2>
      <dl className="deflist">
        <dt>×（欠測）</dt>
        <dd>
          観測できなかった年。全体で {meta.counts.missing} 件あり、1940 年代・1950 年代に集中する。
          「初冠雪が無かった」という意味ではない。
        </dd>
        <dt>--（該当現象なし）</dt>
        <dd>
          その寒候年に一度も冠雪が観測されなかった年。全体で {meta.counts.none} 件。
          日付が無いので折れ線には載らず、図では別の帯に描いている。
          <Link href="/trend/">傾きの計算</Link>では、この年を持つ山を外したうえで、
          外さなかった場合の対照も出している。
        </dd>
      </dl>
      <p className="small muted">
        欠測も「なし」も 0 では埋めない。埋めると、雪が降らなかった年と観測できなかった年が
        同じ絵になる。
      </p>

      <h2>平年値</h2>
      <p>
        統計期間 {fuji.normal_period} の平均である（気象庁の公表値）。
        <strong>この画面では自前で計算し直した値を出していない。</strong>
        再計算は照合にだけ使っていて、{mountains.length} 山のうち「なし」を含まない山では
        公表値との差が 1 日以内、含む 4 山では 2 日以内に収まることを検査（G-03）で押さえている。
        「なし」の年をどう数えるかで、平年値は 2 日ほど動く。
      </p>
      <p>
        よくある読み違いは「平年値 = ふつうの年」である。平年値は平均なので、
        8 月の初冠雪のような外れ値に引かれる。ただし、それが効いているかどうかは測った結果、
        44 山の中央で {discarded.later_than_normal.median_skew_days.toFixed(1)} 日しかなかった。
        詳しくは<Link href="/trend/">測って捨てた話</Link>に書いた。
      </p>

      <h2>{meta.method_change.last_visual_year} 寒候年で、目視の観測は終わった</h2>
      <div className="note">
        <strong>{meta.method_change.note}</strong>
      </div>
      <p>
        この画面の折れ線は {meta.counts.year_min}〜{meta.method_change.last_visual_year} 寒候年、
        つまり人が見て記録した最後の年までである。トップに出ている今季（
        {meta.method_change.first_analysis_year} 寒候年）の状態は、
        気象庁が解析積雪深から出している別の量なので、折れ線には足していない。
        {oldest.name}（{oldest.station}）の {oldest.first_year} 寒候年から数えて、
        目視の記録は {meta.method_change.last_visual_year - oldest.first_year + 1} 年ぶん残った。
      </p>

      <h2>確かめたこと</h2>
      <ul>
        <li>
          <strong>名簿は三つの経路で一致する。</strong>
          記録ページの索引・観測方法 PDF の対象山一覧・過去の気象データ検索の平年値ページ、
          どれから数えても {mountains.length} 山で、集合が完全に一致する。
        </li>
        <li>
          <strong>資料年数が合う。</strong>
          平年値ページが公表している「資料年数」と、記録ページで {fuji.normal_period} に
          日付が入っている年の数が、{mountains.length} 山すべてで一致する。別々の製品どうしの突合なので、
          どちらかを前提にした確認ではない。
        </li>
        <li>
          <strong>富士山と甲斐駒ヶ岳は二経路で照合した。</strong>
          甲府地方気象台が地上気象観測原簿から起こした一覧（1894–2024 年・観測年表記）と、
          記録ページ（寒候年表記）を突き合わせて {crossN} 件、
          <strong>不一致 0 件</strong>。年の数え方が違うので、写しの比較にはならない。
        </li>
        <li>
          <strong>図に出る数字は、図と同じデータから出している。</strong>
          本文の割合や日数も、この場でデータから計算していて、原稿に書き写した定数ではない。
        </li>
      </ul>

      <h2>出典</h2>
      <ul className="small">
        {meta.sources.map((s) => (
          <li key={s.id}>
            {s.id}: <a href={s.url}>{s.title}</a>
          </li>
        ))}
      </ul>
      <p className="small muted">
        データの作成 {meta.generated}。生の JSON と CSV は<Link href="/table/">表とデータ</Link>から取れる。
      </p>
    </main>
  );
}

/** 本文に出す日付は、記録から引く(HC-045)。 */
function fujiValue(year: number): string {
  const fuji = mountains.find((m) => m.name === "富士山")!;
  const row = records[fuji.code].find(([y]) => y === year);
  if (!row || !row[1].includes("/")) throw new Error(`${year} 寒候年の富士山の日付が記録に無い`);
  const [y, m, d] = row[1].split("/").map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}
