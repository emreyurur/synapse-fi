// Client for the SynapseFi indexer API (apps/api). Types mirror
// apps/api/src/presenter.ts — USDC amounts arrive as fixed-2 strings, scores on
// the canonical 0–100 scale.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AgentJobs {
  posted: number;
  completed: number;
  disputed: number;
  completionRate: number;
}

export interface AgentSummary {
  address: string;
  id: string | null;
  score: number;
  grade: string;
  onchainScore: number | null;
  consistent: boolean | null;
  revenue: string;
  /** Trailing daily inflows, oldest first (USDC). */
  revenueSeries: number[];
  limit: string;
  drawn: string;
  apr: string;
  status: string;
  health: string;
  jobs: AgentJobs;
}

export interface ScoreFactors {
  jobCompletion: number;
  revenueContinuity: number;
  disputeFree: number;
  revenueStability: number;
}

export interface AgentPayment {
  id: string;
  kind: string;
  jobId: number | null;
  payer: string | null;
  amount: string;
  timestamp: number;
  txHash: string;
}

export interface AgentRepayment {
  id: string;
  principal: string;
  interest: string;
  total: string;
  payer: string;
  timestamp: number;
  txHash: string;
}

// `revenue` widens from a summary string to a {gross, series} object on the
// detail endpoint, so it is omitted from the base before being redeclared.
export interface AgentDetail extends Omit<AgentSummary, "revenue"> {
  factorsVersion: string;
  factors: ScoreFactors;
  reputation: number | null;
  epoch: number | null;
  factorsHash: string | null;
  scoreUpdatedAt: number | null;
  line: {
    status: string;
    limit: string;
    principal: string;
    interest: string;
    drawn: string;
    apr: string;
    treasury: string | null;
    splitter: string | null;
  };
  revenue: {
    gross: string;
    series: { day: number; amount: number }[];
  };
  payments: AgentPayment[];
  repayments: AgentRepayment[];
}

export interface PoolStats {
  tvl: string;
  available: string;
  totalLent: string;
  reserves: string;
  utilization: number;
  borrowApr: number;
  supplyApy: number;
  reserveFactor: number;
  activeLines: number;
  defaults: number;
  defaultRate: number;
  usdcDecimals: number;
  updatedAt: number | null;
  source: "chain" | "indexer" | "empty";
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  listAgents: () => get<{ agents: AgentSummary[]; count: number }>("/agents"),
  /**
   * Resolves to `null` for an address the indexer has never seen (404) — never
   * `undefined`, which TanStack Query's queryFn contract forbids (it throws
   * "Query data cannot be undefined" and leaves the query stuck in error state).
   */
  getAgent: async (address: string): Promise<AgentDetail | null> => {
    const res = await fetch(`${API_URL}/agents/${address}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`/agents/${address} → ${res.status}`);
    return res.json() as Promise<AgentDetail>;
  },
  poolStats: () => get<PoolStats>("/pool/stats"),
  /**
   * MVP demo onboarding: asks the backend to write a deterministic mock score
   * on-chain for `address` if it doesn't have a fresh one yet, so a wallet
   * with no indexed job/revenue history can still clear the credit line's
   * minimum score. No-op (onboarded: false) if it already has a live score.
   */
  onboardAgent: async (address: string): Promise<{ onboarded: boolean; onchainScore?: number; txHash?: string }> => {
    const res = await fetch(`${API_URL}/agents/${address}/onboard`, { method: "POST" });
    if (!res.ok) throw new Error(`/agents/${address}/onboard → ${res.status}`);
    return res.json() as Promise<{ onboarded: boolean; onchainScore?: number; txHash?: string }>;
  },
};
