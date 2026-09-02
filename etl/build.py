"""ETL 2/2 — raw/ を読んで data/*.json を作る。

出力(SPEC §6):
  data/meta.json        出典・取得日・定義・件数
  data/mountains.json   44 山の名簿と要約(平年値は気象庁の公表値をそのまま持つ)
  data/records.json     山ごとの (寒候年, 値) の並び。値は日付 / × / --
  data/crosscheck.json  甲府地方気象台 PDF から起こした富士山・甲斐駒ヶ岳(第二経路)
  data/trend.json       目玉(SPEC §5)の検定結果と帰無分布
  data/latest.json      今季(2027 寒候年)の山頂積雪状況

前提が崩れたら例外で止める。黙って違う値を出す道を残さない(HC-075)。
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import random
import re
import statistics
import sys

import pypdf

from lib import (
    DATA,
    DATE_RE,
    FSN_BASE,
    KOFU_PDF,
    MISSING,
    NONE_MARK,
    RAW,
    day_index,
    format_md,
    kanko_year,
    normalize_mountain,
    parse_md,
    parse_slash,
    strip_tags,
    table_rows,
    tables,
)

TREND_FROM = 1967  # 帰無検定の窓の始まり(SPEC §8 G-10)
TREND_MIN_N = 30  # 窓の中で日付が入っている年の下限
PERM_N = 2000
PERM_SEED = 20260902


def read(name: str) -> str:
    return open(os.path.join(RAW, name), encoding="utf-8").read()


# --- S-3: 観測方法 PDF から対象 44 山の表 -------------------------------


def load_official_roster() -> list[dict]:
    reader = pypdf.PdfReader(os.path.join(RAW, "obs_method.pdf"))
    text = "\n".join(p.extract_text() for p in reader.pages)
    rows = []
    for line in text.splitlines():
        m = re.match(r"^\s*(\d{1,2})\s+(\S+気象台)\s+(\S+)\s+(\S+)\s*$", line)
        if m:
            rows.append({
                "order": int(m.group(1)),
                "office": m.group(2),
                "name": m.group(3),
                "kana": m.group(4),
            })
    if [r["order"] for r in rows] != list(range(1, len(rows) + 1)):
        raise RuntimeError("PDF の対象山表の № が 1..N の連番になっていない: %r" % [r["order"] for r in rows])
    return rows


def definition_text() -> dict:
    """観測方法 PDF の定義部分を、原文のまま持つ。"""
    reader = pypdf.PdfReader(os.path.join(RAW, "obs_method.pdf"))
    t = reader.pages[0].extract_text()
    t = re.sub(r"[ \t　]+", "", t)
    need = ["白く見えることを冠雪という", "気象台から初めて", "日平均気温の最高値"]
    for k in need:
        if k not in t:
            raise RuntimeError("観測方法 PDF に期待した字句が無い: %r" % k)
    return {
        "kansetsu": "雪やあられなどが山頂付近に積もり、白く見えることを冠雪という。量の多少は問わない。",
        "hatsukansetsu": (
            "通常、寒候年(前年 8 月 1 日から当年 7 月 31 日まで)に気象台から初めて見えた時を"
            "その山の初冠雪という。なお、観測記録については日単位で記録する。"
        ),
        "fuji_exception": (
            "標高の高い富士山では、当年の富士山特別地域気象観測所の日平均気温の最高値が"
            "出現した日以降に初めて冠雪を観測した日を、初冠雪としている。"
        ),
        "source": FSN_BASE + "obs_method.pdf",
        "issued": "2026-07-31",
    }


# --- S-2: 索引(山岳コード・観測地点名・今季の状況) ----------------------


def load_index() -> tuple[dict[str, str], list[list[str]], dict]:
    h = read("fsn_index.html")
    codes = {}
    for code, label in re.findall(r'href="\./records/(\d+)\.html"[^>]*>(.*?)</a>', h, re.S):
        codes[code] = strip_tags(label)
    pairs = []
    for t in tables(h):
        if "観測地点名" in t:
            for row in table_rows(t):
                if len(row) == 2 and row[0] != "山岳名（カナ）":
                    pairs.append(row)
    latest = parse_latest(h)
    if len(codes) != 44 or len(pairs) != 44:
        raise RuntimeError("索引の山数が 44 でない: codes=%d pairs=%d" % (len(codes), len(pairs)))
    return codes, pairs, latest


def parse_latest(h: str) -> dict:
    """今季の山頂における積雪の状況。2027 寒候年からは解析積雪深による(目視ではない)。"""
    m = re.search(r"<h2 id=\"latest_snw\">(.*?)</h2>", h, re.S)
    heading = strip_tags(m.group(1)) if m else ""
    m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日(\d{1,2})時\s*時点", h)
    if not m:
        raise RuntimeError("今季の表から時点を読めなかった")
    asof = "%04d-%02d-%02dT%02d:00+09:00" % tuple(int(x) for x in m.groups())
    rows = []
    for t in tables(h):
        if "最新の積雪状況" not in t:
            continue
        for tr in re.findall(r"<tr.*?</tr>", t, re.S):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
            if len(cells) != 3:
                continue
            cls = re.search(r'class="([^"]*)"', tr)
            rows.append({
                "name": normalize_mountain(strip_tags(cells[0])),
                "date": strip_tags(cells[1]),
                "snow": strip_tags(cells[2]),
                "band": (re.findall(r'<td class="([a-z0-9]+)"', tr) or [""])[-1],
            })
    if len(rows) != 44:
        raise RuntimeError("今季の表の行数が 44 でない: %d" % len(rows))
    return {"heading": heading, "asof": asof, "rows": rows, "source": FSN_BASE}


# --- S-1: 記録ページ ----------------------------------------------------


def load_records(codes: dict[str, str]) -> dict[str, list[list]]:
    out = {}
    for code in codes:
        h = read("rec_%s.html" % code)
        rows = []
        for row in table_rows(h):
            if len(row) == 2 and re.fullmatch(r"\d{4}", row[0]):
                y, v = int(row[0]), row[1]
                if not (DATE_RE.match(v) or v in (MISSING, NONE_MARK)):
                    raise RuntimeError("記録ページ %s に未知の書式: %r(SPEC L0-2)" % (code, v))
                if DATE_RE.match(v) and kanko_year(parse_slash(v)) != y:
                    raise RuntimeError("寒候年が合わない: %s %d %s" % (code, y, v))
                rows.append([y, v])
        if not rows:
            raise RuntimeError("記録ページ %s から 1 行も取れなかった" % code)
        years = [r[0] for r in rows]
        if years != sorted(years) or len(set(years)) != len(years):
            raise RuntimeError("記録ページ %s の寒候年が昇順の一意でない" % code)
        out[code] = rows
    return out


# --- S-4: 平年値 --------------------------------------------------------


def load_normals() -> dict[tuple[str, str], dict]:
    """(ページ, 山岳名) → 平年値。

    鍵にページ名を含めるのは、**同じ山を複数の官署が観測していた**ためである
    (富士山は甲府・河口湖・三島、浅間山は前橋・軽井沢)。山岳名だけを鍵にすると
    現行の官署の行が、観測を終えた官署の行に黙って上書きされる。
    """
    out = {}
    for fn in sorted(os.listdir(RAW)):
        if not fn.startswith("season_"):
            continue
        h = read(fn)
        # 見出しは <h3>河口湖（山梨県)　平年値（霜・雪・結氷の初終日）</h3>。
        # 閉じ括弧が半角なのは気象庁側の字。無ければ station は None にして、後段で気づけるようにする。
        hm = re.search(r"<h3[^>]*>([^<（]+)（[^<]*?平年値", h)
        station = hm.group(1).strip() if hm else None
        for t in tables(h):
            if "初冠雪" not in t:
                continue
            rows = {r[0]: r[1:] for r in table_rows(t) if r}
            if "山岳名" not in rows:
                continue
            names = rows["山岳名"]
            for i, name in enumerate(names):
                out[(fn, normalize_mountain(name))] = {
                    "station": station,
                    "period": rows.get("統計期間", [""] * len(names))[i],
                    "sample_years": rows.get("資料年数", [""] * len(names))[i],
                    "normal": rows.get("月日", [""] * len(names))[i],
                    "page": fn,
                }
    return out


# --- S-5: 甲府地方気象台 PDF(第二経路) ---------------------------------


def load_kofu_pdf() -> dict[str, dict[int, str]]:
    """観測年 → 月日。PDF の備考どおり、年は寒候年ではなく観測した年。"""
    reader = pypdf.PdfReader(os.path.join(RAW, "kofu_hatsukansetsu.pdf"))
    text = reader.pages[0].extract_text()
    fuji, koma = {}, {}
    cell = r"(?:(\d{1,2})月\s*(\d{1,2})日|(×))"
    pat = re.compile(r"(\d{4})年\s*" + cell + r"(?:\s*" + cell + r")?")
    for m in pat.finditer(text):
        year = int(m.group(1))
        a = (m.group(2), m.group(3), m.group(4))
        b = (m.group(5), m.group(6), m.group(7))
        for target, g in ((fuji, a), (koma, b)):
            if g[0]:
                target[year] = "%d月%d日" % (int(g[0]), int(g[1]))
            elif g[2]:
                target[year] = MISSING
    if not (1894 in fuji and 2024 in fuji):
        raise RuntimeError("甲府 PDF から富士山の 1894 年 / 2024 年が読めなかった")
    return {"富士山": fuji, "甲斐駒ヶ岳": koma, "source": KOFU_PDF}


# --- 統計 ---------------------------------------------------------------


def slope(pts: list[tuple[int, int]]) -> float:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    mx, my = statistics.mean(xs), statistics.mean(ys)
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        raise ZeroDivisionError("年がすべて同じ")
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den


def build_discarded(mountains: list[dict], records: dict[str, list[list]], normals: dict) -> dict:
    """測って捨てた主張(SPEC §5)の数字。画面に手で書かないため、ここで出す。"""
    later = []
    for mt in mountains:
        window = [(y, v) for y, v in records[mt["code"]] if 1992 <= y <= 2021 and DATE_RE.match(v)]
        idxs = [day_index(parse_slash(v)) for _, v in window]
        n = sum(1 for i in idxs if i > mt["normal_index"])
        later.append({"code": mt["code"], "name": mt["name"], "n": len(idxs), "later": n,
                      "ratio": n / len(idxs) * 100,
                      "median_index": statistics.median(idxs),
                      "skew_days": statistics.median(idxs) - statistics.mean(idxs)})

    # 同じ山を別の官署が見ていた期間の平年値と、同じ年で計算した現行官署の平均。
    vantage = []
    for (page, name), v in sorted(normals.items()):
        if name != "富士山" or v["period"] == "1991～2020":
            continue
        m = re.match(r"^(\d{4})～(\d{4})$", v["period"])
        # 観測を終えた官署の平年値には「@」(統計期間が標準の 30 年と異なる)が付く。
        normal = v["normal"].replace("@", "").strip()
        if not m or not re.match(r"^\d+月\d+日$", normal):
            continue
        lo, hi = int(m.group(1)) + 1, int(m.group(2)) + 1  # 観測年 → 寒候年
        code = next(mt["code"] for mt in mountains if mt["name"] == "富士山")
        idxs = [day_index(parse_slash(x)) for y, x in records[code] if lo <= y <= hi and DATE_RE.match(x)]
        mean = statistics.mean(idxs)
        vantage.append({
            "page": page,
            "station": v["station"],
            "mountain": name,
            "period": v["period"],
            "their_normal": normal,
            "their_index": parse_md(normal),
            "kofu_mean": format_md(mean),
            "kofu_index": round(mean),
            "diff_days": abs(round(mean) - parse_md(normal)),
            "n": len(idxs),
        })

    return {
        "later_than_normal": {
            "note": "1992–2021 寒候年で、公表平年値より遅かった年の割合",
            "per_mountain": later,
            "mean_ratio": statistics.mean(x["ratio"] for x in later),
            "n_over_half": sum(1 for x in later if x["ratio"] > 50),
            "median_skew_days": statistics.median(x["skew_days"] for x in later),
        },
        "vantage": {
            "note": "同じ富士山を、観測を終えた官署がどう見ていたか。統計期間を揃えて比べる",
            "rows": vantage,
            "max_diff_days": max((x["diff_days"] for x in vantage), default=0),
        },
    }


def theil_sen(pts: list[tuple[int, int]]) -> float:
    """全対の傾きの中央値。外れ値(8 月の初冠雪など)に引かれない第二の推定量。"""
    sl = [(y2 - y1) / (x2 - x1) for i, (x1, y1) in enumerate(pts) for x2, y2 in pts[i + 1:] if x2 != x1]
    if not sl:
        raise ValueError("対が作れない")
    return statistics.median(sl)


def build_trend(mountains: list[dict], records: dict[str, list[list]]) -> dict:
    """目玉(SPEC §5)。全山共通の年ラベル置換を帰無モデルにする。"""
    series = {}
    excluded = []
    for mt in mountains:
        rows = records[mt["code"]]
        window = [r for r in rows if r[0] >= TREND_FROM]
        none_years = [r[0] for r in window if r[1] == NONE_MARK]
        if none_years:
            excluded.append({"code": mt["code"], "name": mt["name"], "reason": "現象なし(--)を含む",
                             "count": len(none_years), "years": none_years})
            continue
        pts = [(r[0], day_index(parse_slash(r[1]))) for r in window if DATE_RE.match(r[1])]
        if len(pts) < TREND_MIN_N:
            excluded.append({"code": mt["code"], "name": mt["name"], "reason": "窓内の年数が %d 未満" % TREND_MIN_N,
                             "count": len(pts)})
            continue
        series[mt["code"]] = pts

    obs = {c: slope(p) for c, p in series.items()}
    ts = {c: theil_sen(p) for c, p in series.items()}
    n_pos = sum(1 for v in obs.values() if v > 0)
    sign_agree = sum(1 for c in obs if (obs[c] > 0) == (ts[c] > 0))

    years = sorted({y for p in series.values() for y, _ in p})
    rng = random.Random(PERM_SEED)
    null_pos, null_med = [], []
    for _ in range(PERM_N):
        shuffled = years[:]
        rng.shuffle(shuffled)
        mapping = dict(zip(years, shuffled))
        cnt = 0
        sl = []
        for pts in series.values():
            s = slope([(mapping[y], v) for y, v in pts])
            sl.append(s)
            if s > 0:
                cnt += 1
        null_pos.append(cnt)
        null_med.append(statistics.median(sl))
    ge = sum(1 for v in null_pos if v >= n_pos)
    obs_med = statistics.median(obs.values())
    ge_med = sum(1 for v in null_med if v >= obs_med)

    # 感度: 除外した山の「現象なし」を寒候年の最終日(7/31 = 起点から 364 日)で打ち切った系列。
    # 除外が主張に有利な方向へ働いていないかを見る対照。
    censored = {}
    for mt in mountains:
        window = [r for r in records[mt["code"]] if r[0] >= TREND_FROM]
        pts = []
        for y, v in window:
            if DATE_RE.match(v):
                pts.append((y, day_index(parse_slash(v))))
            elif v == NONE_MARK:
                pts.append((y, 364))
        if len(pts) >= TREND_MIN_N:
            censored[mt["code"]] = slope(pts) * 100
    return {
        "window_from": TREND_FROM,
        "min_years": TREND_MIN_N,
        "n_mountains": len(series),
        "n_positive": n_pos,
        "median_slope_per_century": statistics.median(obs.values()) * 100,
        "slopes": {c: v * 100 for c, v in obs.items()},
        "theil_sen": {
            "note": "最小二乗とは別の推定量(全対の傾きの中央値)。符号が一致するかを見る",
            "slopes": {c: v * 100 for c, v in ts.items()},
            "n_positive": sum(1 for v in ts.values() if v > 0),
            "median_slope_per_century": statistics.median(ts.values()) * 100,
            "sign_agreement": sign_agree,
        },
        "excluded": excluded,
        "censored": {
            "note": "現象なし(--)を寒候年の最終日(起点から 364 日)で打ち切って入れ直した対照",
            "n_mountains": len(censored),
            "n_positive": sum(1 for v in censored.values() if v > 0),
            "median_slope_per_century": statistics.median(censored.values()),
            "slopes": censored,
        },
        "null": {
            "iterations": PERM_N,
            "seed": PERM_SEED,
            "model": "全山に同じ年ラベル置換を当てる(山どうしの相関を保ったまま傾きだけ壊す)",
            "positive_counts": null_pos,
            "median_slopes_per_century": [v * 100 for v in null_med],
            "p_positive": (ge + 1) / (PERM_N + 1),
            "p_median": (ge_med + 1) / (PERM_N + 1),
            "mean_positive": statistics.mean(null_pos),
            "max_positive": max(null_pos),
            "median_of_median_slopes": statistics.median(null_med) * 100,
            "q99_median_slope": sorted(null_med)[int(PERM_N * 0.99)] * 100,
        },
    }


# --- 組み立て -----------------------------------------------------------


def main() -> int:
    os.makedirs(DATA, exist_ok=True)
    official = load_official_roster()
    codes, pairs, latest = load_index()
    records = load_records(codes)
    normals = load_normals()
    kofu = load_kofu_pdf()

    idx_names = {normalize_mountain(v) for v in codes.values()}
    off_names = {normalize_mountain(r["name"]) for r in official}
    cur_normals = {k for k, v in normals.items() if v["period"] == "1991～2020"}
    nml_names = [name for _, name in cur_normals]
    if len(nml_names) != len(set(nml_names)):
        raise RuntimeError("統計期間 1991〜2020 の山岳名が重複している: %r" % sorted(nml_names))
    nml_names = set(nml_names)
    if not (idx_names == off_names == nml_names):
        raise RuntimeError(
            "名簿の三経路が一致しない(G-01)\n 索引 %d / PDF %d / 平年値 %d\n"
            " 索引にのみ: %r\n PDF にのみ: %r\n 平年値にのみ: %r\n 索引に無い(PDF): %r\n 索引に無い(平年値): %r"
            % (len(idx_names), len(off_names), len(nml_names),
               sorted(idx_names - off_names | idx_names - nml_names),
               sorted(off_names - idx_names), sorted(nml_names - idx_names),
               sorted(idx_names - off_names), sorted(idx_names - nml_names))
        )

    station_of = {normalize_mountain(a): b for a, b in pairs}
    mountains = []
    for r in official:
        name = normalize_mountain(r["name"])
        code = next(c for c, v in codes.items() if normalize_mountain(v) == name)
        nml = next(normals[k] for k in cur_normals if k[1] == name)
        rows = records[code]
        dates = [(y, parse_slash(v)) for y, v in rows if DATE_RE.match(v)]
        idxs = [(y, day_index(d)) for y, d in dates]
        earliest = min(idxs, key=lambda t: (t[1], t[0]))
        latest_rec = max(idxs, key=lambda t: (t[1], -t[0]))
        mountains.append({
            "code": code,
            "order": r["order"],
            "name": r["name"],
            "kana": r["kana"],
            "office": r["office"],
            "station": station_of[name],
            "normal": nml["normal"],
            "normal_index": parse_md(nml["normal"]),
            "normal_period": nml["period"],
            "sample_years": int(nml["sample_years"]),
            "first_year": rows[0][0],
            "last_year": rows[-1][0],
            "n_rows": len(rows),
            "n_dates": len(dates),
            "n_missing": sum(1 for _, v in rows if v == MISSING),
            "n_none": sum(1 for _, v in rows if v == NONE_MARK),
            "earliest": {"year": earliest[0], "index": earliest[1],
                         "date": next(d for y, d in dates if y == earliest[0]).isoformat()},
            "latest": {"year": latest_rec[0], "index": latest_rec[1],
                       "date": next(d for y, d in dates if y == latest_rec[0]).isoformat()},
        })

    # G-02 資料年数の一致(1992..2021 寒候年 = 平年値の統計期間 1991-2020)
    bad = []
    for mt in mountains:
        n = sum(1 for y, v in records[mt["code"]] if 1992 <= y <= 2021 and DATE_RE.match(v))
        if n != mt["sample_years"]:
            bad.append((mt["name"], n, mt["sample_years"]))
    if bad:
        raise RuntimeError("資料年数が一致しない(G-02): %r" % bad)

    trend = build_trend(mountains, records)
    discarded = build_discarded(mountains, records, normals)

    meta = {
        "generated": _dt.datetime.now(_dt.timezone(_dt.timedelta(hours=9))).isoformat(timespec="seconds"),
        "definition": definition_text(),
        "sources": [
            {"id": "S-1", "title": "過去の初冠雪日の記録(2026 寒候年まで)", "url": FSN_BASE + "records/"},
            {"id": "S-2", "title": "初冠雪の記録等(索引・今季の山頂における積雪の状況)", "url": FSN_BASE},
            {"id": "S-3", "title": "初冠雪の観測", "url": FSN_BASE + "obs_method.pdf"},
            {"id": "S-4", "title": "平年値(霜・雪・結氷の初終日と初冠雪日)",
             "url": "https://www.data.jma.go.jp/stats/etrn/view/nml_sfc_season.php"},
            {"id": "S-5", "title": "富士山・甲斐駒ヶ岳の初冠雪日(甲府地方気象台)", "url": KOFU_PDF},
        ],
        "counts": {
            "mountains": len(mountains),
            "rows": sum(len(v) for v in records.values()),
            "dates": sum(m["n_dates"] for m in mountains),
            "missing": sum(m["n_missing"] for m in mountains),
            "none": sum(m["n_none"] for m in mountains),
            "year_min": min(v[0][0] for v in records.values()),
            "year_max": max(v[-1][0] for v in records.values()),
        },
        "method_change": {
            "last_visual_year": 2026,
            "first_analysis_year": 2027,
            "note": (
                "目視による初冠雪の観測は 2026 寒候年で終わった。2027 寒候年からは解析積雪深による"
                "「山頂における積雪の状況」が公開されている。手法が異なるため単純比較できない。"
            ),
        },
    }

    write("meta.json", meta)
    write("mountains.json", mountains)
    write("records.json", records)
    write("crosscheck.json", kofu)
    write("trend.json", trend)
    write("discarded.json", discarded)
    write("latest.json", latest)

    print("山 %d / 行 %d(日付 %d・欠測 %d・なし %d)/ 寒候年 %d-%d"
          % (len(mountains), meta["counts"]["rows"], meta["counts"]["dates"],
             meta["counts"]["missing"], meta["counts"]["none"],
             meta["counts"]["year_min"], meta["counts"]["year_max"]))
    print("目玉: %d 山中 %d 山が正の傾き / 中央 %+.1f 日 100 年 / 帰無 p=%.4f(最大 %d 山)"
          % (trend["n_mountains"], trend["n_positive"], trend["median_slope_per_century"],
             trend["null"]["p_positive"], trend["null"]["max_positive"]))
    for e in trend["excluded"]:
        print("  除外: %s(%s %s)" % (e["name"], e["reason"], e["count"]))
    return 0


def write(name: str, obj) -> None:
    path = os.path.join(DATA, name)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("  → data/%s (%.1f KB)" % (name, os.path.getsize(path) / 1024))


if __name__ == "__main__":
    sys.exit(main())
