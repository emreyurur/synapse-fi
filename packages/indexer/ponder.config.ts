import { createConfig, factory } from "ponder";
import { getAbiItem } from "viem";
import {
  ARC_TESTNET,
  ARC_TESTNET_CHAIN_ID,
  ADDRESSES,
  scoreOracleAbi,
  creditLineManagerAbi,
  creditPoolAbi,
  revenueSplitterAbi,
  revenueRouterFactoryAbi,
  agentRegistryAbi,
  jobBoardAbi,
} from "@synapsefi/shared";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const chainAddresses = ADDRESSES[ARC_TESTNET_CHAIN_ID];

/**
 * Resolve a contract address from (1) an env override, then (2) the shared
 * address registry. Falls back to the zero address so `ponder dev` still boots
 * before a deployment exists — it simply indexes nothing for that contract.
 */
function addr(envKey: string, fromRegistry: `0x${string}` | null): `0x${string}` {
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.startsWith("0x")) return fromEnv as `0x${string}`;
  return fromRegistry ?? ZERO;
}

const startBlock = process.env.PONDER_START_BLOCK ? Number(process.env.PONDER_START_BLOCK) : 0;

const scoreOracle = addr("SCORE_ORACLE_ADDRESS", chainAddresses.scoreOracle);
const creditLineManager = addr("CREDIT_LINE_MANAGER_ADDRESS", chainAddresses.creditLineManager);
const creditPool = addr("CREDIT_POOL_ADDRESS", chainAddresses.creditPool);
const revenueRouterFactory = addr("REVENUE_ROUTER_FACTORY_ADDRESS", chainAddresses.revenueRouterFactory);
const agentRegistry = addr("AGENT_REGISTRY_ADDRESS", chainAddresses.agentRegistry);
const jobBoard = addr("JOB_BOARD_ADDRESS", chainAddresses.jobBoard);

export default createConfig({
  chains: {
    arc: {
      id: ARC_TESTNET_CHAIN_ID,
      // Comma-separated list → Ponder rotates across them, so one public
      // endpoint rate-limiting (or dying mid-sync) doesn't kill the indexer.
      rpc: (process.env.PONDER_RPC_URL_ARC ?? ARC_TESTNET.rpcUrl)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      // Default 1s polling hammers public RPCs for no benefit — the UI and
      // API tolerate a few seconds of indexing lag.
      pollingInterval: 3_000,
    },
  },
  contracts: {
    ScoreOracle: {
      chain: "arc",
      abi: scoreOracleAbi,
      address: scoreOracle,
      startBlock,
    },
    CreditLineManager: {
      chain: "arc",
      abi: creditLineManagerAbi,
      address: creditLineManager,
      startBlock,
    },
    CreditPool: {
      chain: "arc",
      abi: creditPoolAbi,
      address: creditPool,
      startBlock,
    },
    AgentRegistry: {
      chain: "arc",
      abi: agentRegistryAbi,
      address: agentRegistry,
      startBlock,
    },
    JobBoard: {
      chain: "arc",
      abi: jobBoardAbi,
      address: jobBoard,
      startBlock,
    },
    // Per-agent RevenueSplitter clones — discovered from factory events.
    RevenueSplitter: {
      chain: "arc",
      abi: revenueSplitterAbi,
      address: factory({
        address: revenueRouterFactory,
        event: getAbiItem({ abi: revenueRouterFactoryAbi, name: "SplitterCreated" }),
        parameter: "splitter",
      }),
      startBlock,
    },
  },
});
