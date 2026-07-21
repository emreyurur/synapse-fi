// Synthetic traffic generator: drives ERC-8183 jobs + nanopayments on the
// MockJobBoard for a set of demo agents, so the indexer, scoring service, and
// UI have live testnet data flowing. Idempotent-ish and randomized.
//
// Usage:
//   TRAFFIC_POSTER_KEY=0x... TRAFFIC_AGENT_KEYS=0x...,0x... \
//     npm run traffic -w @synapsefi/api -- --rounds 20
//
// Requires MockUSDC (mintable) + MockJobBoard addresses configured (env or
// @synapsefi/shared). On real USDC, fund the poster manually and drop --mint.

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseEventLogs,
  type Account,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi, jobBoardAbi, agentRegistryAbi, revenueRouterFactoryAbi } from "@synapsefi/shared";
import { config, USDC_DECIMALS } from "../src/config.js";
import { arcTestnet } from "../src/chain.js";

const ZERO = "0x0000000000000000000000000000000000000000";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const ROUNDS = Number(arg("rounds", "12"));
const DO_MINT = flag("mint") || true; // default on for MockUSDC testnets
/**
 * Days of chain time to jump between rounds (anvil only — uses evm_increaseTime).
 * Without this every round lands on the same block timestamp, so all revenue
 * buckets into a single day and the 30-day continuity factor bottoms out. Pair
 * with `anvil --timestamp <30 days ago>` so the run *ends* at ~wall-clock now:
 * the API buckets payments against Date.now(), and future-dated blocks would
 * fall outside its window entirely.
 */
const SPREAD_DAYS = Number(arg("spread-days", "0"));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const usdc = (n: number) => parseUnits(n.toFixed(USDC_DECIMALS), USDC_DECIMALS);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const publicClient = createPublicClient({ chain: arcTestnet, transport: http(config.rpcUrl) });

function walletFor(key: Hex) {
  const account: Account = privateKeyToAccount(key);
  return createWalletClient({ account, chain: arcTestnet, transport: http(config.rpcUrl) });
}

