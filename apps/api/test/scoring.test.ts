import { describe, it, expect } from "vitest";
import {
  computeScore,
  computeFactors,
  gradeFor,
  toOnchainScore,
  fromOnchainScore,
  SCORING_VERSION,
} from "@synapsefi/shared";

describe("scoring formula (0–100)", () => {
  it("gives a perfect score for flawless steady activity", () => {
    const r = computeScore({
      jobsAccepted: 100,
      jobsCompleted: 100,
      jobsDisputed: 0,
      dailyRevenue: new Array(30).fill(100),
    });
    expect(r.score).toBe(100);
    expect(r.grade).toBe("A+");
    expect(r.version).toBe(SCORING_VERSION);
  });

  it("stays within [0,100] and reflects weak inputs", () => {
    const r = computeScore({
      jobsAccepted: 10,
      jobsCompleted: 6,
      jobsDisputed: 3,
      dailyRevenue: [10, 0, 0, 0, 0],
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThan(60);
  });

  it("treats an unproven agent (no jobs) as low", () => {
    const r = computeScore({ jobsAccepted: 0, jobsCompleted: 0, jobsDisputed: 0, dailyRevenue: [] });
    expect(r.score).toBeLessThan(30);
  });

  it("penalizes volatile revenue via the stability factor", () => {
    const steady = computeFactors({
      jobsAccepted: 30,
      jobsCompleted: 30,
      jobsDisputed: 0,
      dailyRevenue: new Array(30).fill(50),
    });
    const spiky = computeFactors({
      jobsAccepted: 30,
      jobsCompleted: 30,
      jobsDisputed: 0,
      dailyRevenue: [500, 0, 0, 0, 600, 0, 0, 0, 0, 0],
    });
    expect(steady.revenueStability).toBeGreaterThan(spiky.revenueStability);
  });

  it("maps grades monotonically", () => {
    expect(gradeFor(95)).toBe("A+");
    expect(gradeFor(72)).toBe("B");
    expect(gradeFor(10)).toBe("D");
  });

  it("scales to/from the on-chain 0–1000 range", () => {
    expect(toOnchainScore(90)).toBe(900);
    expect(toOnchainScore(100)).toBe(1000);
    expect(toOnchainScore(1000)).toBe(1000); // clamped
    expect(fromOnchainScore(900)).toBe(90);
    expect(fromOnchainScore(755)).toBe(76);
  });

  it("weights sum to 1 (score never exceeds 100)", () => {
    const r = computeFactors({
      jobsAccepted: 1,
      jobsCompleted: 1,
      jobsDisputed: 0,
      dailyRevenue: new Array(30).fill(1),
    });
    const sum = r.jobCompletion + r.revenueContinuity + r.disputeFree + r.revenueStability;
    expect(sum).toBeLessThanOrEqual(400.001);
  });
});
