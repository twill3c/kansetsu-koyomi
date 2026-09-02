/**
 * 山のしるし。
 *
 * **形は何も表していない。** 標高は使っていない(「東方連山」「讃岐山脈」のように
 * 単一の峰でない対象があり、標高が定義できないため — SPEC §9)。
 * 変わるのは**冠の深さ**だけで、それは気象庁の今季の積雪階級(0〜7 段)そのものである。
 */

export const CAP_STEPS = 7;

export function MountainGlyph({
  step,
  title,
  code,
  size = 44,
}: {
  /** 0 = 積雪なし。1..7 は気象庁の色階級(0/5/20/50/100/150/200cm 以上)。 */
  step: number;
  title: string;
  /** clipPath の id に使う。山岳コード(気象庁の記録ページ番号)。 */
  code: string;
  size?: number;
}) {
  const w = size;
  const h = Math.round(size * 0.62);
  const capped = step > 0;
  // 冠の下端。段が上がるほど深く白くなる。0 段のときは描かない。
  const frac = capped ? 0.16 + (0.5 * (step - 1)) / (CAP_STEPS - 1) : 0;
  const yCap = h * frac;
  // 稜線は左右対称の折れ線。頂点 (w/2, 0)、裾 (0,h) と (w,h)。
  const xLeft = (w / 2) * frac;
  const xRight = w - xLeft;
  const id = `cap-${code}-${size}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label={`${title}: ${capped ? `積雪階級 ${step}` : "積雪なし"}`}
      focusable="false"
    >
      <title>{title}</title>
      <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} fill="var(--rock)" />
      {capped && (
        <>
          <clipPath id={id}>
            <polygon points={`${w / 2},0 ${xRight},${yCap} ${xLeft},${yCap}`} />
          </clipPath>
          <polygon
            points={`${w / 2},0 ${w},${h} 0,${h}`}
            fill="var(--snow)"
            clipPath={`url(#${id})`}
          />
          <line
            x1={xLeft}
            y1={yCap}
            x2={xRight}
            y2={yCap}
            stroke="var(--snow-line)"
            strokeWidth={1}
          />
        </>
      )}
    </svg>
  );
}
