// In-memory Repo + fixtures for exercising the API and scoring without a DB.

import { parseUnits } from "viem";
import type {
  Repo,
  AgentRecord,
  PaymentRecord,
  RepaymentRecord,
  ProtocolStatRecord,
} from "../src/repo.js";

const usdc = (n: number) => parseUnits(n.toFixed(6), 6);

export const AGENT_A = "0x00000000000000000000000000000000000000aa" as const;
export const AGENT_B = "0x00000000000000000000000000000000000000bb" as const;
export const AGENT_C = "0x00000000000000000000000000000000000000cc" as const;

/** A strong agent: high completion, no disputes, steady daily revenue. */
export function strongAgent(now: number): { agent: AgentRecord; payments: PaymentRecord[] } {
  const day = 86_400;
  const payments: PaymentRecord[] = [];
  for (let i = 0; i < 30; i++) {
    payments.push({
      id: `p-${i}`,
      agent: AGENT_A,
      payTo: AGENT_A,
      payer: "0x00000000000000000000000000000000000000ee",
      kind: "job",
      jobId: BigInt(i + 1),
      amount: usdc(100 + (i % 3)), // ~steady
      timestamp: now - (29 - i) * day,
      txHash: `0xhash${i}`,
    });
  }
  const agent: AgentRecord = {
    address: AGENT_A,
    registryId: 7n,
    reputation: 720n,
    splitter: "0x00000000000000000000000000000000000005a1",
    treasury: "0x00000000000000000000000000000000000007a2",
    score: 990, // on-chain 0–1000 (≈ 99/100), matches the computed factors
    epoch: 100n,
    factorsHash: "0xabc",
    scoreUpdatedAt: now - 60,
    lineStatus: 1,
    principal: usdc(4000),
    interestAccrued: usdc(12),
    aprBps: 740,
    creditLimit: usdc(20000),
    jobsPosted: 32,
    jobsCompleted: 31,
    jobsDisputed: 0,
    grossRevenue: usdc(3000),
    firstSeen: now - 30 * day,
    lastActivity: now,
  };
  return { agent, payments };
}

/** A weak agent: sparse revenue, disputes, low completion. */
export function weakAgent(now: number): { agent: AgentRecord; payments: PaymentRecord[] } {
  const day = 86_400;
  const payments: PaymentRecord[] = [
    {
      id: "wp-0",
      agent: AGENT_B,
      payTo: AGENT_B,
      payer: null,
      kind: "nano",
      jobId: null,
      amount: usdc(10),
      timestamp: now - 20 * day,
      txHash: "0xw0",
    },
  ];
  const agent: AgentRecord = {
    address: AGENT_B,
    registryId: 9n,
    reputation: 300n,
    splitter: null,
    treasury: null,
    score: null,
    epoch: null,
    factorsHash: null,
    scoreUpdatedAt: null,
    lineStatus: 0,
    principal: 0n,
    interestAccrued: 0n,
    aprBps: 0,
    creditLimit: 0n,
    jobsPosted: 10,
    jobsCompleted: 6,
    jobsDisputed: 3,
    grossRevenue: usdc(10),
    firstSeen: now - 25 * day,
    lastActivity: now - 20 * day,
  };
  return { agent, payments };
}

/**
 * A freshly onboarded wallet: no jobs, no payments, but a live on-chain
 * score from the MVP mock-onboarding endpoint (see oracle/mock-score.ts).
 */
export function bootstrapAgent(now: number): { agent: AgentRecord; payments: PaymentRecord[] } {
  const agent: AgentRecord = {
    address: AGENT_C,
    registryId: null,
    reputation: null,
    splitter: null,
    treasury: null,
    score: 730, // on-chain 0-1000, written by ensureMockScore
    epoch: 200n,
    factorsHash: "0xmock",
    scoreUpdatedAt: now - 5,
    lineStatus: 0,
    principal: 0n,
    interestAccrued: 0n,
    aprBps: 0,
    creditLimit: 0n,
    jobsPosted: 0,
    jobsCompleted: 0,
    jobsDisputed: 0,
    grossRevenue: 0n,
    firstSeen: now - 5,
    lastActivity: now - 5,
  };
  return { agent, payments: [] };
}

export interface FakeData {
  agents: AgentRecord[];
  payments: Record<string, PaymentRecord[]>;
  repayments?: Record<string, RepaymentRecord[]>;
  stat?: ProtocolStatRecord;
}

export function createFakeRepo(data: FakeData): Repo {
  return {
    async listAgents() {
      return [...data.agents].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    },
    async getAgent(address) {
      return data.agents.find((a) => a.address.toLowerCase() === address.toLowerCase());
    },
    async getPayments(agent, limit = 100) {
      return (data.payments[agent.toLowerCase()] ?? []).slice(0, limit);
    },
    async getRepayments(agent, limit = 100) {
      return (data.repayments?.[agent.toLowerCase()] ?? []).slice(0, limit);
    },
    async getProtocolStat() {
      return data.stat;
    },
  };
}

export function sampleStat(now: number): ProtocolStatRecord {
  return {
    totalDeposited: usdc(500000),
    totalWithdrawn: usdc(50000),
    totalLentOut: usdc(200000),
    totalPrincipalRepaid: usdc(80000),
    totalInterestPaid: usdc(3000),
    totalReserves: usdc(300),
    activeLines: 12,
    defaults: 1,
    updatedAt: now,
  };
}
