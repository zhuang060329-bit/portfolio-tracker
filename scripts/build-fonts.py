#!/usr/bin/env python3
"""產生 src/app/fonts/ 底下的自架字體檔（Plex Sans、Plex Mono 三字重、Noto Sans TC）。

這支腳本**不在建置流程裡**。產出的 .woff2 直接 commit 進 repo，
Vercel 建置不需要 Python，也不需要對外抓字體。
只有要換字體、改字集、或上游字體更新時才需要重跑。

用法：

    python3 -m venv .venv-fonts
    .venv-fonts/bin/pip install fonttools brotli
    .venv-fonts/bin/python scripts/build-fonts.py

為什麼自架：next/font/google 本身已經會在建置時把字體抓下來自架，
執行期不連 Google。問題出在「建置時」——抓 Noto Sans TC 失敗過好幾次，
建置就跟著掛。改成本地檔案後這個外部相依整個消失。

代價：next/font/local 沒辦法逐檔宣告 unicode-range，所以 Google 那套
105 個切片的機制沒了，改成一包 Big5 常用字。取捨的實測數字見 AGENTS.md。
"""

import pathlib
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "app" / "fonts"
CACHE = ROOT / ".font-src"

UPSTREAM = {
    "NotoSansTC[wght].ttf": "ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf",
    "IBMPlexSans[wdth,wght].ttf": "ofl/ibmplexsans/IBMPlexSans%5Bwdth%2Cwght%5D.ttf",
    # IBM Plex Mono 上游只有靜態字重，沒有變數檔（google/fonts 的 ofl/ibmplexmono
    # 底下是 14 個 static ttf）。所以這支破例，只收實際用到的三個字重。
    "IBMPlexMono-Regular.ttf": "ofl/ibmplexmono/IBMPlexMono-Regular.ttf",
    "IBMPlexMono-Medium.ttf": "ofl/ibmplexmono/IBMPlexMono-Medium.ttf",
    "IBMPlexMono-SemiBold.ttf": "ofl/ibmplexmono/IBMPlexMono-SemiBold.ttf",
}

# 等寬字集。2026-09-26 測繪桌翻新前只收數字與英數（DIGITS），因為當時 Mono
# 只服務首頁帳本的數字。翻新後 Mono 也負責測量註記、軸標、代號與 hero 大數字，
# 會出現括號、#、@、< > 之類的字元，所以擴到完整可列印 ASCII，
# 再加上註記用的幾個符號：
#   U+00A0 不斷行空白   U+00B1 ±   U+00B7 ·   U+00D7 ×
#   U+2013–2014 – —    U+2026 …   U+2190–2193 ← ↑ → ↓   U+2212 −   U+2248 ≈
# 仍然不收整個 LATIN：附加符號（重音字母等）在註記與數字裡用不到。
# Δ（U+0394）上游 Plex Mono 沒有這個字，列了也收不到，要用就掉到 Plex Sans。
MONO = (
    "U+0020-007E,U+00A0,U+00B1,U+00B7,U+00D7,U+2013-2014,U+2026,"
    "U+2190-2193,U+2212,U+2248"
)

# Google Fonts 的 "latin" 切片範圍，逐字抄自 css2 API 的輸出。
# Plex Sans 沿用這個範圍，跟改動前的涵蓋範圍一致。
LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,"
    "U+2212,U+2215,U+FEFF,U+FFFD"
)

# UI 用到、但拉丁範圍與 Big5 常用字都沒收的字元。
# 少了這些，箭頭、勾勾、展開三角形會變成豆腐。
# 由 scripts/build-fonts.py 的 --audit 模式掃出來，改動 UI 文案後值得重掃一次。
EXTRA = "₿↔↻≈≤≥⊘⌕▸✓✦⤓⬆閾饋～￥"


def big5_block(lo: int, hi: int) -> set[str]:
    """把 Big5 某段前導位元組解碼成字元集合。"""
    out: set[str] = set()
    trail = list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF))
    for lead in range(lo, hi + 1):
        for t in trail:
            try:
                out.add(bytes([lead, t]).decode("big5"))
            except UnicodeDecodeError:
                pass
    return out


