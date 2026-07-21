"use client";

// Standalone slide deck at /pitch-deck. Independent of the wallet-gated
// Dashboard/LandingPage split — this route is public regardless of
// connection state. Same design tokens as the rest of the app (the
// @theme inline bridge in globals.css), so it reads as the same product —
// rounded cards + a colored left-accent stripe (the same device toast.tsx
// and app-notice already use for category color), not a sharp-corner /
// pixel-notch system that would clash with the rest of the UI.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Coins, Gauge, Landmark, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { chain } from "@/lib/wagmi";
import { groupMoney, contractAddresses } from "@/lib/contracts";
import { ArcIcon } from "./arc-icon";
import { XLogo } from "./x-icon";

const short = (a: string | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "not deployed");

// Cycled per-card, same idea as the toast kind stripe — a quiet way to give
// a grid of cards individual identity without a second color palette.
const ACCENTS = ["border-l-primary", "border-l-accent", "border-l-amber-500", "border-l-pink-400"];

function Card({
  children,
  index = 0,
  className = "",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-l-[3px] border-border bg-card p-5 ${ACCENTS[index % ACCENTS.length]} ${className}`}>
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
      <span className="h-1.5 w-1.5 flex-none bg-primary" />
      {children}
    </p>
  );
}

function SlideShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center px-8 py-16">{children}</div>;
}

// ── Slides ────────────────────────────────────────────────────

function TitleSlide() {
  return (
    <SlideShell>
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <ArcIcon /> Live on {chain.name}
      </div>
      <h1 className="mt-6 text-6xl font-bold leading-[1.02] tracking-tight lg:text-7xl">SynapseFi</h1>
      <p className="mt-4 text-2xl font-medium text-muted-foreground">Working capital for the agentic economy.</p>
      <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
        Uncollateralized USDC credit lines for AI agents — underwritten by what an agent actually
        earns onchain, not what it holds.
      </p>
    </SlideShell>
  );
}

function ProblemSlide() {
  const points = [
    {
      title: "Agents earn real, verifiable revenue",
      body: "ERC-8183 job payouts and nanopayments settle onchain — a genuine, auditable cash-flow history.",
    },
    {
      title: "DeFi lending ignores it",
      body: "Every major money market is 100%+ overcollateralized. Pointless for an agent whose entire model is not sitting on idle capital.",
    },
    {
      title: "TradFi doesn't recognize agents at all",
      body: "No KYC identity, no credit bureau, no loan officer evaluates an autonomous wallet.",
    },
  ];
  return (
    <SlideShell>
      <Eyebrow>The problem</Eyebrow>
      <h2 className="mt-3 max-w-[18ch] text-5xl font-bold leading-[1.08] tracking-tight">
        Agents earn revenue. They can&apos;t borrow against it.
      </h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {points.map((p, i) => (
          <Card key={p.title} index={i}>
            <div className="text-sm font-semibold">{p.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </Card>
        ))}
      </div>
      <p className="mt-8 max-w-[60ch] text-sm text-muted-foreground">
        Result: agents can&apos;t smooth cash flow between jobs, can&apos;t front the cost of a
        bigger job, can&apos;t scale past what they happen to be holding right now.
      </p>
    </SlideShell>
  );
}

function SolutionSlide() {
  return (
    <SlideShell>
      <Eyebrow>The solution</Eyebrow>
      <h2 className="mt-3 max-w-[16ch] text-5xl font-bold leading-[1.08] tracking-tight">
        Score the work, not the wallet.
      </h2>
      <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-muted-foreground">
        SynapseFi reads an agent&apos;s onchain reputation (ERC-8004) and job/nanopayment revenue
        (ERC-8183), computes a 0–100 credit score, and opens a USDC line sized to that score —{" "}
        <span className="font-semibold text-foreground">no collateral</span>. Repayment is cut
        automatically from the agent&apos;s incoming revenue via a per-agent{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-base">RevenueSplitter</code>{" "}
        until the debt clears.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Gauge, label: "Score", body: "Reputation + revenue → 0–100" },
          { icon: Coins, label: "Draw", body: "Line sized to score, in USDC" },
          { icon: Landmark, label: "Auto-repay", body: "Cut from revenue as it lands" },
        ].map((s, i) => (
          <Card key={s.label} index={i}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
              <s.icon className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="mt-3 text-sm font-semibold">{s.label}</div>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </Card>
        ))}
      </div>
    </SlideShell>
  );
}

function MechanismSlide() {
  const factors = [
    { label: "Job completion", weight: "30%" },
    { label: "Revenue continuity", weight: "25%" },
    { label: "Dispute-free rate", weight: "25%" },
    { label: "Revenue stability", weight: "20%" },
  ];
  return (
    <SlideShell>
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">From job history to credit limit</h2>

      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        <Card index={0} className="p-6">
          <div className="text-sm font-semibold">1 · The score (0–100)</div>
          <div className="mt-4 space-y-2.5">
            {factors.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-mono font-semibold">{f.weight}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Recomputed every oracle epoch, written onchain to <code className="font-mono">ScoreOracle</code>.
          </p>
        </Card>

        <Card index={1} className="p-6">
          <div className="text-sm font-semibold">2 · The line</div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Minimum score to open a line</dt>
              <dd className="font-mono font-semibold">50 / 100</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Credit per point above minimum</dt>
              <dd className="font-mono font-semibold">50 USDC</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Revenue swept to repayment (in debt)</dt>
              <dd className="font-mono font-semibold">12%</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Swept if delinquent</dt>
              <dd className="font-mono font-semibold">100%</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Borrow APR follows a kinked utilization curve — 2% base, 10% at 80% utilization, 19% at 100%.
          </p>
        </Card>
      </div>
    </SlideShell>
  );
}

function TractionSlide() {
  const { data: stats } = useQuery({ queryKey: ["pool-stats"], queryFn: api.poolStats, refetchInterval: 15_000 });
  const { data: agentsData } = useQuery({ queryKey: ["agents"], queryFn: api.listAgents, refetchInterval: 15_000 });

  const tiles = [
    { label: "Pool TVL", value: `$${groupMoney(stats?.tvl)}` },
    { label: "Agents scored", value: `${agentsData?.count ?? 0}` },
    { label: "Active lines", value: `${stats?.activeLines ?? 0}` },
    { label: "Borrow APR from", value: `${(stats?.borrowApr ?? 0).toFixed(1)}%` },
  ];
  const whatsLive = [
    "Borrow — open a line, draw, repay",
    "Earn — ERC-4626 vault deposit / withdraw",
    "Agent Market — live scores, tier & status filters",
    "Automatic demo scoring for wallets with no job history",
  ];
  const infra = [
    "Ponder indexer — 5 contract types → Postgres",
    "Hono API + cron oracle worker (epoch scoring)",
    "35 Foundry tests — unit + fuzz",
    "Deployed: Railway (API/indexer) + Vercel (frontend)",
  ];
  const contracts = [
    ["CreditPool (ERC-4626)", contractAddresses.creditPool],
    ["CreditLineManager", contractAddresses.creditLineManager],
    ["ScoreOracle", contractAddresses.scoreOracle],
  ] as const;

  return (
    <SlideShell>
      <Eyebrow>Not a mockup</Eyebrow>
      <h2 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">
        Live on {chain.name} right now
      </h2>
      <p className="mt-4 max-w-[60ch] text-sm text-muted-foreground">
        Every number below is a live read from the deployed contracts and indexer — not seeded copy.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t, i) => (
          <Card key={t.label} index={i}>
            <div className="font-mono text-2xl font-bold tracking-tight">{t.value}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t.label}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card index={0}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What&apos;s live</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {whatsLive.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="mt-1.75 h-1 w-1 flex-none rounded-full bg-primary" />
                {x}
              </li>
            ))}
          </ul>
        </Card>
        <Card index={1}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Infrastructure</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {infra.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="mt-1.75 h-1 w-1 flex-none rounded-full bg-accent" />
                {x}
              </li>
            ))}
          </ul>
        </Card>
        <Card index={2}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deployed contracts</div>
          <div className="mt-3 space-y-1.5 font-mono text-xs">
            {contracts.map(([label, addr]) => (
              <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-muted-foreground">{label}</span>
                <span>{short(addr)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </SlideShell>
  );
}

function MarketSlide() {
  const points = [
    {
      title: "Agents are already transacting",
      body: "69,000 active agents and 165M transactions on x402 alone (Coinbase/Cloudflare, Apr 2026); ~25,000 agents registered under ERC-8004. Not theoretical — running today.",
    },
    {
      title: "Stablecoins are the native rail",
      body: "Stablecoins settled $7.5T in March 2026 — more than ACH. USDC alone moved $18.3T in 2025 (Artemis/Bloomberg). This is already how agents pay and get paid.",
    },
    {
      title: "No underwriting layer exists",
      body: "Every credit primitive in DeFi still prices token collateral. Nothing prices an agent as an economic actor with a track record.",
    },
  ];
  return (
    <SlideShell>
      <Eyebrow>Why now</Eyebrow>
      <h2 className="mt-3 max-w-[20ch] text-5xl font-bold leading-[1.08] tracking-tight">
        Agent-to-agent commerce is becoming a real economy.
      </h2>
      <div className="mt-9 grid gap-5 sm:grid-cols-3">
        {points.map((p, i) => (
          <Card key={p.title} index={i}>
            <div className="text-sm font-semibold">{p.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </Card>
        ))}
      </div>
      <p className="mt-8 max-w-[62ch] text-sm text-muted-foreground">
        SynapseFi is the underwriting layer for that economy — the credit bureau and the lender,
        both reading directly from the chain.
      </p>
    </SlideShell>
  );
}

function MarketSizeSlide() {
  const tiers = [
    {
      abbr: "TAM",
      full: "Total addressable",
      value: "$1.5T",
      body: "Global agentic-commerce spend by 2030 — Juniper Research.",
      bar: "from-primary to-accent",
    },
    {
      abbr: "SAM",
      full: "Serviceable addressable",
      value: "$862M",
      body: "69,000 active onchain agents (x402, Apr 2026) × ~$12,500 avg. addressable line at a B-grade SynapseFi score.",
      bar: "from-amber-400 to-amber-600",
    },
    {
      abbr: "SOM",
      full: "Serviceable obtainable",
      value: "$8.6M",
      body: "Conservative Year-1 target: 1% of the current active-agent base scored and drawing lines.",
      bar: "from-pink-400 to-pink-600",
    },
  ];
  return (
    <SlideShell>
      <Eyebrow>Market opportunity</Eyebrow>
      <h2 className="mt-3 max-w-[18ch] text-5xl font-bold leading-[1.08] tracking-tight">
        Small today. Sized for where agents are going.
      </h2>
      <div className="mt-9 grid gap-5 sm:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.abbr} className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">{t.abbr}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.full}</span>
            </div>
            <div className="mt-3 text-4xl font-bold tracking-tight">{t.value}</div>
            <div className={`mt-3 h-1.5 w-full rounded-full bg-gradient-to-r ${t.bar}`} />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Sources: Juniper Research (agentic commerce, 2030 projection) · Coinbase/Cloudflare x402
        network stats (April 2026) · Artemis/Bloomberg stablecoin volume (2025–2026) · SynapseFi
        CreditLineManager parameters (50 USDC per score point above a 500/1000 minimum).
      </p>
    </SlideShell>
  );
}

function WhyArcSlide() {
  const facts = [
    { title: "USDC-native gas", body: "Fees are paid in USDC itself — predictable, dollar-denominated cost for every agent decision." },
    { title: "Sub-second finality", body: "Arc's Malachite consensus gives deterministic, fast settlement — agents can act near real-time." },
    { title: "Built for stablecoin finance", body: "Arc is Circle's L1, purpose-built for payments and stablecoin settlement, not general-purpose compute." },
    { title: "An ecosystem that already gets agents", body: "100+ institutional testnet partners — including BlackRock, Visa, Coinbase, and Anthropic." },
  ];
  return (
    <SlideShell>
      <Eyebrow>Why Arc</Eyebrow>
      <h2 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">Built where agents already pay each other</h2>
      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        {facts.map((f, i) => (
          <Card key={f.title} index={i}>
            <div className="text-sm font-semibold">{f.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Source: Circle, &ldquo;Introducing Arc&rdquo; — testnet launched October 2025, mainnet targeted summer 2026.
      </p>
    </SlideShell>
  );
}

function ArchitectureSlide() {
  const layers = [
    {
      n: "01",
      cat: "Contracts",
      title: "Solidity + Foundry",
      body: "ScoreOracle, CreditLineManager, CreditPool (ERC-4626), RevenueSplitter (EIP-1167 clones) + factory.",
    },
    {
      n: "02",
      cat: "Indexer",
      title: "Ponder → Postgres",
      body: "Watches every contract's events — scores, lines, deposits, payments — into one schema.",
    },
    {
      n: "03",
      cat: "API",
      title: "Hono + Drizzle",
      body: "Serves the indexed data; a cron oracle worker recomputes scores each epoch and writes them onchain.",
    },
    {
      n: "04",
      cat: "Frontend",
      title: "Next.js + wagmi",
      body: "Live contract reads and transactions via wagmi/viem, TanStack Query for API data.",
    },
  ];
  return (
    <SlideShell>
      <Eyebrow>Architecture</Eyebrow>
      <h2 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">Four layers, one source of truth</h2>
      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        {layers.map((l, i) => (
          <Card key={l.n} index={i}>
            <div className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {l.n} · {l.cat}
            </div>
            <div className="mt-2 text-base font-semibold">{l.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
          </Card>
        ))}
      </div>
    </SlideShell>
  );
}

const TOP_ACCENTS = ["border-t-primary", "border-t-accent", "border-t-amber-500", "border-t-pink-400"];

function RoadmapSlide() {
  const phases = [
    {
      tag: "Phase 0–1",
      status: "Done",
      title: "Core protocol",
      items: ["Contracts + 35 tests (unit + fuzz)", "ERC-4626 pool, scoring oracle", "Deployed to Arc Testnet"],
    },
    {
      tag: "Phase 2",
      status: "Done",
      title: "Indexer & API",
      items: ["Ponder indexer (5 contract types)", "Hono REST API", "Oracle worker — epoch scoring"],
    },
    {
      tag: "Phase 3",
      status: "Done",
      title: "Live frontend",
      items: ["Borrow / Earn / Agent Market UI", "Automatic demo-score onboarding", "Railway + Vercel deploy"],
    },
    {
      tag: "Phase 4",
      status: "Next",
      title: "Hardening & mainnet",
      items: ["Security review + invariant fuzzing", "Oracle-manipulation defenses", "Ship on Arc mainnet"],
    },
  ];
  return (
    <SlideShell>
      <Eyebrow>Roadmap</Eyebrow>
      <h2 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">Where we are, what&apos;s next</h2>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {phases.map((p, i) => (
          <div
            key={p.tag}
            className={`rounded-xl border border-t-[3px] border-border bg-card p-5 ${TOP_ACCENTS[i % TOP_ACCENTS.length]}`}
          >
            <div className="text-lg font-bold tracking-tight">{p.tag}</div>
            <div
              className={`mt-1 text-[11px] font-semibold uppercase tracking-wider ${
                p.status === "Done" ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              {p.status}
            </div>
            <div className="mt-3 text-sm font-semibold">{p.title}</div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              {p.items.map((x) => (
                <li key={x} className="border-t border-border/60 pt-2 first:border-none first:pt-0">
                  {x}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function TeamSlide() {
  return (
    <SlideShell>
      <Eyebrow>Team</Eyebrow>
      <h2 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">Built by one founder, shipped end to end</h2>
      <div className="mt-9 flex items-center gap-5 rounded-xl border border-border bg-card p-6">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-lg font-bold text-primary-foreground">
          SF
        </div>
        <div>
          <div className="text-base font-semibold">Founder</div>
          <a
            href="https://x.com/xemreyrr"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <XLogo className="h-3.5 w-3.5" /> @xemreyrr
          </a>
        </div>
      </div>
    </SlideShell>
  );
}

function AskSlide() {
  const uses = [
    { label: "Partnerships", amount: "$50K", body: "Protocol integrations — agent job boards, x402, ERC-8004 identity registries, LP partners." },
    { label: "Core team", amount: "$50K", body: "Hiring protocol, backend, and product engineers to accelerate execution." },
    { label: "Chain expansion", amount: "$25K", body: "Mainnet deployment on Arc, engineering for additional EVM chains." },
    { label: "Marketing & growth", amount: "$50K", body: "Agent-developer ecosystem distribution, GTM, community growth." },
    { label: "Infrastructure & security", amount: "$25K", body: "Dedicated RPC infrastructure, a third-party audit ahead of mainnet, hosting." },
  ];
  return (
    <SlideShell>
      <Eyebrow>The ask</Eyebrow>
      <h2 className="mt-3 max-w-[16ch] text-5xl font-bold leading-[1.08] tracking-tight">
        Scaling the category.
      </h2>
      <p className="mt-4 max-w-[60ch] text-sm text-muted-foreground">Use of funds: partnerships, team, chains, security, growth.</p>

      <div className="mt-9 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {uses.map((u, i) => (
          <Card key={u.label} index={i}>
            <div className="text-2xl font-bold tracking-tight">{u.amount}</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{u.label}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{u.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-primary to-accent p-6 text-primary-foreground">
        <div>
          <div className="text-sm font-semibold">Total raise</div>
          <div className="text-xs opacity-85">Pre-seed</div>
        </div>
        <div className="text-4xl font-bold tracking-tight">$200K</div>
      </div>
    </SlideShell>
  );
}

function TryItSlide() {
  const links = [
    { label: "Try the live app", href: "/" },
    { label: "@xemreyrr on X", href: "https://x.com/xemreyrr" },
  ];
  return (
    <SlideShell>
      <Eyebrow>Try it</Eyebrow>
      <h2 className="mt-3 max-w-[18ch] text-5xl font-bold leading-[1.08] tracking-tight">
        Connect a wallet. See a score in seconds.
      </h2>
      <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted-foreground">
        Every flow in this deck is live on {chain.name} — Borrow, Earn, and the Agent Market all
        read and write the deployed contracts.
      </p>
      <div className="mt-9 flex flex-wrap gap-3">
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel={l.href.startsWith("http") ? "noreferrer" : undefined}
            className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_var(--accent)]"
          >
            <Sparkles className="h-4 w-4" />
            {l.label}
          </Link>
        ))}
      </div>
    </SlideShell>
  );
}

const SLIDES = [
  TitleSlide,
  ProblemSlide,
  SolutionSlide,
  MechanismSlide,
  TractionSlide,
  MarketSlide,
  MarketSizeSlide,
  WhyArcSlide,
  ArchitectureSlide,
  RoadmapSlide,
  AskSlide,
  TeamSlide,
  TryItSlide,
];

// ── Deck shell: progress bar, nav, keyboard, transitions ────────

export function PitchDeck() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= SLIDES.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  const Slide = SLIDES[index];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      <div className="absolute inset-x-0 top-0 z-30 h-[2px] bg-border">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${((index + 1) / SLIDES.length) * 100}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      <div className="absolute left-6 top-6 z-20 flex items-center gap-3">
        <span className="text-xs font-bold tracking-tight text-foreground">SynapseFi</span>
        <Link
          href="/"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Exit to app →
        </Link>
      </div>

      <span className="absolute right-6 top-6 z-20 font-mono text-xs text-muted-foreground">
        {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
      </span>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={index}
          custom={direction}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.32, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Slide />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-5">
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Next slide"
          onClick={() => go(index + 1)}
          disabled={index === SLIDES.length - 1}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
