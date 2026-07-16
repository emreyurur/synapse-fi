import { cookieStorage, createConfig, createStorage, http, injected } from "wagmi";
import { arcTestnet } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [arcTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
