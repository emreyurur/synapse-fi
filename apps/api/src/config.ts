// Central runtime configuration for the API + oracle worker. All values come
// from the environment; sensible testnet defaults keep local dev turnkey.

import { ARC_TESTNET, ARC_TESTNET_CHAIN_ID, ARC_TESTNET_RPC_URLS, ADDRESSES } from "@synapsefi/shared";

const chain = ADDRESSES[ARC_TESTNET_CHAIN_ID];

function addr(envKey: string, fallback: `0x${string}` | null): `0x${string}` | null {
  const v = process.env[envKey];
  if (v && v.startsWith("0x")) return v as `0x${string}`;
  return fallback;
}

// An explicit RPC_URL goes first (so operators can still pin one endpoint),
// then the rest of Arc's known public RPCs as fallbacks — a bare `http(url)`
// transport has no recourse when that one endpoint rate-limits.
const rpcUrl = process.env.RPC_URL ?? ARC_TESTNET.rpcUrl;
const rpcUrls = [rpcUrl, ...ARC_TESTNET_RPC_URLS.filter((u) => u !== rpcUrl)];

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseSchema: process.env.DATABASE_SCHEMA ?? "public",

  chainId: ARC_TESTNET_CHAIN_ID,
  rpcUrl,
  rpcUrls,

  // Oracle worker.
  oracleEnabled: process.env.ORACLE_ENABLED === "true",
  oraclePrivateKey: (process.env.ORACLE_PRIVATE_KEY ?? "") as `0x${string}` | "",
  // Epoch cadence — the roadmap targets ~6 minutes.
  oracleCron: process.env.ORACLE_CRON ?? "*/6 * * * *",

  // Response cache + rate limit.
  cacheTtlMs: Number(process.env.CACHE_TTL_MS ?? 15_000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 120),

  addresses: {
    usdc: addr("USDC_ADDRESS", chain.usdc),
    scoreOracle: addr("SCORE_ORACLE_ADDRESS", chain.scoreOracle),
    creditPool: addr("CREDIT_POOL_ADDRESS", chain.creditPool),
    creditLineManager: addr("CREDIT_LINE_MANAGER_ADDRESS", chain.creditLineManager),
    revenueRouterFactory: addr("REVENUE_ROUTER_FACTORY_ADDRESS", chain.revenueRouterFactory),
    agentRegistry: addr("AGENT_REGISTRY_ADDRESS", chain.agentRegistry),
    jobBoard: addr("JOB_BOARD_ADDRESS", chain.jobBoard),
  },
} as const;

/** USDC has 6 decimals on Arc. */
export const USDC_DECIMALS = 6;
