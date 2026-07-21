// Scoring service: turns indexed job history + revenue inflows into the four
// factors, then delegates to the versioned formula in @synapsefi/shared. This
// is the same computation the oracle worker pushes on-chain each epoch.

import {
  computeScore,
  SCORING_WINDOW_DAYS,
  SCORING_VERSION,
  fromOnchainScore,
  gradeFor,
  type ScoreResult,
  type ScoringInput,
} from "@synapsefi/shared";
import type { AgentRecord, PaymentRecord } from "../repo.js";
import { toUsdc } from "../lib/format.js";

const DAY = 86_400;

/**
 * Buckets payment inflows into a per-day revenue series (whole USDC) covering
 * the trailing `windowDays` ending at `now`. Oldest day first.
 */
export function dailyRevenueSeries(
  payments: Pick<PaymentRecord, "amount" | "timestamp">[],
  now: number,
  windowDays = SCORING_WINDOW_DAYS,
): number[] {
  const series = new Array<number>(windowDays).fill(0);
  for (const p of payments) {
    const daysAgo = Math.floor((now - p.timestamp) / DAY);
    if (daysAgo < 0 || daysAgo >= windowDays) continue; // outside the trailing window
    series[windowDays - 1 - daysAgo] += toUsdc(p.amount); // oldest first; today = last
  }
  return series;
}

/** Assembles the raw scoring inputs for one agent. */
export function buildScoringInput(
  agent: Pick<AgentRecord, "jobsPosted" | "jobsCompleted" | "jobsDisputed">,
  payments: Pick<PaymentRecord, "amount" | "timestamp">[],
  now: number,
  windowDays = SCORING_WINDOW_DAYS,
): ScoringInput {
  return {
    jobsAccepted: agent.jobsPosted,
    jobsCompleted: agent.jobsCompleted,
    jobsDisputed: agent.jobsDisputed,
    dailyRevenue: dailyRevenueSeries(payments, now, windowDays),
  };
}

export interface AgentScore extends ScoreResult {
  input: ScoringInput;
  /** Canonical 0–100 score currently recorded on-chain (from the oracle), if any. */
  onchainScore: number | null;
  /** Whether the freshly computed score matches on-chain within tolerance. */
  consistent: boolean | null;
}

const CONSISTENCY_TOLERANCE = 2; // ±2 points on the 0–100 scale

/** Computes an agent's canonical 0–100 score and compares it to the chain. */
export function scoreAgent(
  agent: AgentRecord,
  payments: Pick<PaymentRecord, "amount" | "timestamp">[],
  now: number = Math.floor(Date.now() / 1000),
): AgentScore {
  const input = buildScoringInput(agent, payments, now);
  const onchainScore = agent.score != null ? fromOnchainScore(agent.score) : null;

  // No jobs and no revenue indexed yet: the four factors are all formula
  // zeros, which would show a brand-new (or MVP-onboarded demo) wallet a "0"
  // score even though the oracle already holds a real value for it. Trust the
  // oracle in that bootstrap case instead of the unproven-activity formula.
  const hasActivity = input.jobsAccepted > 0 || payments.length > 0;
  if (!hasActivity && onchainScore != null) {
    return {
      score: onchainScore,
      grade: gradeFor(onchainScore),
      factors: { jobCompletion: 0, revenueContinuity: 0, disputeFree: 0, revenueStability: 0 },
      version: SCORING_VERSION,
      input,
      onchainScore,
      consistent: true,
    };
  }

  const result = computeScore(input);
  const consistent = onchainScore == null ? null : Math.abs(onchainScore - result.score) <= CONSISTENCY_TOLERANCE;
  return { ...result, input, onchainScore, consistent };
}
