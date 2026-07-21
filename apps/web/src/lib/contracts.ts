// Typed contract handles for wagmi hooks: address + ABI pairs resolved from the
// @synapsefi/shared registry, so views never hardcode an address.

import {
  ADDRESSES,
  ARC_TESTNET_CHAIN_ID,
  agentRegistryAbi,
  creditLineManagerAbi,
  creditPoolAbi,
  erc20Abi,
  scoreOracleAbi,
} from "@synapsefi/shared";

// Env first, then the shared registry — mirroring apps/api and the indexer.
// The local anvil chain reuses Arc Testnet's chain id but deploys to its own
// addresses, so a chain-id lookup alone cannot tell the two apart.
// NEXT_PUBLIC_* values are inlined at build time, hence the literal keys.
const fromEnv = {
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  creditPool: process.env.NEXT_PUBLIC_CREDIT_POOL_ADDRESS,
  creditLineManager: process.env.NEXT_PUBLIC_CREDIT_LINE_MANAGER_ADDRESS,
  scoreOracle: process.env.NEXT_PUBLIC_SCORE_ORACLE_ADDRESS,
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS,
} as const;

const registry = ADDRESSES[ARC_TESTNET_CHAIN_ID];

function addr(key: keyof typeof fromEnv): `0x${string}` | undefined {
  const v = fromEnv[key];
  if (v?.startsWith("0x")) return v as `0x${string}`;
  return registry[key] ?? undefined;
}

const addresses = {
  usdc: addr("usdc"),
  creditPool: addr("creditPool"),
  creditLineManager: addr("creditLineManager"),
  scoreOracle: addr("scoreOracle"),
  agentRegistry: addr("agentRegistry"),
};

/** ERC-20 USDC decimals. Distinct from the 18-decimal native gas USDC on Arc. */
export const USDC_DECIMALS = 6;

/** True once the protocol has a deployment on the configured chain. */
export const isDeployed = addresses.creditPool !== undefined;

export const contractAddresses = addresses;

export const creditPool = { address: addresses.creditPool, abi: creditPoolAbi } as const;
export const creditLineManager = { address: addresses.creditLineManager, abi: creditLineManagerAbi } as const;
export const scoreOracle = { address: addresses.scoreOracle, abi: scoreOracleAbi } as const;
export const agentRegistry = { address: addresses.agentRegistry, abi: agentRegistryAbi } as const;
export const usdc = { address: addresses.usdc, abi: erc20Abi } as const;

/** Formats a 6-decimal USDC amount for display. */
export function formatUsdc(value: bigint | undefined, fractionDigits = 2): string {
  if (value === undefined) return "—";
  return (Number(value) / 10 ** USDC_DECIMALS).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Exact decimal string for a USDC amount, for prefilling an input (the "Max"
 * button). Unlike formatUsdc this never rounds: formatUsdc(11990.526358) shows
 * "11,990.53", and re-parsing that yields *more* than the balance, so a Max
 * that used the display string would build a reverting transaction.
 */
export function toUsdcInput(value: bigint): string {
  const unit = BigInt(10 ** USDC_DECIMALS);
  const whole = value / unit;
  const frac = (value % unit).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/**
 * Regroups a user-typed amount for display: "2000.5" -> "2,000.5", matching the
 * en-US grouping formatUsdc renders everywhere else.
 *
 * Everything that is not a digit or a dot is dropped, so the only commas that
 * can reach the field are the ones this inserts — which is precisely what lets
 * parseUsdc read every comma as a thousands separator. The fraction is left
 * exactly as typed (including a bare trailing dot) so that grouping never
 * rewrites the part of the number still being entered.
 */
export function groupAmountInput(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = dot === -1 ? cleaned : cleaned.slice(0, dot);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (dot === -1) return grouped;
  return `${grouped}.${cleaned.slice(dot + 1).replace(/\./g, "")}`;
}

/**
 * Parses a user-typed USDC amount into base units. Returns null if invalid.
 *
 * A comma is always a thousands separator and is stripped ("1,500.25" -> 1500.25);
 * the dot is the only decimal separator, matching formatUsdc's en-US output. The
 * amount fields group as you type via groupAmountInput and refuse a hand-typed
 * comma, so a comma here is always one we inserted — it can never be a European
 * decimal point that we would otherwise silently read off by 1000x.
 */
export function parseUsdc(input: string): bigint | null {
  const s = input.trim().replace(/,/g, "");
  if (!s) return null;
  if (!/^\d*\.?\d*$/.test(s)) return null;
  const [whole = "0", frac = ""] = s.split(".");
  if (frac.length > USDC_DECIMALS) return null;
  const padded = frac.padEnd(USDC_DECIMALS, "0");
  const value = BigInt(whole || "0") * BigInt(10 ** USDC_DECIMALS) + BigInt(padded || "0");
  return value > 0n ? value : null;
}

export const bpsToPercent = (bps: bigint | number | undefined): string =>
  bps === undefined ? "—" : `${(Number(bps) / 100).toFixed(1)}%`;

/** Mirrors CreditLineManager.Status. */
export const LINE_STATUS = ["None", "Active", "Delinquent", "Closed"] as const;
export type LineStatus = (typeof LINE_STATUS)[number];
