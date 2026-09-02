/**
 * 寒候年(前年 8/1 から当年 7/31)まわりの暦。
 *
 * 位置に使う「日数」と、画面に出す「日付」を分けている。
 * 日数 → 日付の変換は**うるう年で 1 日ずれる**(2 月をまたぐ 4 件が該当する)ので、
 * 目盛り以外には使わない。データの日付は必ず元の文字列から出す。
 */

/** 寒候年の起点(8/1)から数えた日数。1 年は 365 とみなす(目盛り用)。 */
export const YEAR_DAYS = 365;

/** 寒候年の並びでの月と、その 1 日が起点から何日目か(平年の暦)。 */
export const MONTH_STARTS: ReadonlyArray<readonly [month: number, index: number]> = [
  [8, 0],
  [9, 31],
  [10, 61],
  [11, 92],
  [12, 122],
  [1, 153],
  [2, 184],
  [3, 212],
  [4, 243],
  [5, 273],
  [6, 304],
  [7, 334],
];

const MONTH_INDEX = new Map(MONTH_STARTS.map(([m, i]) => [i, m]));

/** その日付が属する寒候年。 */
export function kankoYear(y: number, m: number): number {
  return m >= 8 ? y + 1 : y;
}

/** 'YYYY/MM/DD' を寒候年の起点からの日数に直す。 */
export function dayIndex(slash: string): number {
  const [y, m, d] = slash.split("/").map(Number);
  const origin = Date.UTC(kankoYear(y, m) - 1, 7, 1);
  return Math.round((Date.UTC(y, m - 1, d) - origin) / 86400000);
}

/** 'YYYY/MM/DD' を「10月23日」に直す。**データの日付はここを通す**。 */
export function formatSlash(slash: string): string {
  const [, m, d] = slash.split("/").map(Number);
  return `${m}月${d}日`;
}

/** 'YYYY/MM/DD' を「2025年10月23日」に直す。 */
export function formatSlashFull(slash: string): string {
  const [y, m, d] = slash.split("/").map(Number);
  return `${y}年${m}月${d}日`;
}

/**
 * 月初の日数を「10月」に直す。**月初以外を渡すと落ちる。**
 * 日数から日付を作ってよいのは目盛りだけ、という前提をここで固定する。
 */
export function tickLabel(index: number): string {
  const m = MONTH_INDEX.get(index);
  if (m === undefined) {
    throw new Error(`tickLabel は月初の日数にだけ使える(受け取った値: ${index})`);
  }
  return `${m}月`;
}

/** 描く範囲に入る月初の目盛りを返す。 */
export function ticksIn(lo: number, hi: number): Array<{ index: number; label: string }> {
  return MONTH_STARTS.filter(([, i]) => i >= lo && i <= hi).map(([, i]) => ({
    index: i,
    label: tickLabel(i),
  }));
}

/** 日数の差を「7 日早い」「3 日遅い」の形にする。 */
export function relative(days: number): string {
  if (days === 0) return "平年と同じ";
  return days > 0 ? `平年より ${days} 日遅い` : `平年より ${-days} 日早い`;
}

/**
 * 気象庁の「時点」文字列 'YYYY-MM-DDTHH:00+09:00' を数に分ける。
 *
 * **Date に通して getFullYear() を使ってはならない。** 実行環境の時間帯で日付が動き、
 * ビルドする場所によって画面の日付が変わる(Vercel は UTC で走る)。
 */
export function parseAsof(s: string): { year: number; month: number; day: number; hour: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):\d{2}\+09:00$/.exec(s);
  if (!m) throw new Error(`時点として読めない: ${s}`);
  return { year: +m[1], month: +m[2], day: +m[3], hour: +m[4] };
}

/** その日が属する寒候年と、起点から数えた日数。 */
export function indexOf(year: number, month: number, day: number): { kanko: number; index: number } {
  const kanko = kankoYear(year, month);
  const origin = Date.UTC(kanko - 1, 7, 1);
  return { kanko, index: Math.round((Date.UTC(year, month - 1, day) - origin) / 86400000) };
}
