import { ponder } from "ponder:registry";
import { eq } from "ponder";
import schema from "ponder:schema";

const GLOBAL = "global";

/** Seconds since epoch for an event's block. */
const ts = (event: { block: { timestamp: bigint } }) => Number(event.block.timestamp);

/** Stable per-log primary key. */
const logId = (event: { transaction: { hash: string }; log: { logIndex: number } }) =>
  `${event.transaction.hash}-${event.log.logIndex}`;

type Ctx = { db: any };

/** Ensures an agent row exists, then bumps its lastActivity. */
async function touchAgent(context: Ctx, address: `0x${string}`, at: number) {
  await context.db
    .insert(schema.agent)
    .values({ address, firstSeen: at, lastActivity: at })
    .onConflictDoUpdate(() => ({ lastActivity: at }));
}

/** Ensures the singleton protocol-stat row exists and returns nothing. */
async function ensureStat(context: Ctx, at: number) {
  await context.db
    .insert(schema.protocolStat)
    .values({ id: GLOBAL, updatedAt: at })
    .onConflictDoNothing();
}

// ── ScoreOracle ────────────────────────────────────────────────
ponder.on("ScoreOracle:ScoreUpdated", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await context.db.insert(schema.scoreUpdate).values({
    id: logId(event),
    agent,
    score: Number(event.args.score),
    epoch: event.args.epoch,
    factorsHash: event.args.factorsHash,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set({
    score: Number(event.args.score),
    epoch: event.args.epoch,
    factorsHash: event.args.factorsHash,
    scoreUpdatedAt: at,
  });
});

// ── AgentRegistry (ERC-8004 mock) ──────────────────────────────
ponder.on("AgentRegistry:AgentRegistered", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await touchAgent(context, agent, at);
  await context.db
    .update(schema.agent, { address: agent })
    .set({ registryId: event.args.id, reputation: 500n });
});

ponder.on("AgentRegistry:ReputationChanged", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await touchAgent(context, agent, at);
  await context.db
    .update(schema.agent, { address: agent })
    .set({ reputation: event.args.newReputation });
});

// ── CreditLineManager ──────────────────────────────────────────
ponder.on("CreditLineManager:LineOpened", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set({
    treasury: event.args.treasury,
    splitter: event.args.splitter,
    lineStatus: 1,
    creditLimit: event.args.limit,
  });
  await ensureStat(context, at);
  await context.db
    .update(schema.protocolStat, { id: GLOBAL })
    .set((r: any) => ({ activeLines: r.activeLines + 1, updatedAt: at }));
});

ponder.on("CreditLineManager:Drawn", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set((r: any) => ({
    principal: r.principal + event.args.amount,
    aprBps: Number(event.args.aprBps),
  }));
});

ponder.on("CreditLineManager:Accrued", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set((r: any) => ({
    interestAccrued: r.interestAccrued + event.args.interest,
    aprBps: Number(event.args.newAprBps),
  }));
});

ponder.on("CreditLineManager:Repaid", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await context.db.insert(schema.repayment).values({
    id: logId(event),
    agent,
    payer: event.args.payer,
    principal: event.args.principal,
    interest: event.args.interest,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set((r: any) => ({
    principal: r.principal > event.args.principal ? r.principal - event.args.principal : 0n,
    interestAccrued:
      r.interestAccrued > event.args.interest ? r.interestAccrued - event.args.interest : 0n,
  }));
  await ensureStat(context, at);
  await context.db.update(schema.protocolStat, { id: GLOBAL }).set((r: any) => ({
    totalPrincipalRepaid: r.totalPrincipalRepaid + event.args.principal,
    totalInterestPaid: r.totalInterestPaid + event.args.interest,
    updatedAt: at,
  }));
});

ponder.on("CreditLineManager:LineClosed", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set({ lineStatus: 3 });
  await ensureStat(context, at);
  await context.db
    .update(schema.protocolStat, { id: GLOBAL })
    .set((r: any) => ({ activeLines: r.activeLines > 0 ? r.activeLines - 1 : 0, updatedAt: at }));
});

ponder.on("CreditLineManager:Defaulted", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set({ lineStatus: 2 });
  await ensureStat(context, at);
  await context.db
    .update(schema.protocolStat, { id: GLOBAL })
    .set((r: any) => ({ defaults: r.defaults + 1, updatedAt: at }));
});

