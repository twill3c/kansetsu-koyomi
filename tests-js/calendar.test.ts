import { describe, expect, it } from "vitest";

import {
  MONTH_STARTS,
  YEAR_DAYS,
  dayIndex,
  formatSlash,
  formatSlashFull,
  indexOf,
  kankoYear,
  parseAsof,
  relative,
  tickLabel,
  ticksIn,
} from "@/lib/calendar";

describe("寒候年", () => {
  it("境界は 8/1 にある（出所: SPEC §2 の定義）", () => {
    expect(kankoYear(2025, 7)).toBe(2025);
    expect(kankoYear(2025, 8)).toBe(2026);
    expect(kankoYear(2025, 12)).toBe(2026);
    expect(kankoYear(2026, 1)).toBe(2026);
  });

  it("起点は 0 日目（出所: SPEC §2）", () => {
    expect(dayIndex("2025/08/01")).toBe(0);
  });

  it("実データの値で押さえる（出所: 気象庁の記録ページ・2026 寒候年の富士山）", () => {
    expect(dayIndex("2025/10/23")).toBe(83);
    expect(formatSlash("2025/10/23")).toBe("10月23日");
    expect(formatSlashFull("2024/11/07")).toBe("2024年11月7日");
  });

  it("年をまたいでも起点は前年の 8/1 のまま", () => {
    // 2026 寒候年 = 2025-08-01 起点。2026/02/09 は 8/1 から 192 日目。
    expect(dayIndex("2026/02/09")).toBe(192);
    expect(kankoYear(2026, 2)).toBe(2026);
  });
});

describe("月初の目盛り", () => {
  it("表の値が 8 月起点の累計と一致する（1 年 365 日の平年の暦）", () => {
    const lengths = [31, 30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 31]; // 8月〜7月
    let acc = 0;
    MONTH_STARTS.forEach(([, index], i) => {
      expect(index).toBe(acc);
      acc += lengths[i];
    });
    expect(acc).toBe(YEAR_DAYS);
  });

  it("月初以外を渡すと落ちる（日数から日付を作ってよいのは目盛りだけ）", () => {
    expect(tickLabel(0)).toBe("8月");
    expect(tickLabel(61)).toBe("10月");
    expect(() => tickLabel(62)).toThrow();
    expect(() => tickLabel(-1)).toThrow();
  });

  it("範囲に入る目盛りだけを返す", () => {
    const t = ticksIn(31, 122);
    expect(t.map((x) => x.label)).toEqual(["9月", "10月", "11月", "12月"]);
    expect(ticksIn(300, 302)).toEqual([]);
  });
});

describe("時点の文字列", () => {
  it("+09:00 の文字列をそのまま数に分ける（実行環境の時間帯に依存しない）", () => {
    expect(parseAsof("2026-09-02T11:00+09:00")).toEqual({
      year: 2026,
      month: 9,
      day: 2,
      hour: 11,
    });
  });

  it("形が違えば落ちる（陽性対照）", () => {
    expect(() => parseAsof("2026-09-02T11:00Z")).toThrow();
    expect(() => parseAsof("2026/09/02 11:00")).toThrow();
    expect(() => parseAsof("")).toThrow();
  });

  it("寒候年と日数を返す", () => {
    expect(indexOf(2026, 9, 2)).toEqual({ kanko: 2027, index: 32 });
    expect(indexOf(2026, 7, 31)).toEqual({ kanko: 2026, index: 364 });
  });
});

describe("平年との差の言い方", () => {
  it("符号で言い換える", () => {
    expect(relative(0)).toBe("平年と同じ");
    expect(relative(3)).toContain("遅い");
    expect(relative(-3)).toContain("早い");
    expect(relative(-3)).toContain("3 日");
  });
});
