# StackWorth UI/UX 優化 — 決策紀錄

> 本檔是長 session 的記憶錨。每段開工前先重讀；每段確認後把該段決定追加到「變更紀錄」。
> 規則：診斷以截圖為準、code 為輔。已確認的決定一字不動。改 code 前必須有使用者明確「開始改 / 下一段」。

---

## 不可動禁區（路徑為準）

- `src/app/api/**` 全部
- Supabase client / schema / migration：`src/lib/supabase/**`、`supabase/**`
- 價格 provider 架構：`src/lib/prices/**`
- `src/lib/**` 的資料計算函式（xirr / metrics / whatif / whatif-project / alerts-scan / contributions / csv-import-helpers …）—— 可改呼叫端「呈現方式」，不可改函式本身
- 路由結構（URL、頁面層級）= 等同邏輯變更，不可動
- 後端邏輯（server actions 的行為）不可改；只動其呈現/樣式

若視覺優化「必須」動到上述，停下來問：為什麼非動不可、影響範圍多大。

---

## 階段 1 診斷（按嚴重度，編號固定供 commit 引用）

### P0 — 傷害投資工具可信度的數據呈現
- **D1** 總覽 hero 報價時間是原始 ISO `2026-06-11T06:03:38.67+00:00`（未格式化、非台北時區）。`DashboardClient.tsx:202` 直接吐 `last_priced_at`。桌機＋手機都中。
- **D2** 淨資產趨勢 Y 軸刻度重複「4萬 / 4萬 / 3萬 / 3萬 / 3萬」。`fmtCompact` 取到「萬」整數，窄區間相鄰刻度塌成同字 → 軸失去刻度意義。桌機＋手機都中。

### P1 — 資訊架構 / 版面
- **D3** 總覽「績效指標」空狀態吃掉整個右半欄；兩欄等高，一邊有料一邊空 → 大面積死白像壞圖。
- **D4** 每頁同一個開頭節奏（← 回總覽 ＋ serif 大標 ＋ muted 副標），activity/alerts/whatif 幾乎逐字同構。頁與頁無結構差異。
- **D5** 活動時間軸靠左、寬螢幕右半頁全空，空間沒用到。
- **D6** Hero 副指標單位制打架：總成本「4萬」、未實現「−4,027」、表格市值「19,083」同層級三種尺度。

### P1 — 視覺層級 / 一致性
- **D7** 圓角全站 ≥9 種（`2xl/xl/lg/md` ＋ `[18][14][13][11][10][9]px`），與語意不對應，是 pixel-spec 殘留而非節奏。
- **D8** 卡片質感全站同一招（`rounded-2xl + border + shadow + surface`）；設定頁是最典型的盒裝卡片堆疊。缺輕重/疏密對比。
- **D9** 配置卡「目標」marker（細直線）壓在實際長條上，寬度小對比低，該強調的很平。

### P2 — 互動 / 細節
- **D10** 提醒條件預覽未填值顯示「≥US$ —」，「—」夾在單位與「時提醒我」中間突兀。
- **D11** 同一張趨勢卡三種切換器語彙：segmented（淨值/大盤）、pill（範圍 tabs）、圓點 legend。
- **D13** 手機：總覽「淨值/大盤對照」segmented 文字直排換行（「淨 值」「大盤對 照」）。
- **D14** 手機：QuickAddFab 浮層會壓住趨勢卡切換器。

### 最關鍵 — 「通用 AI 模板味」
暗底＋金 accent＋等樣式圓角卡瀑布＋每頁「標題/副標/卡片堆疊」一眼像高級暗色 SaaS 模板。
有記憶點的只有 hero 大字與活動時間軸；其餘靠「卡片裝資料」撐，版面不因內容而異。
兩欄等高（配置｜指標）＝禁令點名的等寬 feature grid 變體。

---

## 選定方向：A —《帳本》密度優先（使用者於本輪確認）

**主張**：把 StackWorth 從「暗色 SaaS 卡片瀑布」改造成「一本帳本 / 金融終端機」。
以分隔線與表格化排版取代盒裝卡片；數字 tnum 右對齊、單位制一致；密度優先，
刻意製造疏密對比（重點淨值給呼吸、明細擠緊）；用次級數據填掉死白，而非留大空盒。

**取捨**：得到專業終端機的密度與效率、最直接攻擊卡片模板味；犧牲留白高級感，
對新手較有壓迫（接受）。

**落地原則（提案，待逐段確認後生效）**
1. **去卡片化**：多數 boxed card 改「區段標題 + hairline 分隔線 + 內容」；只有 hero、可操作面板保留輕量容器。收斂 shadow 濫用。
2. **數字系統**：一套 tnum 右對齊、單位制一致的呈現（解 D6）；修 D1 時間格式（台北時區、人類可讀）、D2 軸標重複，作為數據呈現基本功。
3. **密度節奏**：明細/表格行高壓緊；hero 與關鍵數字留空間。
4. **填實死白**：D3 指標空卡、D5 活動右側 → 補次級數據（配置摘要 / 當期現金流統計 / 迷你行情），不留空盒。
5. **token 收斂**：半徑收成 2–3 級、分隔/陰影收成 1–2 級（解 D7/D8）。
6. **切換器統一**：segmented / pill / 圓點收斂成一致語彙（解 D11、D13）。

