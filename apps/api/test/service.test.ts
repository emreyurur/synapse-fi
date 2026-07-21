import { describe, it, expect } from "vitest";
import { parseUnits } from "viem";
import { dailyRevenueSeries, buildScoringInput, scoreAgent } from "../src/scoring/service.js";
import { computeEpoch, epochNumber } from "../src/oracle/epoch.js";
import { toOnchainScore } from "@synapsefi/shared";
import { strongAgent, weakAgent, bootstrapAgent, createFakeRepo, AGENT_A } from "./fixtures.js";

const NOW = 1_760_000_000;
const usdc = (n: number) => parseUnits(n.toFixed(6), 6);

describe("dailyRevenueSeries", () => {
  it("buckets inflows into the trailing window, oldest first", () => {
    const day = 86_400;
    const series = dailyRevenueSeries(
      [
        { amount: usdc(10), timestamp: NOW - 29 * day }, // first bucket
        { amount: usdc(5), timestamp: NOW }, // last bucket
        { amount: usdc(99), timestamp: NOW - 100 * day }, // out of window
      ],
      NOW,
      30,
    );
    expect(series).toHaveLength(30);
    expect(series[0]).toBeCloseTo(10, 5);
    expect(series[29]).toBeCloseTo(5, 5);
    expect(series.reduce((a, b) => a + b, 0)).toBeCloseTo(15, 5);
  });
});

describe("scoreAgent", () => {
  it("scores a strong agent highly and flags on-chain consistency", () => {
    const { agent, payments } = strongAgent(NOW);
    const s = scoreAgent(agent, payments, NOW);
    expect(s.score).toBeGreaterThan(85);
    expect(s.onchainScore).toBe(99); // fixture stores 990/1000
    expect(s.consistent).toBe(true);
  });

  it("scores a weak agent low with no on-chain score", () => {
    const { agent, payments } = weakAgent(NOW);
    const s = scoreAgent(agent, payments, NOW);
    expect(s.score).toBeLessThan(55);
    expect(s.onchainScore).toBeNull();
    expect(s.consistent).toBeNull();
  });

  it("shows the on-chain score for a bootstrap agent with no indexed activity", () => {
    const { agent, payments } = bootstrapAgent(NOW);
    const s = scoreAgent(agent, payments, NOW);
    expect(s.score).toBe(73); // mirrors the mock-onboarded on-chain score (730/1000)
    expect(s.onchainScore).toBe(73);
    expect(s.consistent).toBe(true);
    expect(s.grade).toBe("B");
  });

  it("buildScoringInput mirrors the agent's job aggregates", () => {
    const { agent, payments } = strongAgent(NOW);
    const input = buildScoringInput(agent, payments, NOW);
    expect(input.jobsAccepted).toBe(agent.jobsPosted);
    expect(input.jobsCompleted).toBe(agent.jobsCompleted);
    expect(input.dailyRevenue).toHaveLength(30);
  });
});

describe("computeEpoch", () => {
  it("produces on-chain payloads with scaled scores + deterministic hashes", async () => {
    const { agent: a, payments: pa } = strongAgent(NOW);
    const repo = createFakeRepo({ agents: [a], payments: { [AGENT_A.toLowerCase()]: pa } });

    const r1 = await computeEpoch(repo, NOW);
    const r2 = await computeEpoch(repo, NOW);

    expect(r1.epoch).toBe(epochNumber(NOW));
    expect(r1.entries).toHaveLength(1);
    const e = r1.entries[0];
    expect(e.onchainScore).toBe(toOnchainScore(e.score100));
    expect(e.factorsHash).toMatch(/^0x[0-9a-f]{64}$/);
    // Deterministic across runs.
    expect(r2.entries[0].factorsHash).toBe(e.factorsHash);
  });
});
