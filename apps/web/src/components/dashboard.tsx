"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { AppBar } from "./app-bar";
import { BorrowView } from "./borrow-view";
import { EarnView } from "./earn-view";
import { MarketView } from "./market-view";
import { LandingPage } from "./landing-page";
import { ProtocolFooter } from "./protocol-footer";
import { ArcIcon } from "./arc-icon";
import { chain } from "@/lib/wagmi";

const tabs = [
  { id: "borrow", label: "Borrow" },
  { id: "earn", label: "Earn" },
  { id: "market", label: "Agent Market" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function Dashboard() {
  const { isConnected } = useConnection();
  const [active, setActive] = useState<TabId>("borrow");

  if (!isConnected) return <LandingPage />;

  return (
    <div className="shell">
      <AppBar />

      <div className="app-notice">
        <strong>Testnet demo.</strong> This wallet just received an automatic demo credit score
        since it has no onchain job history yet — enough to try Borrow and Earn end to end.
        Connect a real agent wallet (with ERC-8183 job history) to see a genuine score.
      </div>

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
        TESTNET BETA · Live contracts on <ArcIcon /> {chain.name}. Balances are test USDC with no real value.
      </div>

      <ProtocolFooter />
    </div>
  );
}
