// Funds an arbitrary address on the local anvil chain so you can drive the UI
// with your own wallet instead of importing an anvil test key.
//
// Gives it both native gas and MockUSDC. Anvil-only: `anvil_setBalance` is a
// dev RPC method, and MockUSDC.mint is unrestricted (testnet stand-in).
//
// Usage:
//   npm run fund -- 0xYourAddress [--usdc 100000] [--gas 100]

import { createWalletClient, createPublicClient, http, parseUnits, parseEther, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "@synapsefi/shared";
import { config, USDC_DECIMALS } from "../src/config.js";
import { arcTestnet } from "../src/chain.js";

// Anvil's first default account — a publicly known test key, funded at genesis.
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const target = process.argv[2];
  if (!target || !isAddress(target)) {
    console.error("Usage: npm run fund -- 0xYourAddress [--usdc 100000] [--gas 100]");
    process.exit(1);
  }

  const usdcAmount = arg("usdc", "100000");
  const gasAmount = arg("gas", "100");
  const usdcAddr = config.addresses.usdc;
  if (!usdcAddr) {
    console.error("USDC_ADDRESS not configured — deploy the contracts first.");
    process.exit(1);
  }

  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(config.rpcUrl) });
  const wallet = createWalletClient({
    account: privateKeyToAccount(ANVIL_KEY),
    chain: arcTestnet,
    transport: http(config.rpcUrl),
  });

  // Gas first — without a native balance the address cannot send anything.
  await publicClient.request({
    method: "anvil_setBalance",
    params: [target, `0x${parseEther(gasAmount).toString(16)}`],
  } as never);
  console.log(`✓ set native balance to ${gasAmount}`);

  const hash = await wallet.writeContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: "mint",
    args: [target as Hex, parseUnits(usdcAmount, USDC_DECIMALS)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ minted ${usdcAmount} USDC`);

  const balance = await publicClient.readContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [target as Hex],
  });
  console.log(`\n${target} now holds ${Number(balance) / 10 ** USDC_DECIMALS} USDC on the local chain.`);
  console.log("Make sure MetaMask is on chain id 5042002 pointed at http://localhost:8545.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
