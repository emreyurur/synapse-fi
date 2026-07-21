"use client";

// Pre-connect marketing page. Same design tokens as the dashboard (bridged
// into Tailwind's theme in globals.css — bg-card/border-border/etc. resolve
// to the app's actual palette, not a second one) so this is the front door
// to the same product, not a different-looking one. Swapped for the
// Dashboard the instant a wallet connects.

import { useConnect, useConnectors } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { motion, MotionConfig, type Variants } from "framer-motion";
import { Coins, Gauge, Link2, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { chain } from "@/lib/wagmi";
import { groupMoney } from "@/lib/contracts";
import { ProtocolFooter } from "./protocol-footer";
import { ArcIcon } from "./arc-icon";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const STEPS = [
  { icon: Link2, title: "Connect", body: "Any wallet. Arc Testnet — gas is paid in USDC." },
  {
    icon: Gauge,
    title: "Get scored",
    body: "ERC-8004 reputation + ERC-8183 job revenue → a 0–100 score, refreshed each oracle epoch.",
  },
  {
    icon: Coins,
    title: "Draw or earn",
    body: "Open a line against your score, or supply USDC to the pool and earn on what agents draw.",
  },
] as const;

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
      viewBox="0 0 520 320"
      role="img"
      aria-label="Agent revenue converging into the SynapseFi credit pool"
      className="h-auto w-full"
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
        <motion.circle
          key={i}
          cx={a.x}
          cy={a.y}
          r="6"
          fill={i % 2 ? "var(--series-2)" : "var(--accent)"}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
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

  const statTiles = [
    { label: "Pool TVL", value: `$${groupMoney(stats?.tvl)}` },
    { label: "Agents scored", value: `${agentsData?.count ?? 0}` },
    { label: "Borrow APR from", value: `${(stats?.borrowApr ?? 0).toFixed(1)}%+` },
  ];

  return (
    // reducedMotion="user" mutes transform/scale motion for prefers-reduced-motion
    // without hand-checking it at every call site; opacity fades still play.
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
                <circle cx="7" cy="22" r="3.4" fill="var(--accent)" />
                <circle cx="15" cy="9" r="3.4" fill="var(--accent)" opacity="0.75" />
                <circle cx="24" cy="19" r="3.4" fill="var(--series-2)" />
                <path
                  d="M9 20 L13 12 M17.5 10.5 L21.8 16.6 M10.2 21.4 L20.6 19.4"
                  stroke="var(--ink-3)"
                  strokeWidth="1.4"
                  fill="none"
                />
              </svg>
              <div>
                <div className="text-[15px] font-bold leading-none tracking-tight">SynapseFi</div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Agent credit protocol
                </div>
              </div>
            </div>

            <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <ArcIcon /> {chain.name}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6">
          <section className="grid gap-14 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
            <div>
              <motion.p
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="text-xs font-semibold uppercase tracking-wider text-primary"
              >
                Uncollateralized credit for AI agents
              </motion.p>

              <motion.h1
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
                className="mt-3 text-5xl font-bold leading-[1.05] tracking-tight lg:text-6xl"
              >
                No collateral.
                <br />
                Just a revenue history.
              </motion.h1>

              <motion.p
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
                className="mt-6 max-w-[46ch] text-lg font-normal leading-relaxed text-muted-foreground"
              >
                SynapseFi scores an agent&apos;s onchain reputation and job revenue, then opens a
                USDC line against that score — repayment is cut automatically from revenue as it
                arrives.
              </motion.p>

              <motion.div
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.55, ease: "easeOut", delay: 0.15 }}
                className="mt-9 flex flex-col items-start gap-3"
              >
                <button
                  type="button"
                  onClick={onConnect}
                  disabled={isPending}
                  className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-primary to-accent px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <Wallet className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  {isPending ? "Connecting…" : "Connect wallet"}
                </button>
                <p className="max-w-[44ch] text-xs leading-relaxed text-muted-foreground">
                  Arc Testnet demo — a wallet with no onchain job history still gets an automatic
                  demo score, so Borrow and Earn both work end to end. Connect a real agent wallet
                  with ERC-8183 job history for a genuine score.
                </p>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="rounded-2xl border border-border bg-card/50 p-8 shadow-sm backdrop-blur-sm"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Live protocol graph
                </span>
                <span className="font-mono text-xs text-muted-foreground">CreditPool</span>
              </div>
              <NetworkHero />
            </motion.div>
          </section>

          <motion.section
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-4 border-t border-border py-12 sm:grid-cols-3"
          >
            {statTiles.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="font-mono text-3xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </motion.section>

          <section className="border-t border-border py-16">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How a line opens</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <s.icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <span className="text-sm font-semibold">{`0${i + 1} · ${s.title}`}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <div className="mx-auto max-w-7xl px-6">
          <ProtocolFooter />
        </div>
      </div>
    </MotionConfig>
  );
}
