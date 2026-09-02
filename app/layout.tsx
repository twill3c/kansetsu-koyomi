import type { Metadata } from "next";

import { SiteNav } from "@/components/SiteNav";

import "./globals.css";

export const metadata: Metadata = {
  title: "初冠雪ごよみ",
  description:
    "気象庁が全国 44 山で記録した初冠雪日 4,105 行を読む。初冠雪は「白くなった日」ではなく「気象台からそう見えた日」である。",
};

/** フリート共通フッタの行き先(koho-lens が正本)。 */
const FOOTER = {
  license: "https://github.com/twill3c/kansetsu-koyomi/blob/main/LICENSE",
  repository: "https://github.com/twill3c/kansetsu-koyomi",
  guide: "https://claude.ai/code/artifact/7689fe67-34d6-441e-9dcd-7867ebcbaf68",
  blueprint: "https://claude.ai/code/artifact/64191353-08af-45b8-92d7-e781a9115f92",
  appMenu: "https://app-menu-amber.vercel.app/",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <SiteNav />
        {children}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <a href={FOOTER.license}>MIT License</a>
            <span className="site-footer__copy">© 2026 坂田哲朗</span>
            <span className="fsep">・</span>
            <a href={FOOTER.repository}>GitHub</a>
            <span className="fsep">・</span>
            <a href={FOOTER.guide}>初冠雪ごよみの歩き方</a>
            <span className="fsep">・</span>
            <a href={FOOTER.blueprint}>初冠雪ごよみの設計図</a>
            <span className="fsep">・</span>
            <a href={FOOTER.appMenu}>App Menu</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
