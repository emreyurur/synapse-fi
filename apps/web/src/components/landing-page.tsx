"use client";

// Pre-connect marketing page. Same visual system as the dashboard (tokens,
// card/flow/chip primitives) — this is the front door, not a different
// product. Swapped for the Dashboard the instant a wallet connects.

import { useConnect, useConnectors } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chain } from "@/lib/wagmi";
import { ProtocolFooter } from "./protocol-footer";

/** Agent nodes feeding a single pool node — the mechanism, not decoration. */
function NetworkHero() {
  const agents = [
    { x: 62, y: 54 },
    { x: 40, y: 156 },
    { x: 84, y: 252 },
    { x: 168, y: 82 },
    { x: 156, y: 220 },
  ];
  const pool = { x: 462, y: 156 };
  const ctrl = (a: { x: number; y: number }) => ({
    x: (a.x + pool.x) / 2 + (pool.y - a.y) * 0.12,
    y: (a.y + pool.y) / 2 + (a.x - pool.x) * 0.12,
  });

  return (
    <svg
      className="landing-network"
      viewBox="0 0 520 320"
      role="img"
      aria-label="Agent revenue converging into the SynapseFi credit pool"
    >
      <circle cx={pool.x} cy={pool.y} r="46" fill="var(--accent)" opacity="0.08" />
      {agents.map((a, i) => {
        const c = ctrl(a);
        return (
          <path
            key={i}
            d={`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${pool.x} ${pool.y}`}
            stroke="var(--hairline-strong)"
            strokeWidth="1.2"
            fill="none"
          />
        );
      })}
      {agents.map((a, i) => (
        <circle
          key={i}
          className="p"
          cx={a.x}
          cy={a.y}
          r="6"
          fill={i % 2 ? "var(--series-2)" : "var(--accent)"}
          style={{ animationDelay: `${i * 0.6}s` }}
        />
      ))}
      <circle cx={pool.x} cy={pool.y} r="15" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      <circle cx={pool.x} cy={pool.y} r="5" fill="var(--accent)" />
    </svg>
  );
}

export function LandingPage() {
  const { mutate: connect, isPending } = useConnect();
  const connectors = useConnectors();

  const { data: stats } = useQuery({ queryKey: ["pool-stats"], queryFn: api.poolStats, refetchInterval: 15_000 });
  const { data: agentsData } = useQuery({ queryKey: ["agents"], queryFn: api.listAgents, refetchInterval: 15_000 });

  const onConnect = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  return (
    <div className="landing">
      <header className="landing-top">
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
        <span className="chip">
          <span className="dot" />
          {chain.name}
        </span>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">Uncollateralized credit for AI agents</p>
          <h1>Credit lines priced by what your agent actually earns.</h1>
          <p className="landing-sub">
            SynapseFi reads an agent&apos;s onchain reputation and job revenue, turns it into a
            0–100 credit score, and opens a USDC line against that score — no collateral.
            Repayment is cut automatically from revenue as it arrives.
          </p>

          <div className="landing-cta-row">
            <button className="btn-primary landing-cta" type="button" onClick={onConnect} disabled={isPending}>
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
            <p className="landing-disclosure">
              Arc Testnet demo — a wallet with no onchain job history still gets an automatic demo
              score, so Borrow and Earn both work end to end. Connect a real agent wallet with
              ERC-8183 job history for a genuine score.
            </p>
          </div>

          <div className="landing-stats mono">
            <div>
              <span className="v">{stats ? `$${stats.tvl}` : "—"}</span>
              <span className="l">Pool TVL</span>
            </div>
            <div>
              <span className="v">{agentsData ? agentsData.count : "—"}</span>
              <span className="l">Agents scored</span>
            </div>
            <div>
              <span className="v">{stats ? `${stats.borrowApr.toFixed(1)}%+` : "—"}</span>
              <span className="l">Borrow APR from</span>
            </div>
          </div>
        </div>

        <NetworkHero />
      </section>

      <section className="landing-steps">
        <p className="eyebrow">How a line opens</p>
        <div className="flow">
          <div className="flow-node">
            <div className="fn-t">01 · Connect</div>
            <div className="fn-s">Any wallet. Arc Testnet — gas is paid in USDC.</div>
          </div>
          <div className="flow-arrow" aria-hidden="true">→</div>
          <div className="flow-node hl">
            <div className="fn-t">02 · Get scored</div>
            <div className="fn-s">ERC-8004 reputation + ERC-8183 job revenue → a 0–100 score, refreshed each oracle epoch.</div>
          </div>
          <div className="flow-arrow" aria-hidden="true">→</div>
          <div className="flow-node">
            <div className="fn-t">03 · Draw or earn</div>
            <div className="fn-s">Open a line against your score, or supply USDC to the pool and earn on what agents draw.</div>
          </div>
        </div>
      </section>

      <ProtocolFooter />
    </div>
  );
}
