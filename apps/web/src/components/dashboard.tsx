"use client";

import { useState } from "react";
import { AppBar } from "./app-bar";
import { BorrowView } from "./borrow-view";
import { EarnView } from "./earn-view";
import { MarketView } from "./market-view";
import { chain } from "@/lib/wagmi";
import { contractAddresses } from "@/lib/contracts";

const tabs = [
  { id: "borrow", label: "Borrow" },
  { id: "earn", label: "Earn" },
  { id: "market", label: "Agent Market" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const short = (a: string | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "not deployed");

export function Dashboard() {
  const [active, setActive] = useState<TabId>("borrow");

  return (
    <div className="shell">
      <AppBar />

      <nav className="tabs" role="tablist" aria-label="SynapseFi sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            className="tab"
            role="tab"
            aria-selected={active === t.id}
            type="button"
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active === "borrow" && <BorrowView />}
      {active === "earn" && <EarnView />}
      {active === "market" && <MarketView />}

      <div className="mock-note mono">
        TESTNET BETA · Live contracts on {chain.name}. Balances are test USDC with no real value.
        Wallets with no job history get a demo starter score so Borrow is usable end to end.
      </div>

      <footer>
        <div className="col">
          <strong style={{ color: "var(--ink-2)" }}>Protocol contracts · {chain.name}</strong>
          <span className="mono">CreditPool (ERC-4626) {short(contractAddresses.creditPool)}</span>
          <span className="mono">CreditLineManager {short(contractAddresses.creditLineManager)}</span>
          <span className="mono">ScoreOracle {short(contractAddresses.scoreOracle)}</span>
        </div>
        <div className="col">
          <strong style={{ color: "var(--ink-2)" }}>Built on</strong>
          <span>Arc · Circle App Kit · USDC · ERC-8004 · ERC-8183</span>
        </div>
        <div className="col" style={{ marginLeft: "auto" }}>
          <strong style={{ color: "var(--ink-2)" }}>SynapseFi</strong>
          <span>Working capital for the agentic economy.</span>
        </div>
      </footer>
    </div>
  );
}
