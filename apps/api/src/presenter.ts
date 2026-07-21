// Shapes internal records into stable JSON for the frontend. All USDC amounts
// are emitted as fixed-2 strings; scores are the canonical 0–100 scale.

import { borrowAprPercent } from "@synapsefi/shared";
import type { AgentRecord, PaymentRecord, RepaymentRecord, ProtocolStatRecord } from "./repo.js";
import type { AgentScore } from "./scoring/service.js";
import { formatUsdc, toUsdc, LINE_STATUS_LABEL } from "./lib/format.js";
import { USDC_DECIMALS } from "./config.js";

const RESERVE_FACTOR = 0.1; // mirrors CreditPool.reserveFactorBps (10%)

function healthLabel(agent: AgentRecord): string {
  if (agent.lineStatus === 2) return "Delinquent";
  if (agent.lineStatus === 3) return "Closed";
  if (agent.lineStatus !== 1) return "None";
  const debt = agent.principal + agent.interestAccrued;
  if (agent.creditLimit > 0n && debt >= agent.creditLimit) return "At limit";
  return "Healthy";
}

function completionRate(a: AgentRecord): number {
  return a.jobsPosted > 0 ? Math.round((a.jobsCompleted / a.jobsPosted) * 1000) / 10 : 0;
}

export function presentAgentSummary(agent: AgentRecord, score: AgentScore) {
  const debt = agent.principal + agent.interestAccrued;
  return {
    address: agent.address,
    id: agent.registryId != null ? `#${agent.registryId}` : null,
    score: score.score,
    grade: score.grade,
    onchainScore: score.onchainScore,
    consistent: score.consistent,
    revenue: formatUsdc(agent.grossRevenue),
    // Trailing daily inflows (oldest first) — drives the market table sparkline
    // without a detail fetch per row.
    revenueSeries: score.input.dailyRevenue.map((a) => Number(a.toFixed(2))),
    limit: formatUsdc(agent.creditLimit),
    drawn: formatUsdc(debt),
    apr: `${(agent.aprBps / 100).toFixed(1)}%`,
    status: LINE_STATUS_LABEL[agent.lineStatus] ?? "None",
    health: healthLabel(agent),
    jobs: {
      posted: agent.jobsPosted,
      completed: agent.jobsCompleted,
      disputed: agent.jobsDisputed,
      completionRate: completionRate(agent),
    },
  };
}

export function presentAgentDetail(
  agent: AgentRecord,
  score: AgentScore,
  payments: PaymentRecord[],
  repayments: RepaymentRecord[],
) {
  const debt = agent.principal + agent.interestAccrued;
  return {
    ...presentAgentSummary(agent, score),
    factorsVersion: score.version,
    factors: score.factors, // 0–100 per-factor breakdown
    reputation: agent.reputation != null ? Number(agent.reputation) : null,
    epoch: agent.epoch != null ? Number(agent.epoch) : null,
    factorsHash: agent.factorsHash,
    scoreUpdatedAt: agent.scoreUpdatedAt,
    line: {
      status: LINE_STATUS_LABEL[agent.lineStatus] ?? "None",
      limit: formatUsdc(agent.creditLimit),
      principal: formatUsdc(agent.principal),
      interest: formatUsdc(agent.interestAccrued),
      drawn: formatUsdc(debt),
      apr: `${(agent.aprBps / 100).toFixed(1)}%`,
      treasury: agent.treasury,
      splitter: agent.splitter,
    },
    revenue: {
      gross: formatUsdc(agent.grossRevenue),
      series: score.input.dailyRevenue.map((amount, i) => ({ day: i, amount: Number(amount.toFixed(2)) })),
    },
    payments: payments.map(presentPayment),
    repayments: repayments.map(presentRepayment),
  };
}

export function presentPayment(p: PaymentRecord) {
  return {
    id: p.id,
    kind: p.kind,
    jobId: p.jobId != null ? Number(p.jobId) : null,
    payer: p.payer,
    amount: formatUsdc(p.amount),
    timestamp: p.timestamp,
    txHash: p.txHash,
  };
}

export function presentRepayment(r: RepaymentRecord) {
  return {
    id: r.id,
    principal: formatUsdc(r.principal),
    interest: formatUsdc(r.interest),
    total: formatUsdc(r.principal + r.interest),
    payer: r.payer,
    timestamp: r.timestamp,
    txHash: r.txHash,
  };
}

export interface PoolStatsInput {
  stat?: ProtocolStatRecord;
  live?: { totalAssets: bigint; totalLent: bigint; reserves: bigint; utilizationBps: bigint } | null;
}

export function presentPoolStats({ stat, live }: PoolStatsInput) {
  // Prefer accurate on-chain reads; fall back to indexed counters.
  let totalAssets: number;
  let totalLent: number;
  let reserves: number;
  let utilization: number;

  if (live) {
    totalAssets = toUsdc(live.totalAssets);
    totalLent = toUsdc(live.totalLent);
    reserves = toUsdc(live.reserves);
    utilization = Number(live.utilizationBps) / 10_000;
  } else if (stat) {
    // Approximate: LP assets ≈ deposits − withdrawals + interest earned.
    const deposited = toUsdc(stat.totalDeposited);
    const withdrawn = toUsdc(stat.totalWithdrawn);
    const lentOut = toUsdc(stat.totalLentOut);
    const principalRepaid = toUsdc(stat.totalPrincipalRepaid);
    const interest = toUsdc(stat.totalInterestPaid);
    reserves = toUsdc(stat.totalReserves);
    totalLent = Math.max(0, lentOut - principalRepaid);
    totalAssets = Math.max(0, deposited - withdrawn + interest - reserves);
    utilization = totalAssets > 0 ? Math.min(1, totalLent / totalAssets) : 0;
  } else {
    totalAssets = totalLent = reserves = utilization = 0;
  }

  const borrowApr = borrowAprPercent(utilization);
  const supplyApy = borrowApr * utilization * (1 - RESERVE_FACTOR);
  const activeLines = stat?.activeLines ?? 0;
  const defaults = stat?.defaults ?? 0;
  const defaultRate = activeLines + defaults > 0 ? defaults / (activeLines + defaults) : 0;

  return {
    tvl: totalAssets.toFixed(2),
    available: Math.max(0, totalAssets - totalLent).toFixed(2),
    totalLent: totalLent.toFixed(2),
    reserves: reserves.toFixed(2),
    utilization: Number((utilization * 100).toFixed(2)),
    borrowApr: Number(borrowApr.toFixed(2)),
    supplyApy: Number(supplyApy.toFixed(2)),
    reserveFactor: RESERVE_FACTOR * 100,
    activeLines,
    defaults,
    defaultRate: Number((defaultRate * 100).toFixed(2)),
    usdcDecimals: USDC_DECIMALS,
    updatedAt: stat?.updatedAt ?? null,
    source: live ? "chain" : stat ? "indexer" : "empty",
  };
}
