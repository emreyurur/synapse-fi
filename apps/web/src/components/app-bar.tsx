"use client";

import {
  useBalance,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { chain } from "@/lib/wagmi";
import { formatUsdc, usdc } from "@/lib/contracts";
import { useTx } from "@/lib/use-tx";

/** MockUSDC is a free-mint testnet token — 10,000 USDC is enough to try Earn + Borrow. */
const FAUCET_AMOUNT = 10_000n * 10n ** 6n;

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AppBar() {
  const { address, isConnected, chainId } = useConnection();
  const { mutate: connect, isPending } = useConnect();
  const connectors = useConnectors();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain, isPending: isSwitching } = useSwitchChain();
  const faucet = useTx();

  // The protocol denominates Earn/Borrow in an ERC-20 test token (MockUSDC),
  // which is a *different* balance from the wallet's native currency — Arc's
  // native gas token is also called "USDC" (18 decimals), which is real
  // testnet USDC from an Arc faucet and is what pays for every transaction,
  // including minting the test token below. Both are shown so that's obvious
  // rather than one silently overwriting the other in a single "Balance" chip.
  const { data: balance } = useReadContract({
    ...usdc,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: nativeBalance } = useBalance({ address, query: { enabled: Boolean(address) } });

  const wrongNetwork = isConnected && chainId !== chain.id;
  const onFaucet = () => address && faucet.send({ ...usdc, functionName: "mint", args: [address, FAUCET_AMOUNT] });

  const label = isConnected && address
    ? shortAddress(address)
    : isPending
      ? "Connecting…"
      : "Connect wallet";

  const onClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      const connector = connectors[0];
      if (connector) connect({ connector });
    }
  };

  return (
    <header className="appbar">
      <div className="brand">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="7" cy="22" r="3.4" fill="var(--accent)" />
          <circle cx="15" cy="9" r="3.4" fill="var(--accent)" opacity="0.75" />
          <circle cx="24" cy="19" r="3.4" fill="var(--series-2)" />
          <path d="M9 20 L13 12 M17.5 10.5 L21.8 16.6 M10.2 21.4 L20.6 19.4" stroke="var(--ink-3)" strokeWidth="1.4" fill="none" />
        </svg>
        <div>
          <div className="brand-name">SynapseFi</div>
          <div className="brand-sub">Agent credit protocol · Arc</div>
        </div>
      </div>
      <div className="appbar-right">
        {wrongNetwork ? (
          <button
            className="wallet-btn mono"
            type="button"
            onClick={() => switchChain({ chainId: chain.id })}
            disabled={isSwitching}
            style={{ borderColor: "var(--crit)", color: "var(--crit)" }}
          >
            {isSwitching ? "Switching…" : `Switch to ${chain.name}`}
          </button>
        ) : (
          <span className="chip">
            <span className="dot" />
            {chain.name}
          </span>
        )}
        <span className="chip mono" title="Native Arc testnet USDC — pays for every transaction, including the faucet mint below. Get some from an Arc faucet if this reads 0.">
          Gas&nbsp;·&nbsp;
          <strong>
            {isConnected && !wrongNetwork && nativeBalance
              ? `${(Number(nativeBalance.value) / 10 ** nativeBalance.decimals).toFixed(4)} USDC`
              : "0.0000 USDC"}
          </strong>
        </span>
        <span className="chip mono" title="MockUSDC — the ERC-20 test token Earn and Borrow actually run on, separate from your native gas balance">
          Test&nbsp;USDC&nbsp;·&nbsp;
          <strong>{isConnected && !wrongNetwork ? formatUsdc(balance) : "0.00"}</strong>
        </span>
        {isConnected && !wrongNetwork && (
          <button
            className="wallet-btn mono"
            type="button"
            onClick={onFaucet}
            disabled={faucet.isBusy}
            title="Mint 10,000 test USDC (MockUSDC, free on testnet) to try Earn and Borrow — costs a little native gas USDC"
          >
            {faucet.isBusy ? "Minting…" : "Get test USDC"}
          </button>
        )}
        <button className="wallet-btn mono" type="button" onClick={onClick} title={isConnected ? "Disconnect" : "Connect an injected wallet"}>
          {label}
        </button>
      </div>
    </header>
  );
}
