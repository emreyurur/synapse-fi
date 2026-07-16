// Single source of truth for chain constants, deployed addresses, and ABIs.
// The Foundry deploy script (packages/contracts/script/Deploy.s.sol) writes the
// broadcast output; addresses below are updated from it after each deployment.

export const ARC_TESTNET_CHAIN_ID = 5042002;

export const ARC_TESTNET = {
  chainId: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorerUrl: "https://testnet.arcscan.app",
  // Gas on Arc is USDC itself (18-decimal native representation).
  nativeSymbol: "USDC",
} as const;

/**
 * Deployed protocol contract addresses per chain.
 * `null` = not deployed yet (Faz 1). The frontend must treat null as
 * "feature not live" and fall back to its empty/placeholder state.
 */
export const ADDRESSES: Record<
  number,
  {
    creditPool: `0x${string}` | null;
    creditLineManager: `0x${string}` | null;
    revenueRouter: `0x${string}` | null;
    scoreOracle: `0x${string}` | null;
    interestRateModel: `0x${string}` | null;
  }
> = {
  [ARC_TESTNET_CHAIN_ID]: {
    creditPool: null,
    creditLineManager: null,
    revenueRouter: null,
    scoreOracle: null,
    interestRateModel: null,
  },
};

/** Interest-rate model parameters (mirrors InterestRateModel.sol). */
export const RATE_MODEL = {
  baseAprBps: 200, // 2.00%
  kinkUtilizationBps: 8000, // 80%
  aprAtKinkBps: 1000, // 10.00%
  maxAprBps: 1900, // 19.00% at 100% utilization
} as const;

export const bpsToPercent = (bps: number) => bps / 100;

/** Borrow APR (%) for a utilization in [0, 1] — kinked model. */
export function borrowAprPercent(utilization: number): number {
  const u = Math.min(Math.max(utilization, 0), 1);
  const base = bpsToPercent(RATE_MODEL.baseAprBps);
  const atKink = bpsToPercent(RATE_MODEL.aprAtKinkBps);
  const max = bpsToPercent(RATE_MODEL.maxAprBps);
  const kink = RATE_MODEL.kinkUtilizationBps / 10_000;
  if (u <= kink) return base + ((atKink - base) * u) / kink;
  return atKink + ((max - atKink) * (u - kink)) / (1 - kink);
}
