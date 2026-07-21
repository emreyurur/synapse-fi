// Oracle worker: on a cron cadence, recomputes agent scores off-chain and
// pushes them to the ScoreOracle in one batched `setScores` transaction. The
// private key is held locally here (MVP) — production would route signing
// through a Circle Dev-Controlled Wallet, keeping this call-site unchanged.

import cron from "node-cron";
import { pathToFileURL } from "node:url";
import { createWalletClient, http, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { scoreOracleAbi } from "@synapsefi/shared";
import { config } from "../config.js";
import { arcTestnet, publicClient } from "../chain.js";
import { closeDb } from "../db.js";
import { createRepo, type Repo } from "../repo.js";
import { computeEpoch, type EpochResult } from "./epoch.js";

function getAccount(): Account | null {
  const key = config.oraclePrivateKey;
  if (!key || !key.startsWith("0x")) return null;
  return privateKeyToAccount(key as `0x${string}`);
}

/** Runs one epoch: compute scores and (if configured) submit them on-chain. */
export async function runEpochOnce(repo: Repo = createRepo()): Promise<EpochResult> {
  const result = await computeEpoch(repo, Math.floor(Date.now() / 1000));
  const { epoch, entries } = result;

  if (entries.length === 0) {
    console.log(`[oracle] epoch ${epoch}: no agents to score`);
    return result;
  }

  const account = getAccount();
  const oracle = config.addresses.scoreOracle;

  console.log(`[oracle] epoch ${epoch}: computed ${entries.length} scores`);
  for (const e of entries) {
    console.log(`  ${e.agent} → ${e.score100} (${e.grade}) [onchain ${e.onchainScore}]`);
  }

  if (!account || !oracle) {
    console.log("[oracle] dry run (set ORACLE_PRIVATE_KEY + SCORE_ORACLE_ADDRESS to submit on-chain)");
    return result;
  }

  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(config.rpcUrl) });
  const agents = entries.map((e) => e.agent);
  const scores = entries.map((e) => e.onchainScore);
  const hashes = entries.map((e) => e.factorsHash);

  const hash = await walletClient.writeContract({
    address: oracle,
    abi: scoreOracleAbi,
    functionName: "setScores",
    args: [agents, scores, BigInt(epoch), hashes],
  });
  console.log(`[oracle] epoch ${epoch}: submitted setScores tx ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[oracle] epoch ${epoch}: confirmed`);
  return result;
}

/** Schedules the recurring epoch job. */
export function startOracleWorker(): void {
  const repo = createRepo();
  console.log(`[oracle] worker started (cron "${config.oracleCron}")`);
  cron.schedule(config.oracleCron, () => {
    runEpochOnce(repo).catch((err) => console.error("[oracle] epoch failed", err));
  });
}

// Allow `npm run oracle` to trigger a single epoch immediately.
// (pathToFileURL, not a manual `file://` template — process.argv[1] is a
// Windows path with backslashes, which never matches import.meta.url.)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Release the Postgres pool and let the event loop drain on its own rather
  // than calling process.exit() — forcing an exit with the pool's sockets still
  // open trips a libuv assertion on Windows and returns a nonzero code even
  // though the epoch succeeded.
  runEpochOnce()
    .then(() => closeDb())
    .catch(async (err) => {
      console.error(err);
      await closeDb();
      process.exitCode = 1;
    });
}
