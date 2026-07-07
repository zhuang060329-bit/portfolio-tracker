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
  throw lastErr ?? new Error(`fetch 失敗：${url}`);
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