async function send(fn: () => Promise<Hex>, label: string): Promise<void> {
  try {
    const hash = await fn();
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  ✓ ${label} (${hash.slice(0, 10)}…)`);
  } catch (err) {
    console.log(`  ✗ ${label}: ${(err as Error).message.split("\n")[0]}`);
  }
}

/** Advances anvil's clock so the next round's events land on a later day. */
async function advanceDays(days: number): Promise<void> {
  await publicClient.request({
    method: "evm_increaseTime",
    params: [Math.floor(days * 86_400)],
  } as never);
  await publicClient.request({ method: "evm_mine", params: [] } as never);
}

async function splitterOrSelf(agent: Hex): Promise<Hex> {
  const factory = config.addresses.revenueRouterFactory;
  if (!factory) return agent;
  try {
    const s = (await publicClient.readContract({
      address: factory,
      abi: revenueRouterFactoryAbi,
      functionName: "splitterOf",
      args: [agent],
    })) as Hex;
    return s && s !== ZERO ? s : agent;
  } catch {
    return agent;
  }
}

async function main() {
  const posterKey = process.env.TRAFFIC_POSTER_KEY as Hex | undefined;
  const agentKeys = (process.env.TRAFFIC_AGENT_KEYS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as Hex[];
  // Address-only traffic targets (e.g. a real user wallet building up a score).
  // Jobs and nanopayments only need the agent as a payout target — no key —
  // so these accrue history without ever holding their private key. They are
  // not auto-registered in the ERC-8004 mock (register() is msg.sender-bound).
  const extraAgents = (process.env.TRAFFIC_EXTRA_AGENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("0x")) as Hex[];

  const usdcAddr = config.addresses.usdc;
  const jobBoard = config.addresses.jobBoard;
  const registry = config.addresses.agentRegistry;

  if (!posterKey || agentKeys.length === 0) {
    console.error("Set TRAFFIC_POSTER_KEY and TRAFFIC_AGENT_KEYS (comma-separated).");
    process.exit(1);
  }
  if (!usdcAddr || !jobBoard) {
    console.error("USDC_ADDRESS and JOB_BOARD_ADDRESS must be configured (env or shared registry).");
    process.exit(1);
  }

  const poster = walletFor(posterKey);
  const posterAddr = poster.account!.address;
  const targets: Hex[] = [...agentKeys.map((k) => privateKeyToAccount(k).address), ...extraAgents];
  console.log(`Poster: ${posterAddr}`);
  console.log(`Agents: ${targets.length} (${extraAgents.length} address-only), rounds: ${ROUNDS}, jobBoard: ${jobBoard}`);

  // Register agents (ERC-8004 mock) and fund the poster.
  for (const key of agentKeys) {
    const w = walletFor(key);
    if (registry) {
      await send(
        () => w.writeContract({ address: registry, abi: agentRegistryAbi, functionName: "register", args: [] }),
        `register ${w.account!.address}`,
      );
    }
  }

  if (DO_MINT) {
    await send(
      () =>
        poster.writeContract({
          address: usdcAddr,
          abi: erc20Abi,
          functionName: "mint",
          args: [posterAddr, usdc(1_000_000)],
        }),
      "mint 1,000,000 USDC to poster",
    );
  }
  await send(
    () =>
      poster.writeContract({
        address: usdcAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [jobBoard, usdc(1_000_000_000)],
      }),
    "approve jobBoard",
  );

  if (SPREAD_DAYS > 0) {
    console.log(`Spreading rounds ${SPREAD_DAYS} day(s) apart in chain time (anvil).`);
  }

  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n── Round ${round}/${ROUNDS} ──`);
    for (const agentAddr of targets) {
      const payTo = await splitterOrSelf(agentAddr);
      const amount = usdc(Number(rand(2, 40).toFixed(2)));

      // Post a job and capture the assigned jobId from the JobPosted log.
      let jobId: bigint | null = null;
      try {
        const hash = await poster.writeContract({
          address: jobBoard,
          abi: jobBoardAbi,
          functionName: "postJob",
          args: [agentAddr, payTo, amount],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const logs = parseEventLogs({ abi: jobBoardAbi, eventName: "JobPosted", logs: receipt.logs });
        jobId = (logs[0]?.args as { jobId?: bigint } | undefined)?.jobId ?? null;
        console.log(
          `  ✓ postJob ${agentAddr.slice(0, 8)}… ${(Number(amount) / 1e6).toFixed(2)} USDC (job #${jobId})`,
        );
      } catch (err) {
        console.log(`  ✗ postJob: ${(err as Error).message.split("\n")[0]}`);
      }

      // Settle it — mostly complete, occasionally dispute.
      if (jobId != null) {
        const outcome = Math.random() < 0.9 ? "completeJob" : "disputeJob";
        await send(
          () =>
            poster.writeContract({
              address: jobBoard,
              abi: jobBoardAbi,
              functionName: outcome,
              args: [jobId as bigint],
            }),
          `${outcome} #${jobId}`,
        );
      }

      // Stream a few nanopayments.
      if (Math.random() < 0.7) {
        const nano = usdc(Number(rand(0.2, 3).toFixed(2)));
        await send(
          () =>
            poster.writeContract({
              address: jobBoard,
              abi: jobBoardAbi,
              functionName: "payNano",
              args: [agentAddr, payTo, nano],
            }),
          `payNano ${(Number(nano) / 1e6).toFixed(2)} USDC → ${pick(["stream", "tip", "usage"])}`,
        );
      }
    }
    if (SPREAD_DAYS > 0) await advanceDays(SPREAD_DAYS);
    else await sleep(500);
  }

  // Sweep stragglers: on a flaky public RPC the receipt-wait often fails after
  // the tx has landed, so runs leave jobs stuck in Posted. Only this poster
  // posts jobs, so completing every still-Posted job is always safe — and it
  // makes the daily cron self-healing instead of accumulating unresolved jobs
  // that drag every agent's completion rate down.
  try {
    const nextId = (await publicClient.readContract({
      address: jobBoard,
      abi: [{ type: "function", name: "nextJobId", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] }] as const,
      functionName: "nextJobId",
    })) as bigint;
    for (let id = 1n; id < nextId; id++) {
      const job = (await publicClient.readContract({
        address: jobBoard,
        abi: [{ type: "function", name: "jobs", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "poster", type: "address" }, { name: "agent", type: "address" }, { name: "payTo", type: "address" }, { name: "amount", type: "uint256" }, { name: "status", type: "uint8" }] }] as const,
        functionName: "jobs",
        args: [id],
      })) as readonly [Hex, Hex, Hex, bigint, number];
      if (job[4] === 1) {
        await send(
          () => poster.writeContract({ address: jobBoard, abi: jobBoardAbi, functionName: "completeJob", args: [id] }),
          `sweep: completeJob #${id} (stuck in Posted)`,
        );
      }
    }
  } catch (err) {
    console.log(`  sweep skipped: ${(err as Error).message.split("\n")[0]}`);
  }

  console.log("\nDone. Point the indexer at these contracts to see the data flow.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
