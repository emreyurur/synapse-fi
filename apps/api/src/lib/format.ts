import { USDC_DECIMALS } from "../config.js";

const ONE = 10 ** USDC_DECIMALS;

/** USDC base units (bigint) → number in whole USDC. */
export function toUsdc(units: bigint | number): number {
  return Number(units) / ONE;
}

/** USDC base units → fixed-2 string, e.g. 1234567n → "1.23". */
export function formatUsdc(units: bigint | number, dp = 2): string {
  return toUsdc(units).toFixed(dp);
}

/** bigint-safe JSON: serialize any bigint as a decimal string. */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

export const LINE_STATUS_LABEL = ["None", "Active", "Delinquent", "Closed"] as const;
