import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import { clearCache } from "../src/lib/cache.js";
import { clearRateLimit } from "../src/lib/rate-limit.js";
import {
  strongAgent,
  weakAgent,
  createFakeRepo,
  sampleStat,
  AGENT_A,
  AGENT_B,
} from "./fixtures.js";

const NOW = 1_760_000_000;

function buildApp() {
  const { agent: a, payments: pa } = strongAgent(NOW);
  const { agent: b, payments: pb } = weakAgent(NOW);
  const repo = createFakeRepo({
    agents: [a, b],
    payments: { [AGENT_A.toLowerCase()]: pa, [AGENT_B.toLowerCase()]: pb },
    stat: sampleStat(NOW),
  });
  return createApp({
    repo,
    now: () => NOW,
    readPool: async () => null, // force indexer-derived pool stats
    enableRateLimit: false,
    enableCache: false,
  });
}

beforeEach(() => {
  clearCache();
  clearRateLimit();
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await buildApp().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});

describe("GET /agents", () => {
  it("lists agents best-score-first with canonical 0–100 scores", async () => {
    const res = await buildApp().request("/agents");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.count).toBe(2);
    expect(body.agents[0].score).toBeGreaterThanOrEqual(body.agents[1].score);
    expect(body.agents[0].score).toBeLessThanOrEqual(100);
    expect(body.agents[0]).toHaveProperty("grade");
    expect(body.agents[0]).toHaveProperty("jobs");
  });
});

describe("GET /agents/:id", () => {
  it("returns a full breakdown with 0–100 factors and revenue series", async () => {
    const res = await buildApp().request(`/agents/${AGENT_A}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.address.toLowerCase()).toBe(AGENT_A.toLowerCase());
    expect(body.factors).toHaveProperty("jobCompletion");
    expect(body.revenue.series).toHaveLength(30);
    expect(body.line.status).toBe("Active");
    expect(body.consistent).toBe(true);
  });

  it("404s for an unknown agent", async () => {
    const res = await buildApp().request("/agents/0xdead");
    expect(res.status).toBe(404);
  });
});

describe("GET /agents/:id/payments", () => {
  it("returns paginated payment history", async () => {
    const res = await buildApp().request(`/agents/${AGENT_A}/payments?limit=5`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.payments.length).toBe(5);
    expect(body.payments[0]).toHaveProperty("amount");
  });
});

describe("GET /pool/stats", () => {
  it("derives TVL / utilization / APY from indexed counters", async () => {
    const res = await buildApp().request("/pool/stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.source).toBe("indexer");
    expect(Number(body.tvl)).toBeGreaterThan(0);
    expect(body.utilization).toBeGreaterThanOrEqual(0);
    expect(body.borrowApr).toBeGreaterThan(0);
    expect(body.defaultRate).toBeGreaterThan(0);
  });
});

describe("POST /agents/:address/onboard", () => {
  it("rejects a malformed address", async () => {
    const res = await buildApp().request("/agents/not-an-address/onboard", { method: "POST" });
    expect(res.status).toBe(400);
  });

  it("no-ops when the oracle signer isn't configured (test env has no ORACLE_PRIVATE_KEY)", async () => {
    const res = await buildApp().request(`/agents/${AGENT_A}/onboard`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ onboarded: false });
  });
});

describe("rate limiting", () => {
  it("returns 429 past the window limit", async () => {
    const { agent: a } = strongAgent(NOW);
    const repo = createFakeRepo({ agents: [a], payments: {} });
    const app = createApp({ repo, now: () => NOW, enableRateLimit: true, enableCache: false });
    // config default max is 120; blast past it.
    let lastStatus = 200;
    for (let i = 0; i < 125; i++) {
      lastStatus = (await app.request("/health")).status;
    }
    expect(lastStatus).toBe(429);
  });
});
