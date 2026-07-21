import { onchainTable } from "ponder";

/// Aggregated per-agent state, updated as protocol + job events arrive.
export const agent = onchainTable("agent", (t) => ({
  address: t.hex().primaryKey(),
  registryId: t.bigint(),
  reputation: t.bigint(),
  splitter: t.hex(),
  treasury: t.hex(),
  // Latest on-chain score (0–1000 scale) and its breakdown.
  score: t.integer(),
  epoch: t.bigint(),
  factorsHash: t.hex(),
  scoreUpdatedAt: t.integer(),
  // Credit-line state (mirrors CreditLineManager.Line).
  lineStatus: t.integer().notNull().default(0), // 0 None,1 Active,2 Delinquent,3 Closed
  principal: t.bigint().notNull().default(0n),
  interestAccrued: t.bigint().notNull().default(0n),
  aprBps: t.integer().notNull().default(0),
  creditLimit: t.bigint().notNull().default(0n),
  // Lifetime job/revenue aggregates (fast-path for the scoring service).
  jobsPosted: t.integer().notNull().default(0),
  jobsCompleted: t.integer().notNull().default(0),
  jobsDisputed: t.integer().notNull().default(0),
  grossRevenue: t.bigint().notNull().default(0n), // job completions + nanopayments
  firstSeen: t.integer().notNull().default(0),
  lastActivity: t.integer().notNull().default(0),
}));

/// ERC-8183 jobs escrowed on the MockJobBoard.
export const job = onchainTable("job", (t) => ({
  id: t.bigint().primaryKey(), // jobId
  poster: t.hex().notNull(),
  agent: t.hex().notNull(),
  payTo: t.hex().notNull(),
  amount: t.bigint().notNull(),
  status: t.integer().notNull(), // 1 Posted,2 Completed,3 Disputed
  postedAt: t.integer().notNull(),
  resolvedAt: t.integer(),
  txHash: t.hex().notNull(),
}));

/// Revenue inflows to an agent (completed job payouts + streamed nanopayments).
export const payment = onchainTable("payment", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  agent: t.hex().notNull(),
  payTo: t.hex().notNull(),
  payer: t.hex(),
  kind: t.text().notNull(), // "job" | "nano"
  jobId: t.bigint(),
  amount: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  txHash: t.hex().notNull(),
}));

/// Repayments split out of an agent's revenue and forwarded to the pool.
export const repayment = onchainTable("repayment", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  agent: t.hex().notNull(),
  payer: t.hex().notNull(),
  principal: t.bigint().notNull(),
  interest: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  txHash: t.hex().notNull(),
}));

/// History of oracle score writes (ScoreOracle.ScoreUpdated).
export const scoreUpdate = onchainTable("score_update", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  agent: t.hex().notNull(),
  score: t.integer().notNull(), // 0–1000 on-chain scale
  epoch: t.bigint().notNull(),
  factorsHash: t.hex().notNull(),
  timestamp: t.integer().notNull(),
  txHash: t.hex().notNull(),
}));

/// Raw pool events (Deposit / Withdraw / LentOut / RepaymentReceived).
export const poolEvent = onchainTable("pool_event", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  kind: t.text().notNull(),
  account: t.hex(),
  assets: t.bigint().notNull().default(0n),
  shares: t.bigint().notNull().default(0n),
  timestamp: t.integer().notNull(),
  txHash: t.hex().notNull(),
}));

/// Running protocol-wide counters (single row, id = "global").
export const protocolStat = onchainTable("protocol_stat", (t) => ({
  id: t.text().primaryKey(),
  totalDeposited: t.bigint().notNull().default(0n),
  totalWithdrawn: t.bigint().notNull().default(0n),
  totalLentOut: t.bigint().notNull().default(0n),
  totalPrincipalRepaid: t.bigint().notNull().default(0n),
  totalInterestPaid: t.bigint().notNull().default(0n),
  totalReserves: t.bigint().notNull().default(0n),
  activeLines: t.integer().notNull().default(0),
  defaults: t.integer().notNull().default(0),
  updatedAt: t.integer().notNull().default(0),
}));
