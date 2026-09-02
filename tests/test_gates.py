"""SPEC §8 の品質ゲートを、出荷する data/*.json に対して当てる。

期待値の出所(HC-016):
  - 気象庁の公表値(平年値・資料年数・対象山一覧)  → 外部権威。data/ に取り込んだ値を使う
  - 実測(2026-09-02)                              → 定数で書く場合は実測日を添える
  - 不変量(集合の一致・取りこぼしの不在)          → 件数は極力これで書く

検出系のテストには陽性対照(捕まえるべき例)と陰性対照(撃ってはならない例)を対で置く(HC-041)。
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import statistics

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

DATE_RE = re.compile(r"^\d{4}/\d{2}/\d{2}$")
MISSING = "×"
NONE_MARK = "--"


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def mountains():
    return load("mountains.json")


@pytest.fixture(scope="module")
def records():
    return load("records.json")


@pytest.fixture(scope="module")
def meta():
    return load("meta.json")


@pytest.fixture(scope="module")
def trend():
    return load("trend.json")


# --- 補助(実装とは独立に書き直す。build.py の関数を借りない) ---------------


def kanko_year(y, m, d):
    return y + 1 if m >= 8 else y


def day_index(y, m, d):
    return (dt.date(y, m, d) - dt.date(kanko_year(y, m, d) - 1, 8, 1)).days


def md_to_index(s):
    m = re.match(r"^(\d+)月(\d+)日$", s)
    mo, day = int(m.group(1)), int(m.group(2))
    return day_index(2001 if mo >= 8 else 2002, mo, day)


def ols(pts):
    mx = statistics.mean(x for x, _ in pts)
    my = statistics.mean(y for _, y in pts)
    return sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)


# --- G-01 名簿 ------------------------------------------------------------


@pytest.mark.validation
def test_g01_roster_is_44_and_matches_official_order(mountains):
    """気象庁「初冠雪対象山」表(S-3)の 44 山・№ 1..44 と一致する。"""
    assert len(mountains) == 44
    assert [m["order"] for m in mountains] == list(range(1, 45))
    names = [m["name"] for m in mountains]
    assert len(set(names)) == 44, "山岳名が重複している"
    codes = [m["code"] for m in mountains]
    assert len(set(codes)) == 44
    # 出所: S-3 obs_method.pdf の表(2026-07-31 公表)。両端と、同一官署が複数を見る例。
    assert names[0] == "利尻山" and mountains[0]["office"] == "稚内地方気象台"
    assert names[-1] == "鰐塚山" and mountains[-1]["office"] == "宮崎地方気象台"
    maebashi = [m["name"] for m in mountains if m["office"] == "前橋地方気象台"]
    assert maebashi == ["浅間山", "仙ノ倉山", "白砂山", "武尊山", "赤城山", "榛名山"]


@pytest.mark.validation
def test_g01_every_mountain_has_records(mountains, records):
    assert set(records) == {m["code"] for m in mountains}
    for m in mountains:
        assert len(records[m["code"]]) == m["n_rows"] > 0


# --- G-04 値の書式 --------------------------------------------------------


def _bad_values(rows):
    return [v for _, v in rows if not (DATE_RE.match(v) or v in (MISSING, NONE_MARK))]


@pytest.mark.validation
def test_g04_only_three_value_shapes(records):
    """SPEC L0-2: 'YYYY/MM/DD' / '×' / '--' 以外は無い。"""
    seen = set()
    for rows in records.values():
        assert _bad_values(rows) == []
        seen.update(v for _, v in rows if not DATE_RE.match(v))
    assert seen == {MISSING, NONE_MARK}, "記号が増減した: %r" % seen


@pytest.mark.unit
def test_g04_detector_positive_and_negative_control():
    """陽性: 未知の書式を捕まえる。陰性: 正当な三種類は撃たない(HC-041)。"""
    assert _bad_values([[2000, "2000/10/01"], [2001, MISSING], [2002, NONE_MARK]]) == []
    assert _bad_values([[2000, "2000-10-01"]]) == ["2000-10-01"]
    assert _bad_values([[2000, ""]]) == [""]
    assert _bad_values([[2000, "10月1日"]]) == ["10月1日"]


# --- G-06 寒候年 ----------------------------------------------------------


@pytest.mark.validation
def test_g06_every_date_belongs_to_its_kanko_year(records):
    for code, rows in records.items():
        for y, v in rows:
            if DATE_RE.match(v):
                yy, mm, dd = (int(x) for x in v.split("/"))
                assert kanko_year(yy, mm, dd) == y, "%s %d %s" % (code, y, v)


@pytest.mark.unit
def test_g06_kanko_year_boundaries():
    """出所: SPEC §2 の定義(前年 8/1 から当年 7/31)。境界の 4 点で押さえる。"""
    assert kanko_year(2025, 7, 31) == 2025
    assert kanko_year(2025, 8, 1) == 2026
    assert kanko_year(2025, 12, 31) == 2026
    assert kanko_year(2026, 1, 1) == 2026
    assert day_index(2025, 8, 1) == 0
    assert day_index(2025, 10, 23) == 83  # 富士山 2026 寒候年


@pytest.mark.validation
def test_g06_years_are_sorted_and_unique(records):
    for code, rows in records.items():
        years = [y for y, _ in rows]
        assert years == sorted(years) and len(set(years)) == len(years), code


# --- G-02 資料年数 --------------------------------------------------------


@pytest.mark.validation
def test_g02_sample_years_match_published(mountains, records):
    """S-4 の公表「資料年数」== S-1 の 1992..2021 寒候年で日付が入る年の数。

    別々の気象庁製品どうしの突合なので循環しない(SPEC §3)。
    """
    for m in mountains:
        n = sum(1 for y, v in records[m["code"]] if 1992 <= y <= 2021 and DATE_RE.match(v))
        assert n == m["sample_years"], "%s: 記録 %d / 公表 %d" % (m["name"], n, m["sample_years"])


# --- G-03 平年値 ----------------------------------------------------------


@pytest.mark.validation
def test_g03_recomputed_normal_is_close_to_published(mountains, records):
    """再計算した平均と公表平年値の差。

    実測(2026-09-02): 1992-2021 寒候年に `--` を持たない 40 山では差 ≤ 1 日、
    `--` を持つ 4 山(国見山・金峰山・桜島・鰐塚山)では ≤ 2 日。
    差が出るのは気象庁の平年値の丸めと「現象なし」の扱いが本実装と違うからで、
    **画面に出すのは公表値だけ**(SPEC §4 L0-5 / §9)。
    """
    for m in mountains:
        window = [(y, v) for y, v in records[m["code"]] if 1992 <= y <= 2021]
        idxs = [day_index(*(int(x) for x in v.split("/"))) for _, v in window if DATE_RE.match(v)]
        assert idxs, m["name"]
        diff = abs(round(statistics.mean(idxs)) - md_to_index(m["normal"]))
        limit = 2 if any(v == NONE_MARK for _, v in window) else 1
        assert diff <= limit, "%s: 差 %d 日(上限 %d)" % (m["name"], diff, limit)


@pytest.mark.validation
def test_g03_normal_index_matches_normal_string(mountains):
    for m in mountains:
        assert m["normal_index"] == md_to_index(m["normal"]), m["name"]
        assert m["normal_period"] == "1991～2020"


# --- G-05 富士山・甲斐駒ヶ岳の二経路照合 ----------------------------------


@pytest.mark.validation
def test_g05_kofu_pdf_agrees_with_record_pages(records, mountains):
    """S-1(初冠雪の記録ページ・寒候年表記)と S-5(甲府地方気象台 PDF・観測年表記)の突合。

    S-5 は「地上気象観測原簿を基に作成した」と明記された別経路である(PDF 備考)。
    照合は 227 件。1 件でも食い違えば落ちる。
    """
    cc = load("crosscheck.json")
    code_of = {m["name"]: m["code"] for m in mountains}
    checked = 0
    for name in ("富士山", "甲斐駒ヶ岳"):
        rows = {y: v for y, v in records[code_of[name]]}
        for ys, val in cc[name].items():
            y = int(ys)
            if val == MISSING:
                expected = MISSING
            else:
                mo, day = (int(x) for x in re.match(r"(\d+)月(\d+)日", val).groups())
                expected = "%04d/%02d/%02d" % (y, mo, day)
            assert rows.get(y + 1) == expected, "%s %d年: PDF %r / 記録 %r" % (name, y, val, rows.get(y + 1))
            checked += 1
    assert checked >= 200, "照合できた件数が少なすぎる: %d" % checked


@pytest.mark.validation
def test_g05_crosscheck_is_not_a_copy_of_records(records, mountains):
    """陽性対照: 照合が本当に効いているか。片方を 1 日ずらすと落ちること。

    (HC-045 の循環避け。二つの系列が同じファイルの写しでないことを、
     年の表記が違う — 片方は寒候年・片方は観測年 — という形で確かめる。)
    """
    cc = load("crosscheck.json")
    code_of = {m["name"]: m["code"] for m in mountains}
    rows = {y: v for y, v in records[code_of["富士山"]]}
    # 観測年 2024 = 寒候年 2025。年の付け方が違うので、同じ鍵では引けない。
    assert "2024" in cc["富士山"] and 2024 in rows
    assert cc["富士山"]["2024"] == "11月7日"
    assert rows[2025] == "2024/11/07"
    assert rows[2024] != "2024/11/07"
    # ずらしたら落ちる
    shifted = "%04d/%02d/%02d" % (2024, 11, 8)
    assert rows[2025] != shifted


# --- G-10 / G-11 / G-12 目玉 ---------------------------------------------


@pytest.mark.validation
def test_g10_trend_positive_in_almost_every_mountain(trend):
    assert trend["window_from"] == 1967 and trend["min_years"] == 30
    assert trend["n_mountains"] >= 30
    assert trend["n_positive"] >= 30, "正の傾きの山が足りない: %d/%d" % (trend["n_positive"], trend["n_mountains"])
    assert trend["null"]["p_positive"] <= 0.01
    assert trend["null"]["p_median"] <= 0.01


@pytest.mark.validation
def test_g11_theil_sen_agrees_in_sign(trend):
    ts = trend["theil_sen"]
    assert ts["sign_agreement"] >= 30, "符号の一致が足りない: %d" % ts["sign_agreement"]
    assert set(ts["slopes"]) == set(trend["slopes"])


@pytest.mark.unit
def test_g11_estimators_recover_a_planted_slope():
    """陽性対照: 傾きを与えた合成系列を、両推定量が取り戻せること。

    期待値の出所: 合成(y = 2x + 100・ノイズ無し)。前提(x が一意・完全直線)は
    この場で assert して固定する(HC-004)。
    """
    pts = [(x, 2 * x + 100) for x in range(1967, 2027)]
    assert len(set(x for x, _ in pts)) == len(pts)
    assert ols(pts) == pytest.approx(2.0)
    sl = sorted((y2 - y1) / (x2 - x1) for i, (x1, y1) in enumerate(pts) for x2, y2 in pts[i + 1:])
    assert statistics.median(sl) == pytest.approx(2.0)
    flat = [(x, 100) for x in range(1967, 2027)]
    assert ols(flat) == pytest.approx(0.0)


@pytest.mark.validation
def test_g12_null_model_is_unbiased(trend):
    """帰無モデルが偏っていないこと。置換後の中央傾きの中央値は 0 の近くに来るはず。"""
    n = trend["null"]
    assert abs(n["median_of_median_slopes"]) <= 2.0
    assert n["iterations"] == 2000 and n["seed"] == 20260902
    assert len(n["positive_counts"]) == 2000
    # 置換が実際に効いていること: すべて同じ値なら置換していない
    assert len(set(n["positive_counts"])) > 5


@pytest.mark.validation
def test_g10_recompute_slopes_from_records(trend, records):
    """公開している傾きが、公開している記録から再現できること(表示と根拠の一致)。"""
    for code, published in trend["slopes"].items():
        pts = [
            (y, day_index(*(int(x) for x in v.split("/"))))
            for y, v in records[code]
            if y >= trend["window_from"] and DATE_RE.match(v)
        ]
        assert ols(pts) * 100 == pytest.approx(published, abs=1e-6), code


@pytest.mark.validation
def test_g10_excluded_mountains_really_have_no_show_years(trend, records):
    """除外の理由が実データに立っていること(除外リストが緩みすぎないための対)。"""
    for e in trend["excluded"]:
        rows = [r for r in records[e["code"]] if r[0] >= trend["window_from"]]
        n_none = sum(1 for _, v in rows if v == NONE_MARK)
        n_dates = sum(1 for _, v in rows if DATE_RE.match(v))
        assert n_none > 0 or n_dates < trend["min_years"], e["name"]
    included = set(trend["slopes"])
    for e in trend["excluded"]:
        assert e["code"] not in included


# --- 要約値の整合 ---------------------------------------------------------


@pytest.mark.validation
def test_summary_fields_are_derived_from_records(mountains, records):
    """mountains.json の要約(最早・最遅・件数)が records.json から再現できること。"""
    for m in mountains:
        rows = records[m["code"]]
        dates = [(y, v) for y, v in rows if DATE_RE.match(v)]
        assert m["n_dates"] == len(dates)
        assert m["n_missing"] == sum(1 for _, v in rows if v == MISSING)
        assert m["n_none"] == sum(1 for _, v in rows if v == NONE_MARK)
        assert m["first_year"] == rows[0][0] and m["last_year"] == rows[-1][0]
        idx = [(y, day_index(*(int(x) for x in v.split("/")))) for y, v in dates]
        assert m["earliest"]["index"] == min(i for _, i in idx)
        assert m["latest"]["index"] == max(i for _, i in idx)


@pytest.mark.validation
def test_meta_counts_match_data(meta, mountains, records):
    c = meta["counts"]
    assert c["mountains"] == len(mountains) == 44
    assert c["rows"] == sum(len(v) for v in records.values())
    assert c["dates"] + c["missing"] + c["none"] == c["rows"]
    assert c["year_min"] == min(v[0][0] for v in records.values())
    assert c["year_max"] == max(v[-1][0] for v in records.values())
    assert meta["method_change"]["last_visual_year"] == 2026
    assert meta["method_change"]["first_analysis_year"] == 2027


@pytest.mark.validation
def test_latest_covers_every_mountain():
    """今季の表(S-2)が 44 山ぶんあり、山岳名が名簿と一致すること。"""
    latest = load("latest.json")
    names = {r["name"] for r in latest["rows"]}
    official = {m["name"].replace("ケ", "ヶ") for m in load("mountains.json")}
    assert names == official, "今季の表と名簿がずれている: %r" % (names ^ official)
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:00\+09:00$", latest["asof"])
