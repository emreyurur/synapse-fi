// Fixed-window per-client rate limiter (in-memory). Adequate for a single-node
// testnet API; swap for a shared store (Redis) before horizontal scaling.

import type { Context, MiddlewareHandler } from "hono";

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

function clientKey(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "local"
  );
}

export function rateLimit(max: number, windowMs: number): MiddlewareHandler {
  return async (c: Context, next) => {
    const key = clientKey(c);
    const now = Date.now();
    let w = windows.get(key);
    if (!w || w.resetAt < now) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(key, w);
    }
    w.count += 1;
    const remaining = Math.max(0, max - w.count);
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(w.resetAt / 1000)));
    if (w.count > max) {
      c.header("Retry-After", String(Math.ceil((w.resetAt - now) / 1000)));
      return c.json({ error: "rate_limited" }, 429);
    }
    return next();
  };
}

export function clearRateLimit(): void {
  windows.clear();
}
