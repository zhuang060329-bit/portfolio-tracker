# 可觀測性規則

## 禁止吞錯

- `catch` block 不得只有 `console.error` 而不向上 throw 或回傳錯誤狀態
- Server action 失敗必須回傳可識別的錯誤，不得靜默返回
- Cron job 失敗必須有可追蹤的 log，不得靜默結束

## API Error 格式

Server action 與 API route 的錯誤回傳統一結構：

```json
{ "error": "說明", "code": "ERROR_CODE（選用）" }
```

禁止直接把 exception message 或 stack trace 暴露給 client。

## 敏感資料保護

log 與 Sentry 回報中禁止出現：

- env var 值（API key、service_role key、CRON_SECRET）
- 使用者 email / user_id（除非是 admin 操作 log）
- Bearer token 或任何認證憑據

## Cron 監控

每次 cron job（`api/cron/refresh/`）執行時必須 log：

- 開始時間
- 各報價 API（Twelve Data / FinMind / CoinGecko）成功 / 失敗狀態
- 結束時間與總耗時

方便日後追蹤哪個報價 API 掛掉。
