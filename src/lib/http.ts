/**
 * 외부 요청 공통 유틸: 소스별 rate limit(최소 1초 간격),
 * User-Agent 명시, exponential backoff 최대 2회 재시도, 메모리 캐시(10분 TTL).
 */

const USER_AGENT =
  "FurnitureFitFinder/0.1 (personal furniture dimension search; contact: local dev)";

const MIN_INTERVAL_MS = 1000;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 10 * 60 * 1000;

// ---------- rate limiter (소스별 직렬화 + 최소 간격) ----------
const queues = new Map<string, Promise<void>>();
const lastRun = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** source 단위로 호출 간 최소 1초 간격을 보장 */
export async function rateLimited<T>(source: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(source) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  queues.set(source, prev.then(() => gate));

  await prev;
  try {
    const wait = MIN_INTERVAL_MS - (Date.now() - (lastRun.get(source) ?? 0));
    if (wait > 0) await sleep(wait);
    lastRun.set(source, Date.now());
    return await fn();
  } finally {
    release();
  }
}

// ---------- 메모리 캐시 ----------
interface CacheEntry {
  expires: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();

export function cacheGet<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    cache.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs = CACHE_TTL_MS): void {
  if (cache.size > 500) {
    // 만료분 정리 (간단한 상한)
    for (const [k, e] of cache) if (Date.now() > e.expires) cache.delete(k);
  }
  cache.set(key, { expires: Date.now() + ttlMs, value });
}

// ---------- fetch with retry ----------
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  { retries = MAX_RETRIES, timeoutMs = 10_000 }: { retries?: number; timeoutMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1)); // 500ms, 1000ms
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
        continue; // 재시도 대상
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      // 4xx 등 재시도 무의미한 에러는 즉시 전파
      if (err instanceof Error && /^HTTP 4/.test(err.message)) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** rate limit + 캐시를 한번에: 동일 쿼리는 10분간 재요청하지 않음 */
export async function cachedSourceFetch<T>(
  source: string,
  cacheKey: string,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(cacheKey);
  if (hit !== undefined) return hit;
  const value = await rateLimited(source, fn);
  cacheSet(cacheKey, value);
  return value;
}
