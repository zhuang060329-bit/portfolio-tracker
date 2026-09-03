// 帶退避重試的 fetch：HTTP 429（額度用盡）或 5xx、以及網路錯誤時，指數退避重試。
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 每次嘗試 10s 上限：上游卡死時不拖垮 server render / cron，逾時視同網路錯誤走重試
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(10_000),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }
  throw lastErr ?? new Error(`fetch 失敗：${hostOf(url)} 無回應`);
}

// 只取 host。完整 URL 帶著 `apikey=` query，而這裡拋出的 message 會被
// contributions / accounts 的「抓價失敗：」原封不動顯示在使用者畫面上，
// 也會進 log。host 足以指出哪個上游掛掉，又不帶任何憑證。
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "上游";
  }
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
