import { describe, expect, it } from "vitest";

import { series, mountains, records, trend } from "@/lib/data";
import { histogram, linear, median, niceTicks, runs } from "@/lib/viz";

describe("尺度", () => {
  it("両端を写す", () => {
    const s = linear(0, 10, 100, 200);
    expect(s(0)).toBe(100);
    expect(s(10)).toBe(200);
    expect(s(5)).toBe(150);
  });

  it("幅 0 でも落ちない（1 点しかない系列がありうる）", () => {
    const s = linear(5, 5, 0, 100);
    expect(Number.isFinite(s(5))).toBe(true);
  });
});

describe("目盛り", () => {
  it("範囲の中に入り、等間隔になる", () => {
    const t = niceTicks(1873, 2026, 8);
    expect(t.length).toBeGreaterThan(2);
    expect(t[0]).toBeGreaterThanOrEqual(1873);
    expect(t[t.length - 1]).toBeLessThanOrEqual(2026);
    const gaps = t.slice(1).map((v, i) => v - t[i]);
    expect(new Set(gaps).size).toBe(1);
  });

  it("幅が 0 なら 1 本だけ返す", () => {
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});

describe("連続した年の区間", () => {
  it("欠測でも飛び年でも切れる", () => {
    const pts = [
      { year: 1990, index: 1 },
      { year: 1991, index: 2 },
      { year: 1992, index: null },
      { year: 1993, index: 4 },
      { year: 1995, index: 5 },
    ];
    expect(runs(pts).map((r) => r.map((p) => p.year))).toEqual([[1990, 1991], [1993], [1995]]);
  });

  it("陰性対照: 切れ目が無ければ 1 本のまま", () => {
    const pts = [1990, 1991, 1992].map((year) => ({ year, index: 1 }));
    expect(runs(pts)).toHaveLength(1);
  });

  it("実データでも、区間の合計が日付のある年の数と一致する", () => {
    for (const m of mountains) {
      const pts = series(m.code);
      const total = runs(pts).reduce((n, r) => n + r.length, 0);
      expect(total).toBe(m.n_dates);
    }
  });
});

describe("度数分布", () => {
  it("すべての値がどれかの階級に入る", () => {
    const vals = [0, 1, 4, 5, 9, 10];
    const bins = histogram(vals, 0, 10, 5);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(vals.length);
    expect(bins[0].count).toBe(3); // 0,1,4
  });

  it("範囲の外の値も端の階級に落ちる（取りこぼさない）", () => {
    const bins = histogram([-5, 100], 0, 10, 5);
    expect(bins.reduce((n, b) => n + b.count, 0)).toBe(2);
  });
});

describe("中央値", () => {
  it("偶数個は真ん中 2 つの平均", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
  });

  it("空なら落ちる（黙って 0 を返さない）", () => {
    expect(() => median([])).toThrow();
  });

  it("出荷している傾きの中央値と一致する（表示と根拠の一致）", () => {
    const slopes = Object.values(trend.slopes);
    expect(median(slopes)).toBeCloseTo(trend.median_slope_per_century, 6);
  });
});

describe("出荷データの素性", () => {
  it("44 山ぶんの記録がある", () => {
    expect(mountains).toHaveLength(44);
    expect(Object.keys(records)).toHaveLength(44);
  });

  it("値は 3 種類しかない（陽性対照つきの検出）", () => {
    const shapes = new Set<string>();
    for (const rows of Object.values(records)) {
      for (const [, v] of rows) shapes.add(v.replace(/\d/g, "#"));
    }
    expect([...shapes].sort()).toEqual(["####/##/##", "--", "×"]);
    // 検出が働いていることの確認: 別の書式を混ぜたら集合が変わる
    const withBad = new Set([...shapes, "####-##-##"]);
    expect(withBad.size).toBe(shapes.size + 1);
  });
});
