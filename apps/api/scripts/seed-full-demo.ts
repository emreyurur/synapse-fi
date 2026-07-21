// One-shot local demo seeder: builds 30 days of job/nanopayment history for
// the two anvil-key demo agents AND an arbitrary extra address (e.g. your own
// wallet) in a single day-stepping pass. Advancing time once per round (not
// once per participant, and not in separate script runs) is the whole point —
// running synthetic-traffic.ts and seed-agent.ts back to back each advances
// the clock independently, which overshoots past wall-clock time and leaves
// every future round's revenue outside the API's 30-day scoring window
// (block timestamps can't move backwards to correct it after the fact).
//
// Usage:
//   npm run seed:full -- 0xExtraAddress [--rounds 29]

import { createWalletClient, createPublicClient, http, parseUnits, parseEventLogs, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi, jobBoardAbi, agentRegistryAbi } from "@synapsefi/shared";
import { config, USDC_DECIMALS } from "../src/config.js";
import { arcTestnet } from "../src/chain.js";

const DEMO_AGENT_KEYS = (process.env.TRAFFIC_AGENT_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean) as Hex[];

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const usdc = (n: number) => parseUnits(n.toFixed(USDC_DECIMALS), USDC_DECIMALS);

async function main() {
  const extra = process.argv[2];
  if (extra && !isAddress(extra)) {
    console.error("If given, the extra address must be a valid 0x address.");
    process.exit(1);
  }
  const rounds = Number(arg("rounds", "29"));

  const posterKey = process.env.TRAFFIC_POSTER_KEY as Hex | undefined;
  const usdcAddr = config.addresses.usdc;
  const jobBoard = config.addresses.jobBoard;
  const registry = config.addresses.agentRegistry;
  if (!posterKey || !usdcAddr || !jobBoard) {
    console.error("TRAFFIC_POSTER_KEY, USDC_ADDRESS, JOB_BOARD_ADDRESS must be configured.");
    process.exit(1);
  }

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(config.rpcUrl) });
  const poster = createWalletClient({ account: privateKeyToAccount(posterKey), chain: arcTestnet, transport: http(config.rpcUrl) });

  const keyedAgents = DEMO_AGENT_KEYS.map((k) => privateKeyToAccount(k).address);
  const targets: Hex[] = [...keyedAgents, ...(extra ? [extra as Hex] : [])];
  console.log(`Poster ${poster.account.address}\nTargets: ${targets.join(", ")}\nRounds: ${rounds}`);

  // Block timestamps only move forward. Advancing `rounds` days from wherever
  // the chain currently sits can overshoot wall-clock time — and once it has,
  // there is no way back; every subsequent payment lands "in the future" and
  // drops out of the API's 30-day scoring window until real time catches up.
  const latest = await publicClient.getBlock();
  const chainNow = Number(latest.timestamp);
  const realNow = Math.floor(Date.now() / 1000);
  const maxSafeRounds = Math.floor((realNow - chainNow) / 86_400);
  if (maxSafeRounds < rounds) {
    console.error(
      `Refusing: chain is at ${new Date(chainNow * 1000).toISOString()}, only ${Math.max(0, maxSafeRounds)} day(s) ` +
        `behind wall-clock — ${rounds} rounds would push it into the future. ` +
        `Re-run with --rounds ${Math.max(0, maxSafeRounds)}, or reset anvil with a fresh --timestamp in the past first.`,
    );
    process.exit(1);
  }

  await poster.writeContract({ address: usdcAddr, abi: erc20Abi, functionName: "mint", args: [poster.account.address, usdc(200_000)] });
  await poster.writeContract({ address: usdcAddr, abi: erc20Abi, functionName: "approve", args: [jobBoard, usdc(10_000_000)] });

  if (registry) {
    for (const key of DEMO_AGENT_KEYS) {
      const w = createWalletClient({ account: privateKeyToAccount(key), chain: arcTestnet, transport: http(config.rpcUrl) });
      await w.writeContract({ address: registry, abi: agentRegistryAbi, functionName: "register", args: [] }).catch(() => {});
    }
  }

  for (let round = 1; round <= rounds; round++) {
    for (const target of targets) {
      const amount = usdc(Number(rand(8, 40).toFixed(2)));
      const hash = await poster.writeContract({ address: jobBoard, abi: jobBoardAbi, functionName: "postJob", args: [target, target, amount] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const posted = parseEventLogs({ abi: jobBoardAbi, eventName: "JobPosted", logs: receipt.logs });
      const jobId = (posted[0]?.args as { jobId?: bigint }).jobId!;

      const outcome = Math.random() < 0.92 ? "completeJob" : "disputeJob";
      await poster.writeContract({ address: jobBoard, abi: jobBoardAbi, functionName: outcome, args: [jobId] });

      if (Math.random() < 0.7) {
        const nano = usdc(Number(rand(0.3, 3).toFixed(2)));
        await poster.writeContract({ address: jobBoard, abi: jobBoardAbi, functionName: "payNano", args: [target, target, nano] });
      }
    }
    console.log(`day ${round}/${rounds} done`);
    await publicClient.request({ method: "evm_increaseTime", params: [86_400] } as never);
    await publicClient.request({ method: "evm_mine", params: [] } as never);
  }

  await publicClient.request({ method: "evm_setNextBlockTimestamp", params: [Math.floor(Date.now() / 1000)] } as never);
  await publicClient.request({ method: "evm_mine", params: [] } as never);

  console.log("\nDone. Run \"npm run oracle\" next.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
