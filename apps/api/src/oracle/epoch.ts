// Pure epoch computation: given indexed data, produce the on-chain score write
// payload (0–1000 scores + factor hashes) for every known agent. Kept side
// effect-free so it can be unit-tested and reused by the worker.

import { keccak256, stringToHex } from "viem";
import { toOnchainScore, factorsPreimage } from "@synapsefi/shared";
import type { Repo } from "../repo.js";
import { scoreAgent } from "../scoring/service.js";

export interface EpochEntry {
  agent: `0x${string}`;
  score100: number; // canonical 0–100
  onchainScore: number; // 0–1000
  grade: string;
  factorsHash: `0x${string}`;
}

export interface EpochResult {
  epoch: number;
  entries: EpochEntry[];
}

/** Epoch index from a timestamp and cadence (default ~6 minutes). */
export function epochNumber(nowSeconds: number, epochSeconds = 360): number {
  return Math.floor(nowSeconds / epochSeconds);
}

/** Computes the full score write set for the current epoch. */
export async function computeEpoch(
  repo: Repo,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  epochSeconds = 360,
): Promise<EpochResult> {
  const agents = await repo.listAgents();
  const entries: EpochEntry[] = [];
  for (const a of agents) {
    const payments = await repo.getPayments(a.address, 1000);
    const s = scoreAgent(a, payments, nowSeconds);
    entries.push({
      agent: a.address as `0x${string}`,
      score100: s.score,
      onchainScore: toOnchainScore(s.score),
      grade: s.grade,
      factorsHash: keccak256(stringToHex(factorsPreimage(s.factors, s.version))),
    });
  }
  return { epoch: epochNumber(nowSeconds, epochSeconds), entries };
}
