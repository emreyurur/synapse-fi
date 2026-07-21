import { cookieStorage, createConfig, createStorage, http, injected } from "wagmi";
import { arcTestnet } from "viem/chains";
import type { Chain } from "viem";

const rpcOverride = process.env.NEXT_PUBLIC_RPC_URL;

/**
 * Arc Testnet, or a local anvil node impersonating it.
 *
 * Local dev runs `anvil --chain-id 5042002`, so the chain id matches Arc
 * Testnet and every address in @synapsefi/shared resolves the same way. Two
 * things must change when pointing at anvil:
 *  - the RPC url (anvil is not the public Arc endpoint), and
 *  - multicall3, which is predeployed on Arc but absent on a fresh anvil —
 *    leaving it configured makes wagmi batch reads into a call to an empty
 *    address, which reverts.
 */
export const chain: Chain = rpcOverride
  ? {
      ...arcTestnet,
      rpcUrls: { default: { http: [rpcOverride] } },
      contracts: {},
    }
  : arcTestnet;

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [chain.id]: http(rpcOverride),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
