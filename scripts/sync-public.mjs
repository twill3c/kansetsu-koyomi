/**
 * data/*.json を public/data/ へ写し、配布用の CSV を作る。
 *
 * ビルドの前に必ず走らせる。写しそこねると、画面の数字と配布物が食い違う。
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "data");
const DST = join(ROOT, "public", "data");

await mkdir(DST, { recursive: true });

const files = (await readdir(SRC)).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("data/*.json が 1 件も無い。先に `npm run data` を走らせること");
  process.exit(2);
}
for (const f of files) {
  await writeFile(join(DST, f), await readFile(join(SRC, f)));
}

const mountains = JSON.parse(await readFile(join(SRC, "mountains.json"), "utf8"));
const records = JSON.parse(await readFile(join(SRC, "records.json"), "utf8"));

const lines = ["code,mountain,kana,station,office,kanko_year,value"];
for (const m of mountains) {
  for (const [year, value] of records[m.code]) {
    lines.push([m.code, m.name, m.kana, m.station, m.office, year, value].join(","));
  }
}
// 出荷形式の前提はここで assert する(HC-005)
const dataRows = lines.length - 1;
const expected = Object.values(records).reduce((n, r) => n + r.length, 0);
if (dataRows !== expected) {
  console.error(`CSV の行数が記録と合わない: ${dataRows} / ${expected}`);
  process.exit(2);
}
if (lines.some((l) => l.split(",").length !== 7)) {
  console.error("CSV に列数の違う行がある(名前にカンマが入った可能性)");
  process.exit(2);
}
await writeFile(join(DST, "records.csv"), lines.join("\n") + "\n", "utf8");

console.log(`public/data/ へ ${files.length} 件の JSON と records.csv(${dataRows} 行)を書いた`);
