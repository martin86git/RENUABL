/** Server only. A simple per-visitor limit for endpoints that cost money per call (per server instance). */
const buckets = new Map<string, { n: number; since: number }>();

export function allow(request: Request, name: string, perHour: number): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${name}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.since >= 3_600_000) {
    buckets.set(key, { n: 1, since: now });
    if (buckets.size > 10_000) buckets.clear();
    return true;
  }
  return ++b.n <= perHour;
}
