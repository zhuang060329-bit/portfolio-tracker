# Workflow 規則

## 改動前

1. 先讀 `AGENTS.md`，確認技術棧、設計決策、已知 trade-off，不要重設計已決定的事
2. 列 plan：改什麼、影響哪些檔案、不動哪些區塊
3. 等使用者確認 plan 後才開始實作

## 實作中

- 分階段交付，每階段完成後停下等確認，禁止一次交出全部
- 已確認的決定後續一字不動地保留，不得自行更改
- 遇到架構選擇或設計方向問題，先問，不要憑記憶猜

## 每次改動後的驗收（缺一不可）

依序執行：

1. `npx tsc --noEmit`（型別，0 error）
2. `npx vitest run`（67 tests 全過）
3. `NEXT_TELEMETRY_DISABLED=1 npx next build`（build 無錯）

三者都通過才能 commit。build / test 失敗就停下修，不要 push 失敗的東西。

## Commit 規範

- 每個改動獨立 commit，不要把不相關的改動打包
- Message 用繁中：動機 + 做了什麼 + 驗證結果
- Schema 變更必須在 message 提醒「請到 Supabase 跑 supabase/X.sql」

## 不可逆操作

刪檔、覆寫、`rebase --force`、DB migration 執行前必須先確認，不得自行決定。
