"use client";

import { useState } from "react";
import { AppBar } from "./app-bar";
import { BorrowView } from "./borrow-view";
import { EarnView } from "./earn-view";
import { MarketView } from "./market-view";

const tabs = [
  { id: "borrow", label: "Borrow" },
  { id: "earn", label: "Earn" },
  { id: "market", label: "Agent Market" },
] as const;

type TabId = (typeof tabs)[number]["id"];

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
        DESIGN PROTOTYPE v0.1 · All data is mock. No live contracts, wallets, or transactions.
      </div>

      <footer>
        <div className="col">
          <strong style={{ color: "var(--ink-2)" }}>Protocol contracts · Arc Testnet</strong>
          <span className="mono">CreditPool (ERC-4626) 0xA4e9…1B77</span>
          <span className="mono">RevenueRouter 0x51c2…9dA1</span>
          <span className="mono">ScoreOracle 0x9d40…C3f2</span>
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
