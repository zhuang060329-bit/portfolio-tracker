-- 定期定額計畫加 tier_config（級距加減碼設定）。
--
-- 為什麼要加：計畫原本只有固定金額。使用者用 TradingView 指標
-- 「DCA 七級距加減碼 v2 (含息序列)」決定每期要加碼還是減碼，
-- 每次都得看完指標再回來手動改「本期金額」。這一欄存指標的參數，
-- 帳戶頁依最近收盤算出級距，把建議金額預填進「本期金額」。
--
-- 欄位內容（由 src/lib/schemas/domain/dca-tier-config.ts 驗證）：
--   {
--     "maLength": 200,
--     "drawdown": [{ "pct": -10, "multiplier": 1.25 }, ...],   回撤門檻是負數
--     "premium":  [{ "pct": 10,  "multiplier": 0.9 }, ...]     高於均線門檻是正數
--   }
-- null 代表這個計畫是固定金額，行為與加這一欄之前完全相同。
-- 既有計畫全部是 null。
--
-- 為什麼用 jsonb 而不是拆欄位或另開一張表：
-- 級距是 4 + 2 組（門檻、倍數），一律整組讀、整組寫，沒有任何查詢會依
-- 單一門檻篩選。拆成 13 個欄位只是讓每次調整級數都要再跑一次 migration。
-- check 只擋「不是物件」；形狀由程式端驗證，讀到格式不對的值時
-- 頁面顯示設定無效、不套用倍數。
--
-- 這個 migration 不改任何函式，也不改 RLS：
--   execute_recurring_plan_mutation  不讀這一欄。金額照舊由 p_amount_override 帶入，
--                                    而且只有手動執行能帶；cron 一律用 amount_twd
--   recurring_plans 的 policy        是 for all using (auth.uid() = user_id)，新欄位自動涵蓋
--
-- 執行順序：要在讀寫 tier_config 的程式部署之前跑。
-- 沒跑的話帳戶頁查 recurring_plans 會收到 column does not exist，
-- 定期定額區塊顯示「讀不到定期定額計劃」；cron 不受影響（它不查這一欄）。
--
-- 可以整個貼進 SQL Editor 一次跑完，重跑也安全（if not exists）。

alter table public.recurring_plans
  add column if not exists tier_config jsonb
  check (tier_config is null or jsonb_typeof(tier_config) = 'object');

notify pgrst, 'reload schema';
