import { describe, expect, it } from "vitest";

// @ts-expect-error — .mjs に型定義は無い。規則は JS 側に置いてフリートで共有している
import { APP_MENU, checkFooter } from "@/scripts/footer-rule.mjs";

const REPO = "kansetsu-koyomi";
const ART = "https://claude.ai/code/artifact/00000000-1111-2222-3333-444444444444";
const ART2 = "https://claude.ai/code/artifact/55555555-6666-7777-8888-999999999999";

/** 規約どおりのフッタ（陰性対照）。 */
function ok() {
  return {
    text: "MIT License © 2026 坂田哲朗 ・ GitHub ・ 初冠雪ごよみの歩き方 ・ 初冠雪ごよみの設計図 ・ App Menu",
    links: [
      { label: "MIT License", href: `https://github.com/twill3c/${REPO}/blob/main/LICENSE` },
      { label: "GitHub", href: `https://github.com/twill3c/${REPO}` },
      { label: "初冠雪ごよみの歩き方", href: ART },
      { label: "初冠雪ごよみの設計図", href: ART2 },
      { label: "App Menu", href: APP_MENU },
    ],
    position: "fixed",
    bottom: "0px",
  };
}

describe("フッタ規約の判定規則", () => {
  it("陰性対照: 規約どおりなら違反 0", () => {
    expect(checkFooter(ok(), { repo: REPO })).toEqual([]);
  });

  it("陽性対照: 項目が欠けたら落ちる", () => {
    const f = ok();
    f.text = f.text.replace(" ・ App Menu", "");
    f.links = f.links.filter((l) => l.label !== "App Menu");
    expect(checkFooter(f, { repo: REPO }).join(" ")).toMatch(/App Menu/);
  });

  it("陽性対照: 著作権表示がリンク文言の中にあれば落ちる", () => {
    const f = ok();
    f.links[0].label = "MIT License © 2026 坂田哲朗";
    expect(checkFooter(f, { repo: REPO }).join(" ")).toMatch(/リンク文言の中/);
  });

  it("陽性対照: GitHub の行き先が別ホストになれば落ちる", () => {
    const f = ok();
    f.links[1].href = "https://example.com/";
    expect(checkFooter(f, { repo: REPO }).join(" ")).toMatch(/GitHub の行き先/);
  });

  it("陽性対照: MIT の行き先が opensource.org なら落ちる", () => {
    const f = ok();
    f.links[0].href = "https://opensource.org/licenses/MIT";
    expect(checkFooter(f, { repo: REPO }).join(" ")).toMatch(/MIT License の行き先/);
  });

  it("陽性対照: 解説がアーティファクトでなければ落ちる", () => {
    const f = ok();
    f.links[2].href = `https://github.com/twill3c/${REPO}/blob/main/README.md`;
    expect(checkFooter(f, { repo: REPO }).join(" ")).toMatch(/歩き方 の行き先/);
  });

  it("陽性対照: 区切りが足りなければ落ちる", () => {
    const f = ok();
    f.text = f.text.replaceAll(" ・ ", " ");
    expect(checkFooter(f, { repo: REPO }).join(" ")).toMatch(/「・」が 0 個/);
  });

  it("陽性対照: 下部固定でなければ落ちる", () => {
    const f = ok();
    f.position = "static";
    expect(checkFooter(f, { repo: REPO }).join(" ")).toMatch(/fixed でない/);
  });

  it("陽性対照: 並びが規約と違えば落ちる", () => {
    const f = ok();
    f.text = "App Menu ・ MIT License © 2026 坂田哲朗 ・ GitHub ・ 初冠雪ごよみの歩き方 ・ 初冠雪ごよみの設計図";
    expect(checkFooter(f, { repo: REPO }).length).toBeGreaterThan(0);
  });

  it("ブランチ名は規約ではない（master でも通る）", () => {
    const f = ok();
    f.links[0].href = `https://github.com/twill3c/${REPO}/blob/master/LICENSE`;
    expect(checkFooter(f, { repo: REPO })).toEqual([]);
  });
});
