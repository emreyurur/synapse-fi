// Repository abstraction over the indexed tables. Routes and the scoring
// service depend on this interface, not on Drizzle directly, so they can be
// unit-tested with in-memory fixtures (see test/).

import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "./db.js";

export interface AgentRecord {
  address: string;
  registryId: bigint | null;
  reputation: bigint | null;
  splitter: string | null;
  treasury: string | null;
  score: number | null; // on-chain 0–1000 scale
  epoch: bigint | null;
  factorsHash: string | null;
  scoreUpdatedAt: number | null;
  lineStatus: number;
  principal: bigint;
  interestAccrued: bigint;
  aprBps: number;
  creditLimit: bigint;
  jobsPosted: number;
  jobsCompleted: number;
  jobsDisputed: number;
  grossRevenue: bigint;
  firstSeen: number;
  lastActivity: number;
}

export interface PaymentRecord {
  id: string;
  agent: string;
  payTo: string;
  payer: string | null;
  kind: string;
  jobId: bigint | null;
  amount: bigint;
  timestamp: number;
  txHash: string;
}

export interface RepaymentRecord {
  id: string;
  agent: string;
  payer: string;
  principal: bigint;
  interest: bigint;
  timestamp: number;
  txHash: string;
}

export interface ProtocolStatRecord {
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  totalLentOut: bigint;
  totalPrincipalRepaid: bigint;
  totalInterestPaid: bigint;
  totalReserves: bigint;
  activeLines: number;
  defaults: number;
  updatedAt: number;
}

export interface Repo {
  listAgents(): Promise<AgentRecord[]>;
  getAgent(address: string): Promise<AgentRecord | undefined>;
  getPayments(agent: string, limit?: number): Promise<PaymentRecord[]>;
  getRepayments(agent: string, limit?: number): Promise<RepaymentRecord[]>;
  getProtocolStat(): Promise<ProtocolStatRecord | undefined>;
}

/** Repo backed by the Ponder Postgres database. */
export function createDrizzleRepo(): Repo {
  const requireDb = () => {
    const d = getDb();
    if (!d) throw new Error("DATABASE_URL not configured");
    return d;
  };
  const lower = (a: string) => a.toLowerCase() as `0x${string}`;

  return {
    async listAgents() {
      const rows = await requireDb()
        .select()
        .from(schema.agent)
        .orderBy(desc(schema.agent.score));
      return rows as unknown as AgentRecord[];
    },
    async getAgent(address) {
      const rows = await requireDb()
        .select()
        .from(schema.agent)
        .where(eq(schema.agent.address, lower(address)))
        .limit(1);
      return rows[0] as unknown as AgentRecord | undefined;
    },
    async getPayments(agent, limit = 100) {
      const rows = await requireDb()
        .select()
        .from(schema.payment)
        .where(eq(schema.payment.agent, lower(agent)))
        .orderBy(desc(schema.payment.timestamp))
        .limit(limit);
      return rows as unknown as PaymentRecord[];
    },
    async getRepayments(agent, limit = 100) {
      const rows = await requireDb()
        .select()
        .from(schema.repayment)
        .where(eq(schema.repayment.agent, lower(agent)))
        .orderBy(desc(schema.repayment.timestamp))
        .limit(limit);
      return rows as unknown as RepaymentRecord[];
    },
    async getProtocolStat() {
      const rows = await requireDb()
        .select()
        .from(schema.protocolStat)
        .where(eq(schema.protocolStat.id, "global"))
        .limit(1);
      return rows[0] as unknown as ProtocolStatRecord | undefined;
    },
  };
}

/** Empty repo used when no database is configured (keeps the server bootable). */
export function createNullRepo(): Repo {
  return {
    async listAgents() {
      return [];
    },
    async getAgent() {
      return undefined;
    },
    async getPayments() {
      return [];
    },
    async getRepayments() {
      return [];
    },
    async getProtocolStat() {
      return undefined;
    },
  };
}

export function createRepo(): Repo {
  return getDb() ? createDrizzleRepo() : createNullRepo();
}