def fetch(name: str, path: str) -> pathlib.Path:
    CACHE.mkdir(exist_ok=True)
    dest = CACHE / name
    if not dest.exists():
        url = f"https://github.com/google/fonts/raw/main/{path}"
        print(f"  下載 {name}")
        with urllib.request.urlopen(url) as r:
            dest.write_bytes(r.read())
    return dest


def pin(src: pathlib.Path, **axes: float) -> pathlib.Path:
    """把用不到的變數軸釘死再子集化。

    IBM Plex Sans 上游帶 wght 與 wdth 兩軸，專案沒有任何地方用 font-stretch。
    留著那條軸要多 22 KB（68.3 → 46.3 KB），釘掉純賺，wght 100–700 不受影響。
    """
    dest = CACHE / f"{src.stem}-pinned.ttf"
    if not dest.exists():
        instancer.instantiateVariableFont(TTFont(src), axes, inplace=False).save(dest)
    return dest


def run(src: pathlib.Path, out: pathlib.Path, *, unicodes=None, text=None) -> None:
    args = [str(src), "--layout-features=*", "--flavor=woff2", f"--output-file={out}"]
    if unicodes:
        args.append(f"--unicodes={unicodes}")
    if text:
        args.append(f"--text={text}")
    subset.main(args)
    size = out.stat().st_size / 1024
    n = len(TTFont(out).getBestCmap())
    print(f"  {out.name}: {size:,.1f} KB / {n:,} 字")


def audit() -> None:
    """掃出 UI 文案裡拉丁與 Big5 常用字都沒收的字元，用來維護 EXTRA。"""
    ranges = []
    for part in LATIN.split(","):
        p = part.strip()[2:]
        a, _, b = p.partition("-")
        ranges.append((int(a, 16), int(b or a, 16)))
    covered = big5_block(0xA1, 0xA3) | big5_block(0xA4, 0xC6)
    missing = set()
    for pat in ("*.ts", "*.tsx", "*.css"):
        for p in (ROOT / "src").rglob(pat):
            for ch in p.read_text(encoding="utf-8", errors="ignore"):
                if ord(ch) <= 0x7F:
                    continue
                if any(a <= ord(ch) <= b for a, b in ranges) or ch in covered:
                    continue
                missing.add(ch)
    extra = set(EXTRA)
    print(f"UI 需要的額外字元 {len(missing)} 個: {''.join(sorted(missing))}")
    if missing - extra:
        print(f"  ⚠ EXTRA 沒收到: {''.join(sorted(missing - extra))}")
        sys.exit(1)
    print("  EXTRA 涵蓋完整")


def main() -> None:
    if "--audit" in sys.argv:
        audit()
        return

    OUT.mkdir(parents=True, exist_ok=True)
    print("取得上游變數字體")
    srcs = {n: fetch(n, p) for n, p in UPSTREAM.items()}

    print("拉丁字體（變數，一個檔涵蓋全字重）")
    run(
        pin(srcs["IBMPlexSans[wdth,wght].ttf"], wdth=100),
        OUT / "IBMPlexSans-latin.woff2",
        unicodes=LATIN,
    )

    print("等寬（靜態三字重：400 / 500 / 600，可列印 ASCII + 註記符號）")
    for weight, name in ((400, "Regular"), (500, "Medium"), (600, "SemiBold")):
        run(
            srcs[f"IBMPlexMono-{name}.ttf"],
            OUT / f"IBMPlexMono-{weight}-ascii.woff2",
            unicodes=MONO,
        )

    print("繁中字體（Big5 符號區 + 常用字 + UI 額外符號）")
    chars = big5_block(0xA1, 0xA3) | big5_block(0xA4, 0xC6) | set(EXTRA)
    run(srcs["NotoSansTC[wght].ttf"], OUT / "NotoSansTC-big5.woff2", text="".join(sorted(chars)))

    print("\n完成。字體檔要 commit 進 repo。")


if __name__ == "__main__":
    main()
