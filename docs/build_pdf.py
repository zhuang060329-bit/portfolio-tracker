# -*- coding: utf-8 -*-
"""
StackWorth 專案文件 PDF 生成。
- 用 reportlab 內建 CJK 字型 MSung-Light（繁中），不需外部 ttf
- 結構：封面 → 一句話 → 能做什麼 → 功能清單 → 技術全貌 →
  開發歷程 → 部署流程 → 你要做的事 → 已知限制 → 未來方向
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont  # noqa: F401
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
    KeepTogether,
)

# 註冊繁中字型 — 用 Windows 系統的微軟正黑體 ttf
# msjh.ttc / msjhbd.ttc 是 TrueType Collection，subfontIndex=0 為基本款
pdfmetrics.registerFont(
    TTFont("JhengHei", "C:/Windows/Fonts/msjh.ttc", subfontIndex=0)
)
pdfmetrics.registerFont(
    TTFont("JhengHeiBd", "C:/Windows/Fonts/msjhbd.ttc", subfontIndex=0)
)

CJK = "JhengHei"
CJK_BOLD = "JhengHeiBd"

# === 樣式 ===
STY_TITLE = ParagraphStyle(
    "Title", fontName=CJK_BOLD, fontSize=28, leading=36,
    alignment=TA_CENTER, textColor=colors.HexColor("#1f2937"),
    spaceAfter=10,
)
STY_SUBTITLE = ParagraphStyle(
    "Subtitle", fontName=CJK, fontSize=14, leading=20,
    alignment=TA_CENTER, textColor=colors.HexColor("#6b7280"),
    spaceAfter=8,
)
STY_H1 = ParagraphStyle(
    "H1", fontName=CJK_BOLD, fontSize=20, leading=28,
    textColor=colors.HexColor("#111827"),
    spaceBefore=18, spaceAfter=10,
    borderPadding=0,
)
STY_H2 = ParagraphStyle(
    "H2", fontName=CJK_BOLD, fontSize=14, leading=20,
    textColor=colors.HexColor("#1f2937"),
    spaceBefore=12, spaceAfter=6,
)
STY_H3 = ParagraphStyle(
    "H3", fontName=CJK_BOLD, fontSize=12, leading=18,
    textColor=colors.HexColor("#374151"),
    spaceBefore=8, spaceAfter=4,
)
STY_BODY = ParagraphStyle(
    "Body", fontName=CJK, fontSize=10.5, leading=17,
    textColor=colors.HexColor("#1f2937"),
    alignment=TA_LEFT, spaceAfter=6,
)
STY_BODY_JUST = ParagraphStyle(
    "BodyJ", parent=STY_BODY, alignment=TA_JUSTIFY,
)
STY_QUOTE = ParagraphStyle(
    "Quote", fontName=CJK, fontSize=11, leading=18,
    textColor=colors.HexColor("#4b5563"),
    leftIndent=14, rightIndent=14,
    spaceBefore=6, spaceAfter=8,
    borderColor=colors.HexColor("#d1d5db"),
    borderWidth=0,
    borderPadding=10,
    backColor=colors.HexColor("#f9fafb"),
)
STY_CODE = ParagraphStyle(
    "Code", fontName="Courier", fontSize=9, leading=12,
    textColor=colors.HexColor("#0f172a"),
    backColor=colors.HexColor("#f1f5f9"),
    leftIndent=10, rightIndent=10,
    spaceBefore=4, spaceAfter=8,
    borderPadding=8,
)
STY_BULLET = ParagraphStyle(
    "Bullet", parent=STY_BODY,
    leftIndent=18, bulletIndent=6, bulletFontName=CJK,
    spaceAfter=3,
)
STY_NOTE = ParagraphStyle(
    "Note", fontName=CJK, fontSize=9.5, leading=14,
    textColor=colors.HexColor("#6b7280"),
    leftIndent=10, rightIndent=10,
    spaceBefore=4, spaceAfter=8,
)
STY_FOOTNOTE = ParagraphStyle(
    "Foot", fontName=CJK, fontSize=8, leading=11,
    textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER,
)


def p(text, style=STY_BODY):
    return Paragraph(text, style)


def bullets(items, style=STY_BULLET):
    out = []
    for it in items:
        out.append(Paragraph(f"• {it}", style))
    return out


def section_break():
    return Spacer(1, 6)


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(CJK, 8)
    canvas.setFillColor(colors.HexColor("#9ca3af"))
    # 頁腳
    canvas.drawString(2 * cm, 1.2 * cm, "StackWorth 專案紀實")
    canvas.drawRightString(
        A4[0] - 2 * cm, 1.2 * cm, f"第 {doc.page} 頁"
    )
    # 頁眉細線
    canvas.setStrokeColor(colors.HexColor("#e5e7eb"))
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, A4[1] - 1.6 * cm, A4[0] - 2 * cm, A4[1] - 1.6 * cm)
    canvas.restoreState()


def make_table(rows, col_widths, head_color="#1f2937"):
    """通用兩色表格。第一列為表頭。"""
    tbl = Table(rows, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(
        TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), CJK_BOLD),
            ("FONTNAME", (0, 1), (-1, -1), CJK),
            ("FONTSIZE", (0, 0), (-1, -1), 9.5),
            ("LEADING", (0, 0), (-1, -1), 14),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(head_color)),
            ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f9fafb")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.HexColor("#ffffff"), colors.HexColor("#f9fafb")]),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, 0),
             0.75, colors.HexColor("#374151")),
            ("LINEBELOW", (0, 1), (-1, -2),
             0.25, colors.HexColor("#e5e7eb")),
        ])
    )
    return tbl


# ============================================================
# 內容
# ============================================================

story = []

# ---------- 封面 ----------
story.append(Spacer(1, 5 * cm))
story.append(p("StackWorth", STY_TITLE))
story.append(p("個人投資組合追蹤工具", STY_SUBTITLE))
story.append(Spacer(1, 1.5 * cm))
story.append(p("從零到上線：完整開發紀實", ParagraphStyle(
    "CoverSub2", fontName=CJK, fontSize=12, alignment=TA_CENTER,
    textColor=colors.HexColor("#6b7280"),
)))
story.append(Spacer(1, 8 * cm))
story.append(p(
    "作者帳號：zhuang060329@gmail.com<br/>"
    "部署網址：portfolio-tracker-two-rho.vercel.app<br/>"
    "原始碼：github.com/zhuang060329-bit/portfolio-tracker<br/>"
    "本文件由 Claude Code 協助整理",
    STY_FOOTNOTE,
))
story.append(PageBreak())

# ---------- 目錄 ----------
story.append(p("目錄", STY_H1))
toc_items = [
    ("1.", "這份文件在講什麼", 3),
    ("2.", "一句話介紹 StackWorth", 3),
    ("3.", "它能幫你做什麼（白話版）", 4),
    ("4.", "完整功能一覽", 5),
    ("5.", "幕後用了哪些技術", 7),
    ("6.", "開發歷程：從零到現在", 9),
    ("7.", "每次更新怎麼上線", 12),
    ("8.", "你現在還需要做的事", 13),
    ("9.", "目前的限制與已知 trade-off", 14),
    ("10.", "未來可以加的功能", 15),
]
toc_rows = [["編號", "章節", "頁碼"]]
for num, title, page in toc_items:
    toc_rows.append([num, title, str(page)])
story.append(make_table(toc_rows, [1.5 * cm, 12 * cm, 2 * cm]))
story.append(PageBreak())

# ---------- 1. 這份文件 ----------
story.append(p("1. 這份文件在講什麼", STY_H1))
story.append(p(
    "這份 PDF 整理了 StackWorth 這個專案從第一行程式碼到目前的所有重點。"
    "目標是讓沒寫過程式的人也能讀完 — 所以盡量避免術語，技術細節會配上"
    "白話比喻。",
    STY_BODY_JUST,
))
story.append(p(
    "讀完之後你會知道：這個工具是做什麼用的、目前長什麼樣、用了哪些"
    "外部服務（這些服務要不要錢、為什麼選它）、每次想加新功能要走"
    "什麼流程、現在還有什麼地方沒做完或做不到。",
    STY_BODY_JUST,
))
story.append(p(
    "建議閱讀順序：先看第 2、3 節快速理解這是什麼；想了解功能細節跳到"
    "第 4 節；對開發過程有興趣看第 6 節；要實際用起來看第 8 節。",
    STY_BODY_JUST,
))

# ---------- 2. 一句話 ----------
story.append(p("2. 一句話介紹 StackWorth", STY_H1))
story.append(p(
    "StackWorth 是一個個人的「資產儀表板」 — 把你散落在不同地方的"
    "投資（美股、台股、加密貨幣、銀行存款）集中到一個網頁，自動抓最新"
    "報價，用新台幣統一算總值。",
    STY_QUOTE,
))
story.append(p("拿生活上熟悉的東西打比方：", STY_H3))
story.append(p(
    "如果你的投資是分散在多個皮夾的鈔票，現在每次想知道「我總共有多少錢」"
    "都要打開每個皮夾數一次。StackWorth 就是把每個皮夾用透明壓克力盒裝起來，"
    "每天自動拍張照給你看裡面有多少 — 而且還會把外幣即時換成台幣。",
    STY_BODY_JUST,
))
story.append(PageBreak())

# ---------- 3. 能做什麼 ----------
story.append(p("3. 它能幫你做什麼（白話版）", STY_H1))

scenarios = [
    ("早上起床想看「我目前總身家多少」",
     "打開首頁，最頂端用大字顯示 TWD 總淨資產。下方拆解成「成本」、"
     "「未實現損益」、「已實現損益」、「總報酬」、「年化報酬」。"),
    ("剛在券商買了一筆股票想記錄",
     "首頁右下角有個橘色圓形「＋」按鈕，點下去選帳戶、填投入金額（台幣）"
     "就好 — 系統會用當下市價自動算出你買到幾股。"),
    ("想知道自己選股有沒有比 ALL-In 大盤好",
     "首頁的「績效對照」圖把你的組合跟 S&amp;P 500、Nasdaq 100、"
     "台灣 0050 三條線疊在一起；「What-if」頁更直接 — 把你的歷史投入"
     "假設全買某 ETF 並算到今天值多少。"),
    ("擔心某檔跌破或漲破某個價",
     "「警示」頁面設「QQQM 漲破 220」這類規則，每天自動掃。"
     "觸發後鈴鐺出現紅點，點進通知中心看明細。"),
    ("每年 5 月報稅找海外所得明細",
     "設定頁有「年度稅務報表」按鈕，選年度下載 CSV — 內含當年所有賣出、"
     "配息、利息紀錄，欄位按國稅局申報常用格式排好。"),
    ("想知道每月被動收入有多少（FIRE 規劃）",
     "首頁的「被動收入」區塊顯示「今年累積」「近 12 個月」「月均」"
     "「配息率（YoC）」。"),
    ("懷疑自己策略有沒有效（不是運氣）",
     "首頁「進階績效指標」區塊：TWR（剔除時機影響的真實報酬）、"
     "最大回撤、Sharpe ratio。"),
]
sce_rows = [["使用場景", "StackWorth 怎麼回答你"]]
for s, a in scenarios:
    sce_rows.append([Paragraph(s, STY_BODY), Paragraph(a, STY_BODY)])
story.append(make_table(sce_rows, [5.5 * cm, 9.5 * cm]))
story.append(PageBreak())

# ---------- 4. 完整功能 ----------
story.append(p("4. 完整功能一覽", STY_H1))

story.append(p("4.1 帳戶管理", STY_H2))
story.append(p(
    "支援四種帳戶類型，建立時系統會立刻抓一次價格驗證：",
    STY_BODY,
))
story.extend(bullets([
    "美股（如 QQQM、VOO）— 用 Twelve Data 抓 USD 報價，再用即時匯率換 TWD",
    "台股（如 0050、2330）— 用 FinMind 抓 TWD 報價",
    "加密貨幣（用 CoinGecko ID，例 bitcoin、ethereum）— CoinGecko 直接回 TWD",
    "手動帳戶 — 例如銀行存款、保單現金價值；不自動抓價，餘額自己改",
]))
story.append(p(
    "每個帳戶可以「加碼買入」（依 TWD 金額自動換股數）、「賣出」"
    "（系統算已實現損益）、「記錄配息／利息」、「調整數量／餘額」、"
    "「歸檔」、「刪除」。",
    STY_BODY,
))

story.append(p("4.2 自動更新", STY_H2))
story.append(p(
    "Vercel 設定的排程每天台北時間 14:00 自動：",
    STY_BODY,
))
story.extend(bullets([
    "刷新所有非手動帳戶的最新市價",
    "把當天淨值寫進每日快照（畫趨勢圖用）",
    "執行所有「next_run_date 已到」的定期定額計劃",
    "掃描所有 active 警示，觸發者寫入通知",
]))

story.append(p("4.3 報表與圖表", STY_H2))
story.extend(bullets([
    "資產配置甜甜圈圖 — 依資產類別分佈，附百分比 label",
    "淨資產趨勢折線 — 可切 1 月／3 月／6 月／1 年／全部",
    "績效對照圖 — 與 SPY／QQQ／0050 三條基準同時比，"
    "其中 SPY／QQQ 已換算成 TWD 避免匯率污染",
    "配置目標 vs 實際 — 偏離 ±5% 以上自動標紅",
    "績效指標卡 — TWR 累積／年化、最大回撤、Sharpe ratio",
    "被動收入面板 — 今年累積、近 12 個月、月均、配息率 YoC",
]))

story.append(p("4.4 警示與通知", STY_H2))
story.extend(bullets([
    "三種警示：價格突破上界、價格跌破下界、配置偏離超過 X%",
    "AppHeader 右上有鈴鐺 icon 顯示未讀紅點",
    "「通知中心」頁面 — 觸發紀錄、可標已讀",
    "價格警示觸發後自動停用，避免天天重發；配置警示 24 小時內最多一次",
]))

story.append(p("4.5 匯入與匯出", STY_H2))
story.extend(bullets([
    "CSV 匯入配息／利息 — 支援中英文欄位、多種日期格式、自動洗金額",
    "全部交易紀錄 CSV 匯出 — 給備份用",
    "年度稅務報表 CSV — 按年度抓賣出／配息／利息，附年度小計",
]))

story.append(p("4.6 What-if 模擬", STY_H2))
story.append(p(
    "把你實際的所有投入時點與金額，假設全部買某個 ETF（Buy and Hold）"
    "用該日收盤價，最後對到今天市值。回答「如果我當時 ALL-In SPY"
    "會不會更好」這類問題。會列出實際組合 vs SPY／QQQ／0050 四者排名。",
    STY_BODY,
))

story.append(p("4.7 帳號與安全", STY_H2))
story.extend(bullets([
    "註冊：Email/密碼 + Google OAuth 兩種",
    "Email 驗證信機制",
    "忘記密碼／重設密碼",
    "MFA 雙因素驗證（TOTP，Google Authenticator 可用）",
    "登入時若帳號已啟用 MFA，會強制要 6 位數驗證才能進入",
    "Admin 管理頁 — 列出所有註冊使用者、可踢出特定人",
    "RLS（資料列層權限）— 每個 user 在資料庫只能讀寫自己的資料",
]))

story.append(p("4.8 行動裝置體驗", STY_H2))
story.extend(bullets([
    "響應式佈局 — Holdings／Activity 表格在手機自動切成卡片堆疊",
    "右下浮動「＋」按鈕 — 手機優先設計的快速記帳",
    "PWA manifest — 可加到主畫面當 app 用",
    "深色模式（跟隨系統或手動切）",
]))
story.append(PageBreak())

# ---------- 5. 技術全貌 ----------
story.append(p("5. 幕後用了哪些技術", STY_H1))
story.append(p(
    "這節用白話解釋每個技術選擇的理由，看不懂的部分可以略過 — "
    "知道「用了哪些服務、要不要付費」就夠了。",
    STY_BODY,
))

tech_rows = [
    ["角色", "技術 / 服務", "為什麼選它", "費用"],
    ["前端框架",
     "Next.js 16 + React 19",
     "目前最主流的 React 框架，server-rendered 速度快、SEO 友善",
     "免費"],
    ["樣式",
     "Tailwind CSS v4",
     "用 className 寫樣式，不必另外寫 CSS 檔，深色模式好做",
     "免費"],
    ["圖表",
     "Recharts",
     "React 生態最常用的圖表庫，與 Next.js 整合好",
     "免費"],
    ["後端與資料庫",
     "Supabase",
     "Postgres 資料庫 + Auth（含 OAuth、MFA）+ Storage 一站式，"
     "免費額度對個人專案完全夠用",
     "免費"],
    ["部署",
     "Vercel",
     "Next.js 官方推薦平台，Git push 即自動部署，含 CDN",
     "免費（Hobby）"],
    ["美股報價",
     "Twelve Data",
     "免費 API，支援即時價與歷史 daily close",
     "免費（800 calls/day）"],
    ["台股報價",
     "FinMind",
     "免費的台灣股市資料 API，含 0050 歷史與外匯",
     "免費"],
    ["加密貨幣報價",
     "CoinGecko",
     "免費 API 可直接回 TWD，不必另外換匯",
     "免費"],
    ["定時排程",
     "Vercel Cron",
     "Next.js 內建 cron，每天 14:00 Taipei 自動跑",
     "免費"],
    ["錯誤監控",
     "Sentry（可選）",
     "未設 DSN 時自動關閉；正式環境用來抓未捕捉的錯誤",
     "免費（5k events/月）"],
]
story.append(make_table(
    tech_rows, [2.3 * cm, 3.2 * cm, 7 * cm, 2.5 * cm]
))

story.append(p("5.1 資料怎麼存", STY_H2))
story.append(p(
    "Supabase 的 Postgres 裡有這幾張主要的表：",
    STY_BODY,
))
db_rows = [
    ["表名稱", "存什麼"],
    ["profiles", "每個使用者的偏好（例如配置目標）"],
    ["accounts", "每個投資帳戶（含持有量、成本、最後報價、市場）"],
    ["transactions", "所有變動紀錄（建帳戶、加碼、賣出、配息、利息、調整）"],
    ["account_snapshots", "每天每個帳戶的淨值快照（畫趨勢圖用）"],
    ["recurring_plans", "定期定額計劃"],
    ["alerts", "警示規則"],
    ["notifications", "通知紀錄（站內顯示用）"],
]
story.append(make_table(db_rows, [4 * cm, 11 * cm]))
story.append(p(
    "每張表都有 RLS policy 綁 user_id — 也就是即使 API 被亂打，"
    "資料庫層級會擋下「讀別人的資料」這種請求。",
    STY_NOTE,
))

story.append(p("5.2 一筆交易發生時系統做了什麼", STY_H2))
story.append(p(
    "舉例：你在首頁 FAB 按「加碼 QQQM 5 萬」，背後的流程：",
    STY_BODY,
))
flow_rows = [
    ["順序", "動作"],
    ["1", "前端把 accountId + 金額 包成 FormData 送到 Server Action"],
    ["2", "Server 從 Supabase 抓該帳戶當前狀態與市價"],
    ["3", "用 50000 / (現價 × 匯率) 算出股數"],
    ["4", "寫一筆 transactions row（type=adjust_quantity）"],
    ["5", "更新 accounts.quantity, cost_basis_twd, cost_basis_native"],
    ["6", "Upsert 今天的 account_snapshot"],
    ["7", "revalidatePath 讓首頁拿到最新資料"],
    ["8", "前端 modal 自動關閉"],
]
story.append(make_table(flow_rows, [1.5 * cm, 13.5 * cm]))
story.append(PageBreak())

# ---------- 6. 開發歷程 ----------
story.append(p("6. 開發歷程：從零到現在", STY_H1))
story.append(p(
    "整個專案分成幾個大階段。每個階段都有明確的「動機 → 做了什麼 → "
    "驗證」三個環節。",
    STY_BODY,
))

phases = [
    {
        "title": "階段 0：基礎架構（最初的兩週）",
        "goal": "把一個空專案撐到「能登入、能建帳戶、能看總值」這個最小可用狀態。",
        "did": [
            "用 create-next-app 起 Next.js 16 + Tailwind v4 骨架",
            "接 Supabase Auth：先做 Google OAuth，後補 Email/密碼",
            "設計四張核心表：profiles / accounts / transactions / account_snapshots",
            "寫 RLS policy 確保每個 user 只能讀寫自己的資料",
            "建第一版首頁：總淨資產 + Holdings 表格",
            "整合三家報價：Twelve Data（美股）、FinMind（台股）、CoinGecko（加密）",
        ],
    },
    {
        "title": "階段 1：交易完整化",
        "goal": "讓帳戶不只是「現在有什麼」，而是有完整歷史紀錄與成本計算。",
        "did": [
            "transactions 表 enum 加 sell / dividend / interest",
            "accounts 加 cost_basis_twd、cost_basis_native（區分台幣成本與原幣成本）",
            "賣出計算已實現損益（平均成本法）",
            "FX/Market PnL 拆解 — 知道虧的是匯率還是市場",
            "XIRR 用 Newton-Raphson 算年化",
            "Recurring plans 表 + cron 自動執行定期定額",
        ],
    },
    {
        "title": "階段 2：UI 全面重做",
        "goal": "原本 demo 階段的版面看起來像 prototype。要做到能放作品集的水準。",
        "did": [
            "建立 CSS 變數系統（--c-page / --c-surface / --c-accent 等）支援深色模式",
            "Tailwind v4 + @custom-variant dark 對應 [data-theme=\"dark\"]",
            "Recharts 接圖表：甜甜圈、淨資產折線、績效對照折線",
            "AppHeader / ThemeToggle 統一導覽",
            "Holdings 表桌機與手機自動切換（桌機表格、手機卡片）",
            "FOUC 預防腳本 — 開機立即套主題避免白色閃一下",
        ],
    },
    {
        "title": "階段 3：上線（情境 B 開放註冊）",
        "goal": "從只能本地跑變成公開網址，讓家人朋友也能用。",
        "did": [
            "推 GitHub → Vercel auto-deploy",
            "解決 commit author 不匹配導致 deploy 被擋的問題（git rebase --root）",
            "從 email allowlist 模式改成「開放註冊 + admin 踢人」",
            "建 /admin/allowlist 頁面用 Service Role Key 列使用者",
            "robots.txt + meta noindex 避免被 Google 索引",
            "PWA manifest 可加到主畫面",
            "Sentry SDK 條件式啟用（沒設 DSN 不會跑）",
        ],
    },
    {
        "title": "階段 4：安全強化",
        "goal": "公開上線後，帳號被竊風險變高。加雙因素驗證。",
        "did": [
            "Settings 頁加 MFA section（TOTP，Google Authenticator 可掃）",
            "登入流程加 AAL2 升級：通過密碼後若帳號有 MFA factor，"
            "強制跳轉 /auth/mfa 輸入 6 位數",
            "Proxy（前 Middleware）攔截未驗證 AAL2 的 session，"
            "禁止存取受保護路徑",
        ],
    },
    {
        "title": "階段 5：UI/UX 大改版",
        "goal": "使用者實際用了一週後給了 14 點批改 — 從顏色慣例到密度問題逐項處理。",
        "did": [
            "損益顏色從台股慣例改成西方慣例（賺綠虧紅），與英文介面一致",
            "XIRR 資料 < 30 天時隱藏（避免 5 天虧 10% 變 -99% 年化的失真）",
            "Total return 只在已實現損益 ≠ 0 時才出現，避免重複",
            "Allocation pie 加百分比 label，legend 也帶百分比",
            "折線加粗（2 → 2.5）、Y 軸 padding 避免水平線",
            "Performance benchmark 換顯眼色（藍 + 紫 + 綠）",
            "全 UI 中文化（標題、表頭、按鈕、導覽）",
            "Add account 改兩欄網格，Activity 加統計摘要",
        ],
    },
    {
        "title": "階段 6：StackWorth 改名 + 多基準 + 範圍切換",
        "goal": "提升專業度與比較深度。",
        "did": [
            "品牌改名 Portfolio Tracker → StackWorth",
            "績效對照加 S&amp;P 500（SPY）和 Nasdaq 100（QQQ），與 0050 並列",
            "圖表加範圍切換 chip：1 月 / 3 月 / 6 月 / 1 年 / 全部",
            "切換後對所選範圍重新 normalize 起點 = 100",
            "三個 loading.tsx skeleton（首頁、Activity、帳戶詳情）",
            "PerformanceLine 改成多 series 動態渲染",
        ],
    },
    {
        "title": "階段 7：功能與實用性大躍進",
        "goal": "從「能看」進到「主動服務你」 — 警示、報稅、進階指標、模擬。",
        "did": [
            "修 Performance 匯率 bug：SPY/QQQ × 當日 USD/TWD 才比較",
            "警示與通知系統（含 alerts / notifications 兩張新表）",
            "首頁右下浮動 FAB 快速記帳",
            "/api/export/tax-csv 年度稅務報表 CSV",
            "進階績效指標：TWR / 最大回撤 / Sharpe（含 9 個單元測試）",
            "被動收入面板：今年累積、近 12 個月、月均、配息率 YoC",
            "CSV 匯入擴充：中英文欄位別名、多日期格式、金額洗值",
            "What-if 模擬器：用實際現金流回測 ALL-In ETF 的結果",
        ],
    },
    {
        "title": "階段 8：自檢與修正",
        "goal": "做完一輪後重新掃整個專案，修掉真的有問題的部分。",
        "did": [
            "抽 fetchTw0050 到 prices/finmind.ts 與其他兩個歷史抓取函式同構",
            "alerts / notifications / whatif 三頁補 loading skeleton",
            "QuickAddFab 帳戶沒市價時前端立刻 disable + 提示",
            "稅務報表「成交單價」「匯率」欄改成「（僅賣出）」"
            "避免使用者誤讀 dividend 列的空白",
        ],
    },
]

for ph in phases:
    story.append(KeepTogether([
        p(ph["title"], STY_H2),
        p(f"目標：{ph['goal']}", STY_BODY),
    ]))
    story.extend(bullets(ph["did"]))
    story.append(Spacer(1, 4))

story.append(PageBreak())

# ---------- 7. 部署流程 ----------
story.append(p("7. 每次更新怎麼上線", STY_H1))
story.append(p(
    "從寫程式碼到網址上看得到新版，完整流程：",
    STY_BODY,
))
deploy_rows = [
    ["步驟", "做什麼", "誰做"],
    ["1", "本機改 code", "開發者"],
    ["2", "跑 npx tsc --noEmit、npx eslint、npx vitest", "開發者"],
    ["3", "跑 npx next build 確認可部署", "開發者"],
    ["4", "git commit → git push origin main", "開發者"],
    ["5", "GitHub 收到 push 後 webhook 通知 Vercel", "自動"],
    ["6", "Vercel 拉 code、安裝相依、跑 build、部署到 CDN", "自動"],
    ["7", "Production URL 立刻看得到新版本", "自動"],
    ["8", "若有資料庫變更，到 Supabase SQL Editor 跑對應 .sql", "開發者"],
]
story.append(make_table(deploy_rows, [1.2 * cm, 11.3 * cm, 2.5 * cm]))

story.append(p("7.1 排程（cron）跑什麼", STY_H2))
story.append(p(
    "Vercel cron 設定每天 06:00 UTC（= 台北 14:00）打 /api/cron/refresh。"
    "這個 API 會做四件事：",
    STY_BODY,
))
story.extend(bullets([
    "刷新所有非手動 active 帳戶的最新報價，並寫今日 snapshot",
    "執行所有 active 且 next_run_date 已到的定期定額",
    "掃描所有 active 警示，觸發者寫進 notifications",
    "回傳 JSON 報告（成功 N 筆、失敗 N 筆、各項錯誤）",
]))
story.append(p(
    "Cron 路由有 Bearer Token 驗證（CRON_SECRET），其他人打不進來。",
    STY_NOTE,
))
story.append(PageBreak())

# ---------- 8. 你還需要做的事 ----------
story.append(p("8. 你現在還需要做的事", STY_H1))
story.append(p(
    "純程式碼變更都已自動部署上線。但有幾件事需要你親自操作。",
    STY_BODY,
))

story.append(p("8.1 必做：Supabase 跑警示系統的 SQL", STY_H2))
story.append(p(
    "警示與通知用到的 alerts / notifications 兩張表還沒在資料庫建立。"
    "不跑這步，/alerts 與 /notifications 頁面打開會錯。",
    STY_BODY,
))
story.append(p("操作流程：", STY_H3))
story.extend(bullets([
    "進 Supabase Dashboard → 你的專案 → 左側 SQL Editor",
    "點 New query，把 supabase/alerts.sql 整個檔內容貼進去",
    "點 Run，看到 Success 表示完成",
    "回 app /alerts 試新增一筆警示，能存進去就 OK",
]))

story.append(p("8.2 選做：配 email 警示", STY_H2))
story.append(p(
    "目前警示觸發只在站內鈴鐺顯示，不發 email。要發 email：",
    STY_BODY,
))
story.extend(bullets([
    "到 resend.com 註冊（免費 100 封/天）",
    "在 Vercel 專案 → Settings → Environment Variables 加 RESEND_API_KEY",
    "告訴我「開 email 通知」我再幫你接 Resend SDK 到 scanAlerts 裡",
]))

story.append(p("8.3 選做：邀請家人朋友使用", STY_H2))
story.extend(bullets([
    "把 portfolio-tracker-two-rho.vercel.app 給他們",
    "他們自己用 email 註冊，收驗證信點確認連結",
    "若不想他們再進來，到 /admin/allowlist 把他們踢掉",
]))

story.append(p("8.4 例行：每年 5 月報稅前", STY_H2))
story.extend(bullets([
    "進 /settings 找「年度稅務報表」",
    "選去年（例 2025），下載 CSV",
    "對照券商扣繳憑單填寫海外所得申報",
    "本表是「自記補強」，不是官方憑單；以扣繳憑單為主",
]))
story.append(PageBreak())

# ---------- 9. 已知限制 ----------
story.append(p("9. 目前的限制與已知 trade-off", STY_H1))
story.append(p(
    "誠實列出 — 沒有任何專案是完美的，知道限制比假裝沒有更有用。",
    STY_BODY,
))

limit_rows = [
    ["項目", "限制", "為什麼沒解決"],
    ["TwelveData 免費版",
     "每天 800 calls、每分鐘 8 calls。多人共用或重度使用會撞上限",
     "升級付費版每月 USD$10 起；個人單用內預估不會碰到"],
    ["FinMind 免費版",
     "每分鐘 60 calls",
     "個人使用內足夠；多人共用要升級"],
    ["Vercel Hobby",
     "Cron 每日最多 2 次；函式 timeout 10 秒",
     "現在一天一次足夠；超過要升 Pro USD$20/月"],
    ["匯率精度",
     "用「即期買賣中價」當 USD/TWD，跟券商實際成交匯率有 0.1-0.3% 差距",
     "個人記帳精度夠；要精準須輸入券商實際匯率"],
    ["手動帳戶估值",
     "不會自動抓價，餘額由人工更新",
     "本來就是這個設計（給銀行存款、保單用）"],
    ["XIRR 短期失真",
     "資料 < 30 天不顯示年化",
     "刻意設計 — 5 天虧 10% 年化成 -99% 是數學上正確但實務無意義"],
    ["What-if 假設",
     "不考慮配息再投資、交易成本、滑價",
     "簡化才能跑；想精準回測需要更多參數"],
    ["按鈕風格四種變體",
     "主／強／邊框／危險四種按鈕散在各頁",
     "重構成 Button component 影響面大；現有體驗 OK 暫不動"],
    ["AppHeader 多次查詢",
     "每個 server page 自己 fetch unreadCount 餵 AppHeader",
     "DRY 違規但成本是一個 COUNT query，可接受"],
]
story.append(make_table(
    limit_rows, [3 * cm, 5.5 * cm, 6.5 * cm]
))
story.append(PageBreak())

# ---------- 10. 未來方向 ----------
story.append(p("10. 未來可以加的功能", STY_H1))
story.append(p(
    "之前討論過但暫未實作的清單。要做哪些可以後續討論優先級。",
    STY_BODY,
))

future_rows = [
    ["項目", "說明", "工作量"],
    ["Email 警示",
     "上面 8.2 提到，配 Resend 即可開",
     "小"],
    ["DRIP 自動再投資",
     "配息自動觸發加碼（目前要兩步操作）",
     "小"],
    ["年配息率 / 月被動收入細分",
     "把被動收入面板拆得更細 — 月 / 季 / 年",
     "小"],
    ["多基準幣別",
     "目前 base 固定 TWD；移居後可能要 EUR / USD",
     "中"],
    ["匿名分享 read-only 連結",
     "給家人看自己的進度不用登入",
     "中"],
    ["券商 CSV 格式自動辨識",
     "支援富邦、永豐、Binance、MAX 等特定格式直接 import",
     "大（需真實 CSV 樣本）"],
    ["自動同步券商持倉",
     "Binance / Coinbase 有 read-only API key；台灣券商沒",
     "大"],
    ["匯率歷史 snapshot",
     "目前 cost basis 用當下匯率算，匯率劇變時誤差累積",
     "中"],
    ["字體選擇",
     "目前 serif 標題 + sans-serif 內文；可換 IBM Plex / Inter",
     "小（設計決定）"],
    ["搬遷 Mac",
     "2026 年 6 月把開發環境從 Windows 移到 Mac",
     "中（屆時協助）"],
]
story.append(make_table(future_rows, [3.5 * cm, 9 * cm, 2 * cm]))

story.append(p("結語", STY_H1))
story.append(p(
    "StackWorth 從 demo 階段的 prototype，走到具備完整警示／報稅／"
    "進階指標／模擬的個人理財工具，中間經歷了 9 個 commit 階段、"
    "39 個單元測試、18 個路由、約 9500 行 TypeScript 代碼。",
    STY_BODY_JUST,
))
story.append(p(
    "工具的價值不在功能多，而在能不能持續被使用。最關鍵的可能不是"
    "TWR 或 Sharpe，而是手機浮動 FAB — 它直接決定你會不會記帳。",
    STY_BODY_JUST,
))
story.append(p(
    "目前狀態：功能完整、自動化齊全、安全強化、上線運作。剩下的是"
    "你的使用習慣養成。",
    STY_BODY_JUST,
))
story.append(Spacer(1, 1.5 * cm))
story.append(p(
    "—— 完 ——",
    ParagraphStyle(
        "End", fontName=CJK, fontSize=10, alignment=TA_CENTER,
        textColor=colors.HexColor("#9ca3af"),
    )
))


# ============================================================
# 建 PDF
# ============================================================

doc = SimpleDocTemplate(
    "StackWorth-專案紀實.pdf",
    pagesize=A4,
    leftMargin=2 * cm,
    rightMargin=2 * cm,
    topMargin=2 * cm,
    bottomMargin=2 * cm,
    title="StackWorth 專案紀實",
    author="zhuang060329@gmail.com",
)

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("OK")
