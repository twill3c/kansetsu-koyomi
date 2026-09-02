"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "今日の山" },
  { href: "/trend/", label: "遅くなっている" },
  { href: "/table/", label: "表とデータ" },
  { href: "/about/", label: "観測の定義" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <header className="masthead">
      <div className="masthead__inner">
        <div className="brand">
          <Link className="brand__title" href="/">
            初冠雪ごよみ
          </Link>
          <span className="brand__sub">気象庁 44 山・4,105 行（1873–2026 寒候年）</span>
        </div>
        <nav className="nav" aria-label="主要な画面">
          {LINKS.map((l) => {
            const current = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
