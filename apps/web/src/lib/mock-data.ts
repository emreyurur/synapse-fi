// Mock protocol data for the SynapseFi design prototype (v0.1).
// No live contracts — every value below is illustrative only.

export type PillState = "ok" | "warn" | "crit";

export interface AgentRow {
  name: string;
  id: string;
  score: number;
  grade: string;
  rev: string;
  limit: string;
  drawn: string;
  apr: string;
  st: PillState;
  stl: string;
  hue: string;
  spark: number[];
}

export const agents: AgentRow[] = [
  { name: "lexi-audit.arc",      id: "#3018", score: 841, grade: "A+", rev: "14,203", limit: "20,000", drawn: "4,100", apr: "7.4%",  st: "ok",   stl: "Active",       hue: "#4558e8", spark: [3, 4, 4, 5, 6, 5, 7, 8, 7, 9] },
  { name: "scout-7b.arc",        id: "#4127", score: 782, grade: "A",  rev: "9,847",  limit: "12,500", drawn: "7,800", apr: "9.2%",  st: "ok",   stl: "Repaying",     hue: "#199e70", spark: [4, 5, 4, 6, 6, 7, 6, 8, 8, 9] },
  { name: "datamesh-04.arc",     id: "#2266", score: 763, grade: "A−", rev: "8,112",  limit: "10,000", drawn: "9,120", apr: "9.8%",  st: "ok",   stl: "Repaying",     hue: "#2a78d6", spark: [5, 5, 6, 5, 7, 6, 7, 7, 8, 8] },
  { name: "relay-ops.arc",       id: "#5511", score: 698, grade: "B+", rev: "5,530",  limit: "6,000",  drawn: "5,700", apr: "12.1%", st: "ok",   stl: "Repaying",     hue: "#7b5be8", spark: [4, 4, 5, 5, 4, 6, 5, 6, 6, 7] },
  { name: "quantbee.arc",        id: "#6082", score: 655, grade: "B",  rev: "4,204",  limit: "4,500",  drawn: "3,950", apr: "13.6%", st: "ok",   stl: "Active",       hue: "#c2547f", spark: [3, 4, 3, 5, 4, 5, 4, 5, 6, 5] },
  { name: "forge-translate.arc", id: "#1893", score: 612, grade: "B−", rev: "3,876",  limit: "3,500",  drawn: "3,500", apr: "15.2%", st: "warn", stl: "At limit",     hue: "#b97a2a", spark: [4, 5, 4, 4, 5, 4, 5, 4, 5, 5] },
  { name: "pixel-render.arc",    id: "#7340", score: 588, grade: "C+", rev: "2,940",  limit: "2,500",  drawn: "2,410", apr: "17.0%", st: "warn", stl: "Grace period", hue: "#5a8ca8", spark: [5, 4, 5, 4, 4, 3, 4, 3, 3, 4] },
  { name: "nullwave.arc",        id: "#0977", score: 431, grade: "D",  rev: "1,102",  limit: "1,000",  drawn: "1,000", apr: "—",     st: "crit", stl: "Delinquent",   hue: "#8a8a95", spark: [5, 4, 4, 3, 3, 2, 2, 2, 1, 1] },
];

// Daily nanopayment inflows (USDC), Jun 17 → Jul 16 2026.
export const revData = [
  242, 268, 251, 290, 312, 275, 301, 334, 318, 296,
  342, 361, 329, 355, 388, 340, 362, 401, 372, 395,
  418, 384, 352, 406, 431, 398, 367, 412, 439, 406,
];

export const revDays = revData.map((_, i) => {
  const d = new Date(2026, 5, 17 + i);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
});

export interface RoutedPayment {
  time: string;
  job: string;
  counterparty: string;
  amount: string;
  toPool: string;
  toTreasury: string;
  st: PillState;
  stl: string;
}

export const routedPayments: RoutedPayment[] = [
  { time: "14:02:11", job: "job #8183-55c1 · web research", counterparty: "lexi-audit.arc",      amount: "6.40", toPool: "0.77", toTreasury: "5.63", st: "ok",   stl: "Settled" },
  { time: "13:58:47", job: "stream · data feed",            counterparty: "datamesh-04.arc",     amount: "0.92", toPool: "0.11", toTreasury: "0.81", st: "ok",   stl: "Settled" },
  { time: "13:51:20", job: "job #8183-55b7 · summarization", counterparty: "0x3aB1…77E0",        amount: "3.15", toPool: "0.38", toTreasury: "2.77", st: "ok",   stl: "Settled" },
  { time: "13:44:03", job: "job #8183-55a9 · translation",  counterparty: "forge-translate.arc", amount: "8.00", toPool: "0.96", toTreasury: "7.04", st: "warn", stl: "In escrow" },
  { time: "13:39:56", job: "stream · monitoring",           counterparty: "relay-ops.arc",       amount: "1.24", toPool: "0.15", toTreasury: "1.09", st: "ok",   stl: "Settled" },
];

export const scoreFactors = [
  { label: "Job completion",     value: 98.4 },
  { label: "Revenue continuity", value: 94.1 },
  { label: "Dispute-free rate",  value: 99.3 },
  { label: "Revenue stability",  value: 71.2 },
];

// Interest-rate model lives in @synapsefi/shared (mirrors InterestRateModel.sol).
export { borrowAprPercent as borrowApr } from "@synapsefi/shared";
