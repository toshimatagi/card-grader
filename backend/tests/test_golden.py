"""ゴールデン回帰テスト（OpenCV 決定的経路）。

閾値変更が既知カードのスコアを劣化させていないかを検出する安全網。
`GEMINI_API_KEY` を空にして AI（非決定的）をスキップし、OpenCV 経路のみを検証する。
そのため import より前に環境変数を空へ設定している。

初期ゴールデン値は 2026-07-09 の実測（許容 ±0.5）。閾値ロジックを意図的に変えて
スコアが動いた場合は、変更が妥当なら本ファイルのゴールデン値も更新する。
"""

import os

# AI をスキップして OpenCV 決定的経路にする（grading の import より前に設定する）
os.environ["GEMINI_API_KEY"] = ""
os.environ["Gemini_API_Key"] = ""

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402

from backend.services.grading import grade_card  # noqa: E402

IMAGES_DIR = Path(__file__).resolve().parents[2] / "images"

SCORE_TOL = 0.5   # スコアの許容差
BORDER_TOL = 5.0  # センタリング border px の許容差（比率フォールバックに落ちれば桁で外れる）

# 2026-07-09 実測のゴールデン値
GOLDEN = {
    "IMG_2958.JPG": {
        "brand": "onepiece",
        "overall": 8.0,
        "sub": {"centering": 10.0, "surface": 9.5, "color_print": 7.5, "edges_corners": 5.0},
        "borders": (5.0, 5.0, 5.0, 5.0),   # L, R, T, B（color_border 検出成功時の値）
        "surface_defects_range": (0, 4),
        "is_holo": True,
    },
    "IMG_2853.JPG": {
        "brand": "onepiece",
        "overall": 8.5,
        "sub": {"centering": 8.5, "surface": 10.0, "color_print": 7.0, "edges_corners": 7.5},
        "borders": (42.0, 59.0, 53.0, 44.0),
        "surface_defects_range": (0, 3),
        "is_holo": True,
    },
}


@pytest.fixture(scope="module")
def graded():
    """各画像を1回だけ鑑定して結果をキャッシュする（重い処理なので module スコープ）。"""
    results = {}
    for name, g in GOLDEN.items():
        path = IMAGES_DIR / name
        assert path.exists(), f"テスト画像が見つからない: {path}"
        results[name] = grade_card(path.read_bytes(), card_type="standard", brand=g["brand"])
    return results


@pytest.mark.parametrize("name", list(GOLDEN.keys()))
def test_overall_grade(graded, name):
    g = GOLDEN[name]
    got = graded[name]["overall_grade"]
    assert got == pytest.approx(g["overall"], abs=SCORE_TOL), (
        f"{name}: overall {got} が golden {g['overall']} ±{SCORE_TOL} から外れた"
    )


@pytest.mark.parametrize("name", list(GOLDEN.keys()))
def test_sub_grades(graded, name):
    g = GOLDEN[name]
    sub = graded[name]["sub_grades"]
    for key, expected in g["sub"].items():
        got = sub[key]["score"]
        assert got == pytest.approx(expected, abs=SCORE_TOL), (
            f"{name}: {key} {got} が golden {expected} ±{SCORE_TOL} から外れた"
        )


@pytest.mark.parametrize("name", list(GOLDEN.keys()))
def test_centering_not_ratio_fallback(graded, name):
    """センタリングが color_border 検出できており、比率フォールバックに落ちていないこと。

    border px が実測値近傍にあることを確認する。比率フォールバックに落ちると
    border が固定比率（数十px規模）へ跳ねるため、この許容差で検出できる。
    """
    g = GOLDEN[name]
    d = graded[name]["sub_grades"]["centering"]["detail"]
    got = (d["left_border"], d["right_border"], d["top_border"], d["bottom_border"])
    for side, gv, ev in zip(("L", "R", "T", "B"), got, g["borders"]):
        assert gv == pytest.approx(ev, abs=BORDER_TOL), (
            f"{name}: {side} border {gv} が golden {ev} ±{BORDER_TOL} から外れた"
            "（比率フォールバックに落ちた可能性）"
        )


@pytest.mark.parametrize("name", list(GOLDEN.keys()))
def test_surface_defects_range(graded, name):
    g = GOLDEN[name]
    defects = graded[name]["sub_grades"]["surface"]["detail"].get("defects", [])
    assert isinstance(defects, list)
    lo, hi = g["surface_defects_range"]
    assert lo <= len(defects) <= hi, (
        f"{name}: surface defects 件数 {len(defects)} が想定レンジ {lo}〜{hi} 外"
    )


@pytest.mark.parametrize("name", list(GOLDEN.keys()))
def test_is_holo(graded, name):
    g = GOLDEN[name]
    got = graded[name]["sub_grades"]["color_print"]["detail"]["is_holo"]
    assert got == g["is_holo"], f"{name}: is_holo {got} が golden {g['is_holo']} と不一致"
