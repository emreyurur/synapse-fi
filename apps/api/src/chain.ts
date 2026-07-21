// Read-only viem client for Arc Testnet plus the on-chain reads the API layers
// on top of indexed data (accurate pool TVL/utilization, per-agent line state).

import { createPublicClient, defineChain, http } from "viem";
import { creditPoolAbi, scoreOracleAbi } from "@synapsefi/shared";
import { config } from "./config.js";

export const arcTestnet = defineChain({
  id: config.chainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(config.rpcUrl),
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
    const [totalAssets, totalLent, reserves, utilizationBps] = await Promise.all([
      publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "totalAssets" }),
      publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "totalLent" }),
      publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "reserves" }),
      publicClient.readContract({ address: pool, abi: creditPoolAbi, functionName: "utilizationBps" }),
    ]);
    return { totalAssets, totalLent, reserves, utilizationBps };
  } catch {
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
  } catch {
    return null;
  }
}
