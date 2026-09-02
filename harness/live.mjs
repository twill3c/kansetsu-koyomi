/**
 * 本番に対する検品。手元のビルドが通ることと、配られている木が正しいことは別である。
 *
 *   node harness/live.mjs [--url https://kansetsu-koyomi.vercel.app]
 *
 * 手元の out/ ではなく**本番の HTML** を引く。反映待ちで落ちることがあるので、
 * 落ちたら対象ではなく反映待ちをまず疑うこと。
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { chromium } from "playwright";

import { checkFooter } from "../scripts/footer-rule.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const BASE = (args[args.indexOf("--url") + 1] ?? "").startsWith("http")
  ? args[args.indexOf("--url") + 1].replace(/\/$/, "")
  : "https://kansetsu-koyomi.vercel.app";
const REPO = "kansetsu-koyomi";

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "  OK " : "  NG "} ${name}${detail ? `  — ${detail}` : ""}`);
}

const mountains = JSON.parse(await readFile(join(ROOT, "data/mountains.json"), "utf8"));
const meta = JSON.parse(await readFile(join(ROOT, "data/meta.json"), "utf8"));
const trend = JSON.parse(await readFile(join(ROOT, "data/trend.json"), "utf8"));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

try {
  console.log(`本番: ${BASE}`);

  // 全 44 山のページが配られている
  let ok = 0;
  const missing = [];
  for (const m of mountains) {
    const res = await page.request.get(`${BASE}/mountain/${m.code}/`);
    if (res.status() === 200) ok++;
    else missing.push(`${m.name}:${res.status()}`);
  }
  check("44 山のページがすべて 200", ok === 44, missing.slice(0, 3).join(" / ") || `${ok}/44`);

  for (const path of ["/", "/trend/", "/table/", "/about/"]) {
    const res = await page.request.get(`${BASE}${path}`);
    check(`${path} が 200`, res.status() === 200, String(res.status()));
  }

  // 配布物
  for (const f of ["records.csv", "mountains.json", "records.json", "trend.json", "meta.json", "latest.json"]) {
    const res = await page.request.get(`${BASE}/data/${f}`);
    check(`/data/${f} が配られている`, res.status() === 200, String(res.status()));
  }
  const csv = await (await page.request.get(`${BASE}/data/records.csv`)).text();
  const rows = csv.trim().split("\n").length - 1;
  check("CSV の行数が記録と一致", rows === meta.counts.rows, `${rows} / ${meta.counts.rows}`);

  // フッタ規約(本番の DOM で)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const footer = await page.evaluate(() => {
    const cands = [...document.querySelectorAll("footer, nav, div")].filter(
      (el) => el.innerText?.includes("App Menu") && el.innerText.includes("MIT License"),
    );
    const el = cands[cands.length - 1];
    if (!el) return null;
    let position = null;
    let bottom = null;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position === "fixed") {
        position = "fixed";
        bottom = cs.bottom;
        break;
      }
    }
    return {
      text: el.innerText,
      links: [...el.querySelectorAll("a")].map((a) => ({ label: a.innerText, href: a.href })),
      position: position ?? getComputedStyle(el).position,
      bottom: bottom ?? getComputedStyle(el).bottom,
    };
  });
  const errs = footer ? checkFooter(footer, { repo: REPO }) : ["フッタが見つからない"];
  check("本番のフッタが規約どおり", errs.length === 0, errs.slice(0, 2).join(" / "));

  // 中身が今のデータと一致している(古いビルドを配っていないか)
  const home = await page.locator("main").innerText();
  check("トップに記録の総数が出ている", home.includes(meta.counts.rows.toLocaleString("ja-JP")),
        meta.counts.rows.toLocaleString("ja-JP"));
  await page.goto(`${BASE}/trend/`, { waitUntil: "networkidle" });
  const t = await page.locator("main").innerText();
  check("傾きの画面が今の検定結果を出している",
        t.includes(`+${trend.median_slope_per_century.toFixed(1)}`) &&
          t.includes(`${trend.n_positive} 山すべて`),
        `+${trend.median_slope_per_century.toFixed(1)} / ${trend.n_positive} 山`);
} finally {
  await browser.close();
}

const ng = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - ng.length}/${checks.length} 合格`);
if (ng.length) process.exit(1);
