export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with a timeout and a few retries on rate limits / server errors. */
export async function getText(url, { retries = 3, timeoutMs = 20000, headers = {} } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "OhioDaybook/1.0 (+https://github.com)", ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

export async function getJSON(url, opts) {
  return JSON.parse(await getText(url, opts));
}

/** Hide API keys when logging URLs. */
export function redact(url) {
  return String(url).replace(/(apikey|client_id|client_secret)=[^&]+/gi, "$1=***");
}