**已定**
- 「精簡數字」toggle：**只做靜態格式一致化**，不碰 toggle 接線（偏好讀寫邏輯不動）。D6 用「同一情境同一規則」解，不依賴該 toggle。（使用者本輪確認）

---

## 階段 2 執行計畫（提案順序，待使用者確認 / 可調整）

每段獨立 commit、message 標 D 編號；改完先跑 build + lint，附桌機/手機檢查與檔案清單。

- **Block 1 — 基礎：數字呈現 + 設計 token**（D1, D2, D6, D7 起手）
- **Block 2 — 總覽去卡片化 + 填實指標空卡**（D3, D5-analog, D8）
- **Block 3 — 活動：密度 + 右側填實**（D5）
- **Block 4 — 設定：去卡片化成帳本列**（D8）
- **Block 5 — 提醒 + What-if：marker 可見度 + 切換器收斂**（D9, D11）
- **Block 6 — 切換器語彙統一 + 手機修正**（D11, D13, D14）

---

## 變更紀錄（每段確認後追加）

> ⚠️ repo 真實路徑＝`D:\ClaudeCode\projects\portfolio-tracker`（不是 `D:\ClaudeCode\portfolio-tracker`，後者本回合一度殘留一個空殼）。後續 Read/Write/Edit/git 一律用 `projects\` 路徑。

### Block 1 — 數字呈現 + 設計 token（D1, D2, D6, D7 起手）
- 新增 `src/lib/format.ts`：`fmtFull` / `fmtCompact`（萬帶 1 位小數，解 D2 軸標重複）/ `fmtUpdatedAt`（台北時區可讀，解 D1）。Direction A 數字系統單一來源。
- `DashboardCharts.tsx`：`fmtTwd`/`fmtCompact` 改從 `lib/format` 來（集中），匯入端不變。軸刻度因 1 位小數不再塌成同字。
- `DashboardClient.tsx`：hero 報價時間改 `fmtUpdatedAt`（D1）；hero 副指標四格改 `fmtTwd` 全位數（解 D6，與主數字/表格同情境同規則）；donut 中心、被動收入維持 compact（緊湊情境，規則一致）。
- `globals.css`：定義 `--r-card / --r-control / --r-pill`（D7 半徑收斂）；總覽卡片殼與 hero 四格先套 `--r-card`，其餘頁面在各自 block 漸進換。
- 數字規則：全位數＝hero 主數字/副指標/表格；compact 萬億＝圖表軸/donut 中心/被動收入。
- 驗證：tsc ✅ eslint ✅ next build ✅ vitest 45 ✅。
- RWD：Block 1 不改版面；唯一寬度相關變化＝hero 副指標改全位數（略長）。目前資料（4 萬級）桌機/手機 2×2 皆容得下；**待觀察**：8 位數以上大組合在手機半寬格的字級溢出，留待 Block 2 總覽改版時一併處理字級。
- 動過檔案：`src/lib/format.ts`(新)、`src/components/dashboard/DashboardCharts.tsx`、`src/components/dashboard/DashboardClient.tsx`、`src/app/globals.css`、`DESIGN_DECISIONS.md`。

### Block 2 — 總覽去卡片化 + 填實指標空卡（D3, D8）
- 移除 `Card` 盒殼元件（border+shadow+surface 圓角盒）；改帳本式分區：各區段 = 頂部 hairline + 上內距（共用 `SECTION` const = `mt-7 border-t pt-7`）。
- 趨勢 / 配置 / 指標 / 持有資產 全部去盒裝，內容直接落在 page 背景，靠分隔線分區（解 D8 卡片瀑布）。
- 配置 + 指標併成同一區段：桌機 2 欄中間用垂直分隔線（border-l），手機上下排用水平線。
- **D3**：指標 + 被動收入都沒料時，不再渲染半欄空盒——配置改滿版 + 一行「待快照滿 30 天」說明；指標區空狀態的虛線盒也改成精簡單行。
- 持有資產：桌機表格拿掉外框/陰影成扁平帳本表（靠列分隔線）；手機卡片改成去盒裝帳本列（底線分隔）。標題字級與其他區段對齊（24→19px）。`+新增帳戶` 按鈕半徑改 `--r-control`。
- 驗證：tsc ✅ eslint ✅ next build ✅ vitest 45 ✅。
- RWD：桌機＝配置｜指標 2 欄帶垂直分隔，持有資產扁平表；手機＝全部單欄、帳本列。無 box 後不再有等高空盒。**待你實機確認**：手機去盒裝後密度是否過緊、分隔線在深色下對比是否足夠。
- 動過檔案：`src/components/dashboard/DashboardClient.tsx`、`DESIGN_DECISIONS.md`。
