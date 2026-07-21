// Builds the Hono application. Dependencies (repo, chain reader, clock) are
// injected so the app can be exercised in tests with in-memory fixtures.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Repo } from "./repo.js";
import { scoreAgent } from "./scoring/service.js";
import {
  presentAgentSummary,
  presentAgentDetail,
  presentPayment,
  presentPoolStats,
} from "./presenter.js";
import { cacheMiddleware } from "./lib/cache.js";
import { rateLimit } from "./lib/rate-limit.js";
import { config } from "./config.js";
import type { PoolChainState } from "./chain.js";
import { ensureMockScore } from "./oracle/mock-score.js";

export interface AppDeps {
  repo: Repo;
  readPool?: () => Promise<PoolChainState | null>;
  now?: () => number; // seconds
  enableRateLimit?: boolean;
  enableCache?: boolean;
}

export function createApp(deps: AppDeps): Hono {
  const { repo } = deps;
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const app = new Hono();

  app.use("*", logger());
  app.use("*", cors());
  if (deps.enableRateLimit ?? true) {
    app.use("*", rateLimit(config.rateLimitMax, config.rateLimitWindowMs));
  }
  if (deps.enableCache ?? true) {
    app.use("/agents/*", cacheMiddleware(config.cacheTtlMs));
    app.use("/agents", cacheMiddleware(config.cacheTtlMs));
    app.use("/pool/*", cacheMiddleware(config.cacheTtlMs));
  }

  app.get("/health", (c) => c.json({ ok: true, service: "synapsefi-api", chainId: config.chainId }));

  // GET /agents — live agent list (Agent Market), best score first.
  app.get("/agents", async (c) => {
    const agents = await repo.listAgents();
    const t = now();
    const rows = await Promise.all(
      agents.map(async (a) => {
        const payments = await repo.getPayments(a.address, 500);
        return presentAgentSummary(a, scoreAgent(a, payments, t));
      }),
    );
    return c.json({ agents: rows, count: rows.length });
  });

  // GET /agents/:id — full breakdown: score factors, line, revenue series, history.
  app.get("/agents/:id", async (c) => {
    const id = c.req.param("id");
    const agent = await repo.getAgent(id);
    if (!agent) return c.json({ error: "not_found" }, 404);
    const [payments, repayments] = await Promise.all([
      repo.getPayments(agent.address, 500),
      repo.getRepayments(agent.address, 200),
    ]);
    const score = scoreAgent(agent, payments, now());
    return c.json(presentAgentDetail(agent, score, payments, repayments));
  });

  // GET /agents/:id/payments — routed payment history with pagination.
  app.get("/agents/:id/payments", async (c) => {
    const id = c.req.param("id");
    const limit = Math.min(500, Number(c.req.query("limit") ?? 100));
    const agent = await repo.getAgent(id);
    if (!agent) return c.json({ error: "not_found" }, 404);
    const payments = await repo.getPayments(agent.address, limit);
    return c.json({ agent: agent.address, payments: payments.map(presentPayment), count: payments.length });
  });

  // POST /agents/:address/onboard — MVP demo onboarding: any wallet with no
  // fresh oracle score gets a deterministic mock one written on-chain, so it
  // clears CreditLineManager.minScore and can actually open a line / draw
  // against the real deployed contracts instead of only viewing "Apply for a
  // line" with a $0 limit. No-op if the address already has a live score.
  app.post("/agents/:address/onboard", async (c) => {
    const address = c.req.param("address");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return c.json({ error: "invalid_address" }, 400);
    try {
      const result = await ensureMockScore(address as `0x${string}`);
      if (!result) return c.json({ onboarded: false });
      return c.json({ onboarded: true, ...result });
    } catch (err) {
      console.error("[api] onboard failed", err);
      return c.json({ error: "onboard_failed", message: (err as Error).message }, 502);
    }
  });

  // GET /pool/stats — TVL, utilization, APY, default rate (chain-first).
  app.get("/pool/stats", async (c) => {
    const [stat, live] = await Promise.all([
      repo.getProtocolStat(),
      deps.readPool ? deps.readPool() : Promise.resolve(null),
    ]);
    return c.json(presentPoolStats({ stat, live }));
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((err, c) => {
    console.error("[api] error", err);
    return c.json({ error: "internal", message: err.message }, 500);
  });

  return app;
}
