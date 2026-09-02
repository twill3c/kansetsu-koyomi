/**
 * 実ブラウザでの検品。
 *
 * テストが緑でも画面が動かないことがあるので、出荷した out/ をそのまま配って、
 * 図が実際に描けているか・文字が重なっていないか・狭い幅で崩れていないかを DOM で数える。
 *
 *   node harness/smoke.mjs [--port 9471] [--shot]
 *
 * 検品器にも陽性対照を置く(HC-080)。判定規則は harness/smoke-rule.mjs に外出しし、
 * 壊し方ごとの単体テストを tests-js/ に置いてある。
 */
import { mkdir, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

import { chromium } from "playwright";

import { checkFooter } from "../scripts/footer-rule.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "out");
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf("--port") + 1]) || 9471;
const SHOT = args.includes("--shot");
const REPO = "kansetsu-koyomi";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let p = join(OUT, decodeURIComponent(req.url.split("?")[0]));
      const s = await stat(p).catch(() => null);
      if (s?.isDirectory()) p = join(p, "index.html");
      const body = await readFile(p);
      res.writeHead(200, { "Content-Type": MIME[extname(p)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
    }
  });
  return new Promise((ok) => server.listen(PORT, "127.0.0.1", () => ok(server)));
}

const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "  OK " : "  NG "} ${name}${detail ? `  — ${detail}` : ""}`);
}

/** 図の中の文字の重なりと、枠からのはみ出し。代理指標は目視の代わりではなく網である。 */
async function layoutIssues(page) {
  return page.evaluate(() => {
    const overlaps = [];
    const clipped = [];
    for (const svg of document.querySelectorAll(".figure svg, .peak svg")) {
      const frame = svg.getBoundingClientRect();
      const boxes = [...svg.querySelectorAll("text")]
        .map((t) => ({ t, r: t.getBoundingClientRect() }))
        .filter((b) => b.r.width > 0);
      for (const { t, r } of boxes) {
        if (
          r.left < frame.left - 0.5 ||
          r.right > frame.right + 0.5 ||
          r.top < frame.top - 0.5 ||
          r.bottom > frame.bottom + 0.5
        ) {
          clipped.push(t.textContent);
        }
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r;
          const b = boxes[j].r;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 1 && oy > 1) overlaps.push(`${boxes[i].t.textContent}×${boxes[j].t.textContent}`);
        }
      }
    }
    return { overlaps, clipped };
  });
}

/** フッタを「中身」で選ぶ。要素名で探さない(iro-koyomi の教訓)。 */
async function readFooter(page) {
  return page.evaluate(() => {
    const cands = [...document.querySelectorAll("footer, nav, div")].filter(
      (el) => el.innerText?.includes("App Menu") && el.innerText.includes("MIT License"),
    );
    const el = cands[cands.length - 1];
    if (!el) return null;
    let fixed = null;
    let bottom = null;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position === "fixed") {
        fixed = "fixed";
        bottom = cs.bottom;
        break;
      }
    }
    return {
      text: el.innerText,
      links: [...el.querySelectorAll("a")].map((a) => ({ label: a.innerText, href: a.href })),
      position: fixed ?? getComputedStyle(el).position,
      bottom: bottom ?? getComputedStyle(el).bottom,
      height: el.getBoundingClientRect().height,
    };
  });
}

const mountains = JSON.parse(await readFile(join(OUT, "data/mountains.json"), "utf8"));
const records = JSON.parse(await readFile(join(OUT, "data/records.json"), "utf8"));
const trend = JSON.parse(await readFile(join(OUT, "data/trend.json"), "utf8"));

const server = await serve();
const browser = await chromium.launch();
const PAGES = ["/", "/trend/", "/table/", "/about/", "/mountain/325/"];
const WIDTHS = [320, 390, 768, 1280];

try {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));

    console.log(`\n[${theme}] 全画面`);
    for (const path of PAGES) {
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: "networkidle" });
      const h1 = await page.locator("h1").count();
      check(`${path} に見出しがひとつ`, h1 === 1, `${h1} 個`);
      const f = await readFooter(page);
      const errs = f ? checkFooter(f, { repo: REPO }) : ["フッタが見つからない"];
      check(`${path} のフッタが規約どおり`, errs.length === 0, errs.slice(0, 2).join(" / "));
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      check(`${path} の背景がテーマの色`, bg !== "rgba(0, 0, 0, 0)", bg);
    }
    check("コンソールに error が出ていない", errors.length === 0, errors.slice(0, 2).join(" / "));

    // ---------------------------------------------------------------- 今日の山
    console.log(`[${theme}] 今日の山`);
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
    const peaks = await page.locator(".peaks > li").count();
    check("44 山が並んでいる", peaks === 44, `${peaks} 件`);
    const glyphs = await page.locator(".peak svg polygon").count();
    check("しるしが 44 個描かれている", glyphs >= 44, `${glyphs} 個の多角形`);
    // 並べ替えが効く
    const firstBefore = await page.locator(".peaks > li .peak__name").first().innerText();
    await page.getByRole("button", { name: /平年日の早い順/ }).click();
    await page.waitForTimeout(150);
    const firstAfter = await page.locator(".peaks > li .peak__name").first().innerText();
    const earliestNormal = [...mountains].sort((a, b) => a.normal_index - b.normal_index)[0].name;
    check("平年日順にすると先頭が最も早い山になる", firstAfter === earliestNormal,
          `${firstBefore} → ${firstAfter}(期待 ${earliestNormal})`);

    // ---------------------------------------------------------------- 山ごと
    console.log(`[${theme}] 山ごと(富士山)`);
    await page.goto(`http://127.0.0.1:${PORT}/mountain/325/`, { waitUntil: "networkidle" });
    const fuji = mountains.find((m) => m.code === "325");
    const dots = await page.locator(".figure svg circle").count();
    // 折れ線の点 + 最早・最遅の輪 2 個 + 分布図には circle が無い
    check("点の数が日付のある年の数と合う", dots === fuji.n_dates + 2, `DOM ${dots} / データ ${fuji.n_dates + 2}`);
    const rails = await page.locator(".figure svg rect").count();
    check("記録の無い年が帯に出ている", rails >= fuji.n_missing + fuji.n_none,
          `DOM ${rails} / データ ${fuji.n_missing + fuji.n_none} 以上`);
    const years = await page.locator(".yearlist li").count();
    check("全記録が行数ぶん出ている", years === records["325"].length, `${years} / ${records["325"].length}`);

    const layout = await layoutIssues(page);
    check("図の中の文字が重なっていない", layout.overlaps.length === 0, layout.overlaps.slice(0, 3).join(", "));
    check("図の中の文字がはみ出していない", layout.clipped.length === 0, layout.clipped.slice(0, 3).join(", "));

    // ポインタを置くと値が出る
    const box = await page.locator(".figure svg").first().boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(150);
    const tip = await page.locator(".figure svg text", { hasText: "寒候年" }).count();
    check("ポインタを置くと年が出る", tip >= 1, `${tip} 件`);

    // ---------------------------------------------------------------- 遅くなっている
    console.log(`[${theme}] 遅くなっている`);
    await page.goto(`http://127.0.0.1:${PORT}/trend/`, { waitUntil: "networkidle" });
    const lollipops = await page.locator("svg line[stroke='var(--series)']").count();
    check("山ごとの棒が本数ぶんある", lollipops === trend.n_mountains, `${lollipops} / ${trend.n_mountains}`);
    // 表は複数ある(外した山・見る場所)。**見出しで選ぶ**。数だけ数えると別の表を巻き込む
    const excluded = await page
      .locator("h2", { hasText: "外した山" })
      .locator("xpath=following-sibling::div[1]")
      .locator("tbody tr")
      .count();
    check("外した山の表が件数ぶんある", excluded === trend.excluded.length,
          `${excluded} / ${trend.excluded.length}`);
    const body = await page.locator("main").innerText();
    check("帰無モデルの説明が本文にある", body.includes("置換"), "");
    check("届かないところが 3 つ書いてある", (await page.locator(".note").count()) >= 3);
    const tl = await layoutIssues(page);
    check("傾きの図で文字が重なっていない", tl.overlaps.length === 0, tl.overlaps.slice(0, 3).join(", "));

    if (SHOT) {
      await mkdir(join(ROOT, "harness/shots"), { recursive: true });
      for (const p of PAGES) {
        await page.goto(`http://127.0.0.1:${PORT}${p}`, { waitUntil: "networkidle" });
        await page.screenshot({
          path: join(ROOT, `harness/shots/${p.replaceAll("/", "_") || "_root"}-${theme}.png`),
          fullPage: true,
        });
      }
    }
    await ctx.close();
  }

  // ------------------------------------------------------------------ 幅を変える
  console.log("\n[幅] 横溢れ・縦の伸びすぎ・フッタの逃げ");
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: "networkidle" });
      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight,
        pad: parseFloat(getComputedStyle(document.body).paddingBottom),
      }));
      const f = await readFooter(page);
      check(`${width}px ${path} 横に溢れない`, m.overflow <= 0, `${m.overflow}px`);
      check(`${width}px ${path} 縦が 16000px 未満`, m.height < 16000, `${m.height}px`);
      check(`${width}px ${path} フッタの高さ < 逃げ`, f !== null && f.height < m.pad,
            `フッタ ${Math.round(f?.height ?? -1)}px / 逃げ ${m.pad}px`);
    }
    await ctx.close();
  }

  // ------------------------------------------------------------------ 陽性対照
  // 検品器そのものが異常を捕まえられることを一度確かめる(HC-080)。
  const broken = checkFooter(
    { text: "MIT License ・ GitHub", links: [], position: "static", bottom: "40px" },
    { repo: REPO },
  );
  check("陽性対照: 壊したフッタを検品器が落とす", broken.length > 0, `${broken.length} 件の違反`);
  const fakeOverlap = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.setContent(
      `<div class="figure"><svg width="200" height="60">
         <text x="10" y="30">かさなる</text><text x="12" y="32">かさなる</text>
       </svg></div>`,
    );
    const r = await layoutIssues(page);
    await ctx.close();
    return r.overlaps.length;
  })();
  check("陽性対照: 重なりの検出が実際に撃つ", fakeOverlap > 0, `${fakeOverlap} 件`);
} finally {
  await browser.close();
  server.close();
}

const ng = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - ng.length}/${checks.length} 合格`);
if (ng.length) {
  for (const c of ng) console.log(`  NG ${c.name} — ${c.detail}`);
  process.exit(1);
}
