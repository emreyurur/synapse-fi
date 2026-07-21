// Tiny in-memory TTL cache + a Hono middleware that memoizes GET responses.
// Keeps the API cheap under the frontend's TanStack Query polling; the TTL is
// meant to sit at or below the client's staleTime.

import type { Context, MiddlewareHandler } from "hono";

interface Entry {
  body: string;
  status: number;
  expiresAt: number;
}

const store = new Map<string, Entry>();

export function cacheGet(key: string): Entry | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit;
}

export function cacheSet(key: string, body: string, status: number, ttlMs: number): void {
  store.set(key, { body, status, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  store.clear();
}

/** Caches successful GET JSON responses by full URL for `ttlMs`. */
export function cacheMiddleware(ttlMs: number): MiddlewareHandler {
  return async (c: Context, next) => {
    if (c.req.method !== "GET") return next();
    const key = c.req.url;
    const hit = cacheGet(key);
    if (hit) {
      return new Response(hit.body, {
        status: hit.status,
        headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }
    await next();
    if (c.res.status === 200) {
      const cloned = c.res.clone();
      const body = await cloned.text();
      cacheSet(key, body, c.res.status, ttlMs);
      c.header("X-Cache", "MISS");
    }
  };
}
