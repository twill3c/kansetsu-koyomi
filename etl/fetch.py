"""ETL 1/2 — 気象庁から raw/ へ取得する。

取得するもの(SPEC §3):
  S-1 山ごとの初冠雪日 44 ページ
  S-2 索引(名簿 + 今季の山頂積雪状況)
  S-3 観測方法 PDF
  S-4 平年値(霜・雪・結氷の初終日と初冠雪日)を全気象官署ぶん
  S-5 甲府地方気象台の富士山・甲斐駒ヶ岳 PDF(照合用の第二経路)

`--refresh` で取り直す。既定は raw/ にあるものを再利用する。
"""

from __future__ import annotations

import argparse
import re
import sys

from lib import ETRN_SEASON, FSN_BASE, KOFU_PDF, fetch

# 気象庁「過去の気象データ検索」の都府県・地方コード(南極 99 を除く)。
PREFS = [
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24",
    "31", "32", "33", "34", "35", "36", "40", "41", "42", "43", "44", "45", "46", "48",
    "49", "50", "51", "52", "53", "54", "55", "56", "57", "60", "61", "62", "63", "64",
    "65", "66", "67", "68", "69", "71", "72", "73", "74", "81", "82", "83", "84", "85",
    "86", "87", "88", "91",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="raw/ を無視して取り直す")
    ap.add_argument("--latest-only", action="store_true", help="今季の表(S-2)だけ取り直す")
    args = ap.parse_args()

    index = fetch(FSN_BASE, "fsn_index.html", refresh=args.refresh or args.latest_only)
    codes = sorted(set(re.findall(r'href="\./records/(\d+)\.html"', index)))
    print("S-2 索引: 記録ページ %d 件" % len(codes))
    if len(codes) == 0:
        print("!! 索引から記録ページを 1 件も取れなかった。構造が変わった可能性がある", file=sys.stderr)
        return 2
    if args.latest_only:
        return 0

    for code in codes:
        fetch(FSN_BASE + "records/%s.html" % code, "rec_%s.html" % code, refresh=args.refresh)
    print("S-1 記録ページ: %d 件" % len(codes))

    fetch(FSN_BASE + "obs_method.pdf", "obs_method.pdf", binary=True, refresh=args.refresh)
    print("S-3 観測方法 PDF")

    n = 0
    for prec in PREFS:
        pref = fetch(
            "https://www.data.jma.go.jp/stats/etrn/select/prefecture.php"
            "?prec_no=%s&block_no=&year=&month=&day=&view=" % prec,
            "pref_%s.html" % prec,
            refresh=args.refresh,
        )
        blocks = sorted({b for b in re.findall(r"block_no=(\d+)", pref) if b.startswith("47")})
        for block in blocks:
            fetch(ETRN_SEASON % (prec, block), "season_%s_%s.html" % (prec, block), refresh=args.refresh)
            n += 1
    print("S-4 平年値ページ: %d 件(気象官署 block_no=47xxx のみ)" % n)

    fetch(KOFU_PDF, "kofu_hatsukansetsu.pdf", binary=True, refresh=args.refresh)
    print("S-5 甲府地方気象台 PDF")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
