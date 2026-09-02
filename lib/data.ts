/** data/*.json を型付きで読む。ETL の出力をそのまま束ねるので、ここで加工はしない。 */

import crosscheckJson from "@/data/crosscheck.json";
import discardedJson from "@/data/discarded.json";
import latestJson from "@/data/latest.json";
import metaJson from "@/data/meta.json";
import mountainsJson from "@/data/mountains.json";
import recordsJson from "@/data/records.json";
import trendJson from "@/data/trend.json";

import { dayIndex } from "./calendar";

export const MISSING = "×";
export const NONE_MARK = "--";

export type Mountain = {
  code: string;
  order: number;
  name: string;
  kana: string;
  office: string;
  station: string;
  normal: string;
  normal_index: number;
  normal_period: string;
  sample_years: number;
  first_year: number;
  last_year: number;
  n_rows: number;
  n_dates: number;
  n_missing: number;
  n_none: number;
  earliest: { year: number; index: number; date: string };
  latest: { year: number; index: number; date: string };
};

export type Row = [year: number, value: string];

export type Meta = {
  generated: string;
  definition: {
    kansetsu: string;
    hatsukansetsu: string;
    fuji_exception: string;
    source: string;
    issued: string;
  };
  sources: Array<{ id: string; title: string; url: string }>;
  counts: {
    mountains: number;
    rows: number;
    dates: number;
    missing: number;
    none: number;
    year_min: number;
    year_max: number;
  };
  method_change: { last_visual_year: number; first_analysis_year: number; note: string };
};

export type Trend = {
  window_from: number;
  min_years: number;
  n_mountains: number;
  n_positive: number;
  median_slope_per_century: number;
  slopes: Record<string, number>;
  theil_sen: {
    note: string;
    slopes: Record<string, number>;
    n_positive: number;
    median_slope_per_century: number;
    sign_agreement: number;
  };
  excluded: Array<{ code: string; name: string; reason: string; count: number; years?: number[] }>;
  censored: {
    note: string;
    n_mountains: number;
    n_positive: number;
    median_slope_per_century: number;
    slopes: Record<string, number>;
  };
  null: {
    iterations: number;
    seed: number;
    model: string;
    positive_counts: number[];
    median_slopes_per_century: number[];
    p_positive: number;
    p_median: number;
    mean_positive: number;
    max_positive: number;
    median_of_median_slopes: number;
    q99_median_slope: number;
  };
};

export type Latest = {
  heading: string;
  asof: string;
  source: string;
  rows: Array<{ name: string; date: string; snow: string; band: string }>;
};

export const mountains = mountainsJson as Mountain[];
export const records = recordsJson as unknown as Record<string, Row[]>;
export const meta = metaJson as Meta;
export const trend = trendJson as unknown as Trend;
export const latest = latestJson as Latest;
export const crosscheck = crosscheckJson as unknown as Record<string, Record<string, string>>;


export type Discarded = {
  later_than_normal: {
    note: string;
    per_mountain: Array<{
      code: string;
      name: string;
      n: number;
      later: number;
      ratio: number;
      median_index: number;
      skew_days: number;
    }>;
    mean_ratio: number;
    n_over_half: number;
    median_skew_days: number;
  };
  vantage: {
    note: string;
    rows: Array<{
      page: string;
      station: string | null;
      mountain: string;
      period: string;
      their_normal: string;
      their_index: number;
      kofu_mean: string;
      kofu_index: number;
      diff_days: number;
      n: number;
    }>;
    max_diff_days: number;
  };
};

export const discarded = discardedJson as unknown as Discarded;

export const byCode = new Map(mountains.map((m) => [m.code, m]));
export const byName = new Map(mountains.map((m) => [m.name, m]));

/** 山ごとの、位置に使える系列。日付が無い年は index が null になる。 */
export type Point = { year: number; value: string; index: number | null };

export function series(code: string): Point[] {
  return records[code].map(([year, value]) => ({
    year,
    value,
    index: value.includes("/") ? dayIndex(value) : null,
  }));
}

/** 今季(2027 寒候年)の状態。名簿の表記に寄せて引く。 */
export function latestFor(name: string): Latest["rows"][number] | undefined {
  const key = name.replace("ケ", "ヶ");
  return latest.rows.find((r) => r.name.replace("ケ", "ヶ") === key);
}

export function isCapped(row: Latest["rows"][number] | undefined): boolean {
  return row !== undefined && row.date !== NONE_MARK && row.date !== "";
}

/** 積雪の色階級。気象庁の表の class 名をそのまま段に使う。 */
export const SNOW_BANDS: Record<string, { label: string; step: number }> = {
  none: { label: "積雪なし", step: 0 },
  ov000: { label: "0cm 以上", step: 1 },
  ov005: { label: "5cm 以上", step: 2 },
  ov020: { label: "20cm 以上", step: 3 },
  ov050: { label: "50cm 以上", step: 4 },
  ov100: { label: "100cm 以上", step: 5 },
  ov150: { label: "150cm 以上", step: 6 },
  ov200: { label: "200cm 以上", step: 7 },
  other: { label: "資料なし", step: 0 },
};
