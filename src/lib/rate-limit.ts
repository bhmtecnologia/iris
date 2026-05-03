/**
 * Lightweight in-memory token-bucket rate limiter. Per-process — fine for
 * Sprint 5. Swap for Upstash Redis in production for multi-region/serverless.
 */
type Bucket = { tokens: number; updatedAt: number };

const store = new Map<string, Bucket>();

export function rateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const bucket = store.get(opts.key) ?? { tokens: opts.limit, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / opts.windowMs) * opts.limit;
  bucket.tokens = Math.min(opts.limit, bucket.tokens + refill);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    store.set(opts.key, bucket);
    const retryAfterMs = Math.ceil(((1 - bucket.tokens) * opts.windowMs) / opts.limit);
    return { ok: false, retryAfterMs };
  }

  bucket.tokens -= 1;
  store.set(opts.key, bucket);
  return { ok: true };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
