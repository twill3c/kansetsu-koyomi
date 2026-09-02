/**
 * フリート共通フッタ規約の判定規則。
 *
 *   MIT License © 2026 坂田哲朗 ・ GitHub ・ <歩き方> ・ <設計図> ・ App Menu
 *
 * 検品器の中に規則を書くと、規則が壊れたときに誰も気づかない。
 * ここに切り出して、壊し方ごとの陽性対照つきで単体テストする。
 *
 * フリートで踏んだ罠を規則に織り込んである:
 *   - 「・」で分割して数えない。CSS の ::before で描くと innerText に出ず、
 *     規約どおりの並びを 1 項目と誤判定する。**出現順**で照合する
 *   - 「どれかのリンクが github.com を向いている」では足りない。MIT License の
 *     行き先も github.com なので、GitHub 項目が別ホストに化けても通る。
 *     文言が固定された項目は**その項目の行き先**を見る
 *   - 「・」の有無で数えない。断り書きの「実在の店舗・団体とは」に入るため。
 *     **項目のあいだに 4 個**という位置で見る
 *   - ブランチ名は規約ではない。`blob/<何か>/LICENSE` で見る
 */

export const APP_MENU = "https://app-menu-amber.vercel.app/";

/**
 * @param {{text: string, links: {label: string, href: string}[],
 *          position?: string, bottom?: string}} footer
 * @param {{repo: string}} opts
 * @returns {string[]} 違反の一覧。空なら規約どおり
 */
export function checkFooter(footer, opts) {
  const errs = [];
  const text = (footer.text ?? "").replace(/\s+/g, " ").trim();
  const links = footer.links ?? [];
  const repo = opts.repo;

  // --- 1. 5 項目が規約の順に現れる -----------------------------------------
  const ORDER = ["MIT License", "GitHub", "の歩き方", "の設計図", "App Menu"];
  let cursor = -1;
  for (const item of ORDER) {
    const at = text.indexOf(item, cursor + 1);
    if (at < 0) {
      errs.push(`項目が無い: ${item}`);
      continue;
    }
    cursor = at;
  }

  // --- 2. 著作権表示の位置 --------------------------------------------------
  const copy = "© 2026 坂田哲朗";
  const iCopy = text.indexOf(copy);
  const iMit = text.indexOf("MIT License");
  const iGh = text.indexOf("GitHub");
  if (iCopy < 0) {
    errs.push("著作権表示が無い");
  } else {
    if (!(iMit >= 0 && iCopy > iMit)) errs.push("著作権表示が MIT License より前にある");
    if (!(iGh >= 0 && iCopy < iGh)) errs.push("著作権表示が GitHub より後にある");
    const inLink = links.some((l) => l.label.includes(copy));
    if (inLink) errs.push("著作権表示がリンク文言の中にある");
  }

  // --- 3. 文言が固定された 3 項目の行き先 ----------------------------------
  const byLabel = (name) => links.find((l) => l.label.trim() === name);

  const mit = byLabel("MIT License");
  if (!mit) errs.push("MIT License がリンクになっていない");
  else if (!new RegExp(`^https://github\\.com/[^/]+/${repo}/blob/[^/]+/LICENSE$`).test(mit.href)) {
    errs.push(`MIT License の行き先が規約と違う: ${mit.href}`);
  }

  const gh = byLabel("GitHub");
  if (!gh) errs.push("GitHub がリンクになっていない");
  else if (!new RegExp(`^https://github\\.com/[^/]+/${repo}/?$`).test(gh.href)) {
    errs.push(`GitHub の行き先が規約と違う: ${gh.href}`);
  }

  const menu = byLabel("App Menu");
  if (!menu) errs.push("App Menu がリンクになっていない");
  else if (menu.href.replace(/\/$/, "") !== APP_MENU.replace(/\/$/, "")) {
    errs.push(`App Menu の行き先が規約と違う: ${menu.href}`);
  }

  // --- 4. 解説 2 本がアーティファクトを向いている --------------------------
  for (const kind of ["の歩き方", "の設計図"]) {
    const a = links.find((l) => l.label.includes(kind));
    if (!a) errs.push(`${kind} がリンクになっていない`);
    else if (!/^https:\/\/claude\.ai\/code\/artifact\/[0-9a-f-]{36}$/.test(a.href)) {
      errs.push(`${kind} の行き先がアーティファクトでない: ${a.href}`);
    }
  }

  // --- 5. 区切りが項目のあいだに 4 個 --------------------------------------
  const between = text.slice(iMit >= 0 ? iMit : 0, text.indexOf("App Menu") + "App Menu".length);
  const seps = (between.match(/・/g) ?? []).length;
  if (seps !== 4) errs.push(`項目のあいだの「・」が ${seps} 個(規約は 4 個)`);

  // --- 6. 下部固定 ---------------------------------------------------------
  if (footer.position !== undefined && footer.position !== "fixed") {
    errs.push(`position が fixed でない: ${footer.position}`);
  }
  if (footer.bottom !== undefined && parseFloat(footer.bottom) !== 0) {
    errs.push(`bottom が 0 でない: ${footer.bottom}`);
  }

  return errs;
}
