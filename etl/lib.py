"""初冠雪ごよみ — ETL 共通部品。

寒候年(前年 8/1 から当年 7/31)まわりの規則をここに一本化する。
仮定は同じ場所で検算する(HC-075): 黙って違う値を返す道を残さない。
"""

from __future__ import annotations

import datetime as _dt
import os
import re
import time
import urllib.request

# --- 経路 ---------------------------------------------------------------

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
DATA = os.path.join(ROOT, "data")

FSN_BASE = "https://www.data.jma.go.jp/stats/data/mdrr/fsn_cap/"
ETRN_SEASON = (
    "https://www.data.jma.go.jp/stats/etrn/view/nml_sfc_season.php"
    "?prec_no=%s&block_no=%s&year=&month=&day=&view="
)
KOFU_PDF = "https://www.data.jma.go.jp/kofu/image/chousa/hatsukansetsu2024.pdf"

USER_AGENT = "kansetsu-koyomi/1.0 (+https://github.com/twill3c/kansetsu-koyomi)"

# 記録ページに現れてよい値。これ以外は SPEC 4.L0-2 の前提が崩れたということ(G-04)。
MISSING = "×"  # 欠測
NONE_MARK = "--"  # 該当現象なし
DATE_RE = re.compile(r"^\d{4}/\d{2}/\d{2}$")


# --- 寒候年 -------------------------------------------------------------


def kanko_year(d: _dt.date) -> int:
    """日付が属する寒候年。寒候年 Y = (Y-1)/08/01 .. Y/07/31。"""
    return d.year + 1 if d.month >= 8 else d.year


def kanko_origin(y: int) -> _dt.date:
    """寒候年 y の起点(前年 8 月 1 日)。"""
    return _dt.date(y - 1, 8, 1)


def day_index(d: _dt.date) -> int:
    """その日が属する寒候年の起点から数えた日数。8/1 が 0。"""
    return (d - kanko_origin(kanko_year(d))).days


# 平年の暦(2001-08-01 起点・寒候年 2002 相当。うるう年を含まない)で日数を日付に戻す。
_LABEL_ORIGIN = _dt.date(2001, 8, 1)


def index_to_md(i: float) -> tuple[int, int]:
    """日数を (月, 日) に戻す。平年の暦で解釈する。"""
    d = _LABEL_ORIGIN + _dt.timedelta(days=int(round(i)))
    return d.month, d.day


def format_md(i: float) -> str:
    m, day = index_to_md(i)
    return "%d月%d日" % (m, day)


def parse_md(s: str) -> int:
    """「10月2日」形式を寒候年起点の日数に直す。"""
    m = re.match(r"^(\d+)月(\d+)日$", s.strip())
    if not m:
        raise ValueError("月日として読めない: %r" % s)
    mo, day = int(m.group(1)), int(m.group(2))
    year = 2001 if mo >= 8 else 2002
    return (_dt.date(year, mo, day) - _LABEL_ORIGIN).days


def parse_slash(s: str) -> _dt.date:
    """記録ページの 'YYYY/MM/DD' を日付に直す。"""
    if not DATE_RE.match(s):
        raise ValueError("日付として読めない: %r" % s)
    y, m, d = (int(x) for x in s.split("/"))
    return _dt.date(y, m, d)


# --- 取得 ---------------------------------------------------------------


def fetch(url: str, name: str, *, binary: bool = False, refresh: bool = False):
    """raw/ を通した取得。既に取ってあるものは読むだけにする。"""
    os.makedirs(RAW, exist_ok=True)
    path = os.path.join(RAW, name)
    if os.path.exists(path) and not refresh:
        return open(path, "rb").read() if binary else open(path, encoding="utf-8").read()
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    body = None
    last = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
            break
        except Exception as e:  # noqa: BLE001 — 接続断は実測で起きる。黙って諦めない
            last = e
            wait = 2 ** attempt
            print("  再試行 %d/5 (%s) %ds 待つ: %s" % (attempt + 1, name, wait, e))
            time.sleep(wait)
    if body is None:
        raise RuntimeError("取得できなかった: %s (%s)" % (url, last))
    if binary:
        open(path, "wb").write(body)
        out = body
    else:
        out = body.decode("utf-8", errors="replace")
        open(path, "w", encoding="utf-8", newline="\n").write(out)
    time.sleep(0.6)  # 気象庁のサーバへの間隔
    return out


# --- HTML ---------------------------------------------------------------

_TAG = re.compile(r"<[^>]+>")


def strip_tags(s: str) -> str:
    import html as _html

    return _html.unescape(_TAG.sub("", s)).replace("　", " ").strip()


def table_rows(table_html: str) -> list[list[str]]:
    out = []
    for tr in re.findall(r"<tr.*?</tr>", table_html, re.S):
        cells = [strip_tags(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
        if cells:
            out.append(cells)
    return out


def tables(html_text: str) -> list[str]:
    return re.findall(r"<table.*?</table>", html_text, re.S)


def normalize_mountain(name: str) -> str:
    """山岳名の表記ゆれを畳む。気象庁の製品どうしで小書き仮名と括弧が揺れる。"""
    s = name.strip()
    s = re.split(r"[（(]", s, maxsplit=1)[0]  # 括弧より前だけ。ヨミガナは入れ子になる(蔵王山)
    s = s.replace("ケ", "ヶ")
    return s.strip()
