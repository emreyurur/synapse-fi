// SynapseFi agent credit-scoring formula — the single, versioned source of
// truth shared by the backend scoring service, the oracle worker, and the UI.
//
// The canonical score is on a **0–100** scale (with a letter grade). The
// on-chain `ScoreOracle` stores a 0–1000 integer, so `toOnchainScore()` scales
// the canonical score by 10 when the oracle worker writes an epoch.
//
// Bump `SCORING_VERSION` whenever the weights or factor definitions change so
// that `factorsHash` (written on-chain) stays reproducible off-chain.

export const SCORING_VERSION = "1.0.0" as const;

/** How many trailing days of activity the continuity/stability factors look at. */
export const SCORING_WINDOW_DAYS = 30;

/**
 * The four scored factors. Each is a normalized 0–100 sub-score; the weighted
 * sum (weights below) yields the final 0–100 credit score.
 */
export const FACTOR_WEIGHTS = {
  /** Share of accepted jobs that were completed (not failed/expired). */
  jobCompletion: 0.3,
  /** Fraction of the trailing window with at least one revenue inflow. */
  revenueContinuity: 0.25,
  /** Share of completed jobs that never entered a dispute. */
  disputeFree: 0.25,
  /** Low volatility of daily revenue (1 − clamped coefficient of variation). */
  revenueStability: 0.2,
} as const;

export type FactorKey = keyof typeof FACTOR_WEIGHTS;

/** Raw, indexed inputs the scoring service feeds the formula for one agent. */
export interface ScoringInput {
  /** Jobs the agent accepted in the window. */
  jobsAccepted: number;
  /** Of those, jobs marked completed. */
  jobsCompleted: number;
  /** Of the completed jobs, how many were disputed. */
  jobsDisputed: number;
  /**
   * Daily net revenue (USDC, human units) over the trailing window, oldest
   * first. Length need not equal SCORING_WINDOW_DAYS; missing days count as 0.
   */
  dailyRevenue: number[];
}

/** The 0–100 sub-scores that make up the final score. */
export type FactorScores = Record<FactorKey, number>;

export interface ScoreResult {
  /** Canonical credit score, integer 0–100. */
  score: number;
  /** Letter grade for `score`. */
  grade: string;
  /** Per-factor 0–100 breakdown (rounded to 1 decimal for display/hashing). */
  factors: FactorScores;
  /** Formula version used to produce this result. */
  version: string;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

/** Coefficient of variation (stddev / mean) of a non-empty series, else 0. */
function coefficientOfVariation(series: number[]): number {
  if (series.length === 0) return 0;
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  if (mean <= 0) return 0;
  const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length;
  return Math.sqrt(variance) / mean;
}

/** Computes the four normalized 0–100 factor sub-scores. */
export function computeFactors(input: ScoringInput, windowDays = SCORING_WINDOW_DAYS): FactorScores {
  const { jobsAccepted, jobsCompleted, jobsDisputed, dailyRevenue } = input;

  // 1. Job completion rate. No accepted jobs ⇒ neutral-low (unproven).
  const jobCompletion = jobsAccepted > 0 ? (jobsCompleted / jobsAccepted) * 100 : 0;

  // 2. Revenue continuity: fraction of window days with inflow.
  const activeDays = dailyRevenue.filter((v) => v > 0).length;
  const revenueContinuity = windowDays > 0 ? clamp((activeDays / windowDays) * 100, 0, 100) : 0;

  // 3. Dispute-free rate over completed jobs. No completions ⇒ 0 (unproven).
  const disputeFree = jobsCompleted > 0 ? clamp((1 - jobsDisputed / jobsCompleted) * 100, 0, 100) : 0;

  // 4. Revenue stability: 1 − CV, where CV≥1 (as volatile as its mean) ⇒ 0.
  const cv = coefficientOfVariation(dailyRevenue.filter((v) => v > 0));
  const revenueStability = clamp((1 - Math.min(cv, 1)) * 100, 0, 100);

  const round1 = (x: number) => Math.round(x * 10) / 10;
  return {
    jobCompletion: round1(jobCompletion),
    revenueContinuity: round1(revenueContinuity),
    disputeFree: round1(disputeFree),
    revenueStability: round1(revenueStability),
  };
}

/** Letter grade for a 0–100 score. */
export function gradeFor(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A−";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B−";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C−";
  return "D";
}

/** Runs the full formula: raw inputs → 0–100 score + grade + breakdown. */
export function computeScore(input: ScoringInput, windowDays = SCORING_WINDOW_DAYS): ScoreResult {
  const factors = computeFactors(input, windowDays);
  const weighted =
    factors.jobCompletion * FACTOR_WEIGHTS.jobCompletion +
    factors.revenueContinuity * FACTOR_WEIGHTS.revenueContinuity +
    factors.disputeFree * FACTOR_WEIGHTS.disputeFree +
    factors.revenueStability * FACTOR_WEIGHTS.revenueStability;
  const score = clamp(Math.round(weighted), 0, 100);
  return { score, grade: gradeFor(score), factors, version: SCORING_VERSION };
}

/** On-chain `ScoreOracle` scale (0–1000). Canonical 0–100 score × 10. */
export const ONCHAIN_SCORE_SCALE = 10;
export const MAX_ONCHAIN_SCORE = 1000;

/** Converts a canonical 0–100 score to the on-chain 0–1000 integer. */
export function toOnchainScore(score: number): number {
  return clamp(Math.round(score * ONCHAIN_SCORE_SCALE), 0, MAX_ONCHAIN_SCORE);
}

/** Converts an on-chain 0–1000 score back to the canonical 0–100 scale. */
export function fromOnchainScore(onchain: number): number {
  return clamp(Math.round(onchain / ONCHAIN_SCORE_SCALE), 0, 100);
}

/**
 * Deterministic hash of the factor breakdown for a version, matching what the
 * oracle worker writes on-chain as `factorsHash`. Uses a stable JSON encoding.
 */
export function factorsPreimage(factors: FactorScores, version: string = SCORING_VERSION): string {
  return JSON.stringify({
    version,
    factors: {
      jobCompletion: factors.jobCompletion,
      revenueContinuity: factors.revenueContinuity,
      disputeFree: factors.disputeFree,
      revenueStability: factors.revenueStability,
    },
  });
}
