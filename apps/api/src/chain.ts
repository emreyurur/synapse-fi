// Read-only viem client for Arc Testnet plus the on-chain reads the API layers
// on top of indexed data (accurate pool TVL/utilization, per-agent line state).

import { createPublicClient, defineChain, fallback, http } from "viem";
import { creditPoolAbi, scoreOracleAbi } from "@synapsefi/shared";
import { config } from "./config.js";

export const arcTestnet = defineChain({
  id: config.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: config.rpcUrls as unknown as string[] } },
});

// Falls over to the next Arc RPC when one rate-limits instead of failing the
// read outright — see ARC_TESTNET_RPC_URLS for why this isn't just http(url).
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: fallback(config.rpcUrls.map((url) => http(url))),
});

export interface PoolChainState {
  totalAssets: bigint;
  totalLent: bigint;
  reserves: bigint;
  utilizationBps: bigint;
}

/** Reads live pool state; returns null if the pool is not deployed/reachable. */
export async function readPoolState(): Promise<PoolChainState | null> {
  const pool = config.addresses.creditPool;
  if (!pool) return null;
  try {
    // Sequential, not Promise.all — four simultaneous requests against Arc's
    // shared public RPC reliably trip its rate limit (seen repeatedly: the
    // mock-score onboarding write and the indexer's historical sync both hit
    // "request limit reached" under identical concurrent-call patterns).
    const totalAssets = await publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "totalAssets" });
    const totalLent = await publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "totalLent" });
    const reserves = await publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "reserves" });
    const utilizationBps = await publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "utilizationBps" });
    return { totalAssets, totalLent, reserves, utilizationBps };
  } catch (err) {
    console.error("[chain] readPoolState failed", err);
    return null;
  }
}

/** Reads an agent's on-chain score (0–1000) + freshness, or null on failure. */
export async function readOnchainScore(agent: `0x${string}`): Promise<{ score: number; fresh: boolean } | null> {
  const oracle = config.addresses.scoreOracle;
  if (!oracle) return null;
  try {
    const [score, fresh] = (await publicClient.readContract({
      address: oracle,
      abi: scoreOracleAbi,
      functionName: "getScore",
      args: [agent],
    })) as [number, boolean];
    return { score: Number(score), fresh };
  } catch (err) {
    console.error("[chain] readOnchainScore failed", err);
    return null;
  }
}
