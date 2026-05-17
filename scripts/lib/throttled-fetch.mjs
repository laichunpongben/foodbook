// Throttled fetch factory shared by scripts that talk to Wikimedia. The
// closure owns `lastFetchAt`, so each caller gets an independent
// rate-limited fetcher with its own UA, gap, and retry budget.
//
// Gap is enforced on request *start*, not completion — slow requests
// don't earn extra credit. Wikimedia rate-limits on starts too.
//
// `allowStatus` lets a caller treat specific non-2xx codes as terminal
// success (e.g. 404 from a HEAD probe is information, not failure).

export function createThrottledFetcher({
  ua,
  gapMs,
  maxRetries = 3,
  backoffBaseMs = 5000,
  allowStatus = [],
}) {
  let lastFetchAt = 0;
  return async function throttledFetch(url, init) {
    const wait = Math.max(0, lastFetchAt + gapMs - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastFetchAt = Date.now();
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": ua },
        ...init,
      });
      if (res.ok || allowStatus.includes(res.status)) return res;
      if (res.status === 429 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, backoffBaseMs * (attempt + 1)));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    }
    throw new Error("exhausted retries");
  };
}

export async function asBuffer(res) {
  return Buffer.from(await res.arrayBuffer());
}
