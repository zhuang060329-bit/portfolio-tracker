# ADR-001：StackWorth v1 資料語意

- 狀態：Accepted
- 日期：2026-07-18
- 範圍：決策日誌、歷史重播、報酬歸因、壓力測試、月報

## 背景

v1 需要回看過去狀態與決策背景，同時保留現有 XIRR、TWR、active portfolio 與原子寫入語意。現有每日 snapshot 足以支援個人使用情境，但缺少帳戶狀態歷史、決策快照與可核對的期間歸因。

## 決定

1. 決策建立時由 server action 讀取使用者擁有的帳戶與 snapshot，寫入 `context_snapshot`。資料庫 trigger 禁止日後改寫該 JSON 與擷取時間；一般決策文字仍可編輯。
2. 帳戶 active/archive 轉換寫入 `account_status_history`。歷史重播只取選定日期以前的帳戶、狀態、交易、決策與 snapshot。
3. 缺少當日價格時可沿用最近前一筆 snapshot，但 UI 必須顯示來源日期。不得使用今天價格，也不做無標示插值。
4. 歸因使用可核對方程，將投入、提領、價格、匯率、收入、範圍變動與 residual 分開。已實現損益只作 memo，避免和賣出現金流重複計算。
5. residual 容差採資產規模的 0.1%，最低 TWD 1。超標時顯示資料品質警告。
6. 壓力測試是純函式且只讀。重疊 shock 依穩定順序用乘法套用；試買視為外部新資金，不寫回 ledger。
7. 月報組合既有金融函式與 v1 純函式。PDF 採瀏覽器列印，避免加入 server-side Chromium。

## 影響

- 新增一個 versioned migration，並保留舊部署的 forward-only 升級路徑。
- 每個新表都有 ownership、foreign key、index、constraint 與逐操作 RLS。
- replay 與月報查詢在 server 端按日期過濾，snapshot 上限 10,000 筆；達上限時顯示限制，不把截斷結果當成完整資料。
- 決策檢討的自動績效取決於決策日後的已存 snapshot。資料不足時回傳 null 與缺口說明。
