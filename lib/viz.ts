/** 図の骨格。座標は決め打ちせず、必ずデータから作る(HC-045)。 */

export type Scale = (v: number) => number;

export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** 目盛りの値を「きりのよい」間隔で作る。 */
export function niceTicks(lo: number, hi: number, target = 6): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** 連続する年の区間に切る。欠測の年で線を切るため。 */
export function runs<T extends { year: number; index: number | null }>(pts: T[]): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  for (const p of pts) {
    if (p.index === null) {
      if (cur.length) out.push(cur);
      cur = [];
      continue;
    }
    if (cur.length && p.year !== cur[cur.length - 1].year + 1) {
      out.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** 度数分布。bin は左閉右開。 */
export function histogram(values: number[], lo: number, hi: number, width: number) {
  const n = Math.max(1, Math.ceil((hi - lo) / width));
  const bins = Array.from({ length: n }, (_, i) => ({
    lo: lo + i * width,
    hi: lo + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const i = Math.min(n - 1, Math.max(0, Math.floor((v - lo) / width)));
    bins[i].count += 1;
  }
  return bins;
}

export function median(xs: number[]): number {
  if (!xs.length) throw new Error("空の配列の中央値は取れない");
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