// ── CreditPool (ERC-4626) ──────────────────────────────────────
ponder.on("CreditPool:Deposit", async ({ event, context }) => {
  const at = ts(event);
  await context.db.insert(schema.poolEvent).values({
    id: logId(event),
    kind: "Deposit",
    account: event.args.owner,
    assets: event.args.assets,
    shares: event.args.shares,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await ensureStat(context, at);
  await context.db
    .update(schema.protocolStat, { id: GLOBAL })
    .set((r: any) => ({ totalDeposited: r.totalDeposited + event.args.assets, updatedAt: at }));
});

ponder.on("CreditPool:Withdraw", async ({ event, context }) => {
  const at = ts(event);
  await context.db.insert(schema.poolEvent).values({
    id: logId(event),
    kind: "Withdraw",
    account: event.args.owner,
    assets: event.args.assets,
    shares: event.args.shares,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await ensureStat(context, at);
  await context.db
    .update(schema.protocolStat, { id: GLOBAL })
    .set((r: any) => ({ totalWithdrawn: r.totalWithdrawn + event.args.assets, updatedAt: at }));
});

ponder.on("CreditPool:LentOut", async ({ event, context }) => {
  const at = ts(event);
  await context.db.insert(schema.poolEvent).values({
    id: logId(event),
    kind: "LentOut",
    account: event.args.to,
    assets: event.args.amount,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await ensureStat(context, at);
  await context.db
    .update(schema.protocolStat, { id: GLOBAL })
    .set((r: any) => ({ totalLentOut: r.totalLentOut + event.args.amount, updatedAt: at }));
});

ponder.on("CreditPool:RepaymentReceived", async ({ event, context }) => {
  const at = ts(event);
  await context.db.insert(schema.poolEvent).values({
    id: logId(event),
    kind: "RepaymentReceived",
    assets: event.args.principal + event.args.interest,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await ensureStat(context, at);
  await context.db
    .update(schema.protocolStat, { id: GLOBAL })
    .set((r: any) => ({ totalReserves: r.totalReserves + event.args.toReserves, updatedAt: at }));
});

// ── MockJobBoard (ERC-8183 stand-in) ───────────────────────────
ponder.on("JobBoard:JobPosted", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await context.db.insert(schema.job).values({
    id: event.args.jobId,
    poster: event.args.poster,
    agent,
    payTo: event.args.payTo,
    amount: event.args.amount,
    status: 1,
    postedAt: at,
    txHash: event.transaction.hash,
  });
  await touchAgent(context, agent, at);
  await context.db
    .update(schema.agent, { address: agent })
    .set((r: any) => ({ jobsPosted: r.jobsPosted + 1 }));
});

ponder.on("JobBoard:JobCompleted", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await context.db
    .update(schema.job, { id: event.args.jobId })
    .set({ status: 2, resolvedAt: at });
  await context.db.insert(schema.payment).values({
    id: logId(event),
    agent,
    payTo: event.args.payTo,
    kind: "job",
    jobId: event.args.jobId,
    amount: event.args.amount,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await touchAgent(context, agent, at);
  await context.db.update(schema.agent, { address: agent }).set((r: any) => ({
    jobsCompleted: r.jobsCompleted + 1,
    grossRevenue: r.grossRevenue + event.args.amount,
  }));
});

ponder.on("JobBoard:JobDisputed", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await context.db
    .update(schema.job, { id: event.args.jobId })
    .set({ status: 3, resolvedAt: at });
  await touchAgent(context, agent, at);
  await context.db
    .update(schema.agent, { address: agent })
    .set((r: any) => ({ jobsDisputed: r.jobsDisputed + 1 }));
});

ponder.on("JobBoard:NanoPayment", async ({ event, context }) => {
  const at = ts(event);
  const agent = event.args.agent as `0x${string}`;
  await context.db.insert(schema.payment).values({
    id: logId(event),
    agent,
    payTo: event.args.payTo,
    payer: event.args.payer,
    kind: "nano",
    amount: event.args.amount,
    timestamp: at,
    txHash: event.transaction.hash,
  });
  await touchAgent(context, agent, at);
  await context.db
    .update(schema.agent, { address: agent })
    .set((r: any) => ({ grossRevenue: r.grossRevenue + event.args.amount }));
});

// ── RevenueSplitter clones (factory) ───────────────────────────
// Exercises the EIP-1167 factory pattern: attribute each flush back to its
// agent (resolved by splitter address) and mark activity.
ponder.on("RevenueSplitter:Flushed", async ({ event, context }) => {
  const at = ts(event);
  const splitter = event.log.address as `0x${string}`;
  const rows = await context.db.sql
    .select({ address: schema.agent.address })
    .from(schema.agent)
    .where(eq(schema.agent.splitter, splitter))
    .limit(1);
  const owner = rows[0]?.address as `0x${string}` | undefined;
  if (owner) await touchAgent(context, owner, at);
});
