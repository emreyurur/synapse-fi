"use client";

import { useBalance, useConnect, useConnection, useDisconnect } from "wagmi";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUsdc(value: bigint, decimals: number) {
  const num = Number(value) / 10 ** decimals;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AppBar() {
  const { address, isConnected } = useConnection();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  // Gas token on Arc is USDC itself, so the native balance IS the USDC balance.
  const { data: balance } = useBalance({ address });

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
        <span className="chip">
          <span className="dot" />
          Arc Testnet
        </span>
        <span className="chip mono">
          Balance&nbsp;·&nbsp;
          <strong>
            {isConnected && balance
              ? `${formatUsdc(balance.value, balance.decimals)} ${balance.symbol}`
              : "—"}
          </strong>
        </span>
        <button className="wallet-btn mono" type="button" onClick={onClick} title={isConnected ? "Disconnect" : "Connect an injected wallet"}>
          {label}
        </button>
      </div>
    </header>
  );
}
