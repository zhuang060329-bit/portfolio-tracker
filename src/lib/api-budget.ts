// 僅供伺服器端使用（透過 service client 繞過 RLS）。嚴禁在前端 import 此檔。
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 免費報價 API 的全域每日預算。
 *
 * 現有的節流只有 refresh-actions.ts 的 per-user 10 分鐘冷卻，那擋的是「同一個人
 * 連打」，不是「全站打爆」。開放註冊之後所有人共用同一組 API key，N 個使用者各自
 * 在冷卻窗外正常操作就能把當日額度用光；用光之後 cron 的自動更新也會失敗，
 * 受影響的是全部人的資料新鮮度。
 *
 * 計數與扣減都在 Postgres 的 consume_api_quota 裡以單一 statement 完成，
 * 避免「先查再寫」的 race。
 */

export type ApiProvider = "twelvedata" | "finmind" | "coingecko";

/**
 * 上限預設值是保守的自訂預算，**不是**各家公布的額度。
 * 請依你實際的方案在環境變數裡設定：
 *   API_BUDGET_TWELVEDATA / API_BUDGET_FINMIND / API_BUDGET_COINGECKO
 */
const DEFAULT_BUDGET = 500;

const ENV_KEY: Record<ApiProvider, string> = {
  twelvedata: "API_BUDGET_TWELVEDATA",
  finmind: "API_BUDGET_FINMIND",
  coingecko: "API_BUDGET_COINGECKO",
};

const LABEL: Record<ApiProvider, string> = {
  twelvedata: "美股報價",
  finmind: "台股報價",
  coingecko: "加密報價",
};

export function budgetFor(provider: ApiProvider): number {
  return parseBudget(process.env[ENV_KEY[provider]]);
}

/** 匯出供測試：環境變數的解析規則。 */
export function parseBudget(raw: string | undefined): number {
  if (raw == null || raw.trim() === "") return DEFAULT_BUDGET;
  const n = Number(raw);
  // 非數字、負數、小數都視為設定錯誤，退回預設值而不是關掉守門。
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return DEFAULT_BUDGET;
  return n;
}

export class ApiBudgetExceededError extends Error {
  readonly provider: ApiProvider;
  constructor(provider: ApiProvider) {
    super(`${LABEL[provider]}今日的共用額度已用完，明天才會重置`);
    this.name = "ApiBudgetExceededError";
    this.provider = provider;
  }
}

/**
 * 扣一次額度。額度不足時丟 ApiBudgetExceededError。
 *
 * 設定不完整（沒有 service key）或資料庫本身出錯時**放行**，只留 log。
 * 這是刻意的：這道關卡是花費上的護欄，不是安全邊界，讓它在自身故障時把
 * 整個 app 的報價功能鎖死，代價高於偶爾超支。相對地，「額度真的用完」
 * 是明確的拒絕，不會被這條 fail-open 蓋過去。
 */
export async function consumeApiQuota(
  provider: ApiProvider,
  cost = 1,
): Promise<void> {
  const limit = budgetFor(provider);

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch {
    console.error(
      `[api-budget] service client 初始化失敗，本次放行 provider=${provider}`,
    );
    return;
  }

  const { data, error } = await svc.rpc("consume_api_quota", {
    p_provider: provider,
    p_limit: limit,
    p_cost: cost,
  });

  if (error) {
    console.error(
      `[api-budget] 扣減失敗，本次放行 provider=${provider} code=${error.code ?? "unknown"}`,
    );
    return;
  }

  // 額度不足時函式不回傳任何列。這是唯一的拒絕條件。
  if (!Array.isArray(data) || data.length === 0) {
    console.error(`[api-budget] 額度用盡 provider=${provider} limit=${limit}`);
    throw new ApiBudgetExceededError(provider);
  }
}

/** 包住一次對外呼叫：先扣額度，扣不到就不打出去。 */
export async function withApiBudget<T>(
  provider: ApiProvider,
  fn: () => Promise<T>,
  cost = 1,
): Promise<T> {
  await consumeApiQuota(provider, cost);
  return fn();
}
