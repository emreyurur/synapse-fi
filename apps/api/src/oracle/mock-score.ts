// Instant demo score for a wallet the indexer has never seen. Real scores come
// from the epoch worker (oracle/index.ts), which needs indexed job/revenue
// history that a hackathon judge's fresh wallet will never have. This writes a
// deterministic (per-address, stable across reconnects) score straight to
// ScoreOracle using the same authorized updater key, so `CreditLineManager`
// treats it exactly like a real epoch write — `openLine`/`draw` work against
// the live contracts, not a frontend fake.
import { createWalletClient, http, keccak256, toHex, type Account } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { scoreOracleAbi, SCORING_VERSION } from "@synapsefi/shared";
import { config } from "../config.js";
import { arcTestnet, publicClient, readOnchainScore } from "../chain.js";
import { epochNumber } from "./epoch.js";

// Onchain scale is 0-1000 (canonical score x10). 600-899 -> 60.0-89.9 canonical,
// comfortably above CreditLineManager.minScore (500) and spanning grade C+ to A-.
const MOCK_SCORE_MIN = 600;
const MOCK_SCORE_RANGE = 300;

function getAccount(): Account | null {
  const key = config.oraclePrivateKey;
  if (!key || !key.startsWith("0x")) return null;
  return privateKeyToAccount(key as `0x${string}`);
}

/** Deterministic demo score for an address — same number every time it's asked for. */
export function mockOnchainScore(agent: `0x${string}`): number {
  const hash = BigInt(keccak256(toHex(agent.toLowerCase())));
  return MOCK_SCORE_MIN + Number(hash % BigInt(MOCK_SCORE_RANGE));
}

export interface MockScoreResult {
  agent: `0x${string}`;
  onchainScore: number;
  txHash: `0x${string}`;
}

/**
 * Writes a demo score for `agent` if it doesn't already have a fresh one.
 * Returns null (no-op) when the oracle signer isn't configured, or when the
 * agent already has a live score — the caller treats both as "no tx needed".
 */
export async function ensureMockScore(agent: `0x${string}`): Promise<MockScoreResult | null> {
  const account = getAccount();
  const oracle = config.addresses.scoreOracle;
  if (!account || !oracle) return null;

  const existing = await readOnchainScore(agent);
  if (existing?.fresh) return null;

  const onchainScore = mockOnchainScore(agent);
  const epoch = BigInt(epochNumber(Math.floor(Date.now() / 1000)));
  const factorsHash = keccak256(toHex(`mock:${SCORING_VERSION}:${agent.toLowerCase()}:${epoch}`));

  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(config.rpcUrl) });
  const txHash = await walletClient.writeContract({
    address: oracle,
    abi: scoreOracleAbi,
    functionName: "setScore",
    args: [agent, onchainScore, epoch, factorsHash],
  });
  // The write already succeeded once we have a hash — waiting for the receipt
  // is best-effort confirmation, not a precondition. The public Arc testnet
  // RPC rate-limits the polling `eth_getTransactionReceipt` calls under any
  // real traffic (every visitor onboarding hits this, unlike the once-an-hour
  // epoch worker), and a poll failure there must not be reported as the score
  // write itself having failed — the frontend's own refetch picks up the
  // confirmed state once indexed either way.
  try {
    await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 20_000 });
  } catch (err) {
    console.warn(`[oracle] mock score tx ${txHash} submitted but receipt wait failed (rate limit?)`, err);
  }
  return { agent, onchainScore, txHash };
}
