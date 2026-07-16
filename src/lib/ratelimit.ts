const windows = new Map<string, { count: number; resetAt: number }>();

/** x-forwarded-for의 첫 번째 항목(클라이언트 IP)을 반환. 없으면 "local". */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "local";
}

/** 프로세스 로컬 고정 윈도우 리미터 (배포 인스턴스별 best-effort) */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  // 만료된 항목을 기회가 될 때마다 정리 (메모리 누수 방지)
  for (const [k, w] of windows) {
    if (w.resetAt <= now) windows.delete(k);
  }

  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
