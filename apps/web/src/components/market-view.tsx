"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type AgentSummary } from "@/lib/api";
import { Sparkline } from "./charts";
import { Pill, type PillState } from "./pill";

type MarketAgent = AgentSummary & { mock?: true };

/** Wave a 30-day series around a mean so the sparkline reads as real activity. */
function revenueSeries(mean: number, spread: number): number[] {
  return Array.from({ length: 30 }, (_, i) => {
    const day = Math.max(0, mean + Math.sin(i / 2.3) * spread + (i % 5 === 0 ? spread * 0.6 : 0));
    return Math.round(day * 100) / 100;
  });
}

// Not on-chain — fills out the market for a fresh deployment with no real
// agent history yet. Clearly labelled "Demo" in the Agent column so nobody
// mistakes one for a real credit line.
const MOCK_AGENTS: MarketAgent[] = [
  {
    address: "0xdec0de0000000000000000000000000000a1a1",
    id: null,
    score: 92,
    grade: "A+",
    onchainScore: null,
    consistent: null,
    revenue: "412.50",
    revenueSeries: revenueSeries(14, 3),
    limit: "21,000.00",
    drawn: "9,400.00",
    apr: "4.2%",
    status: "Active",
    health: "Healthy",
    jobs: { posted: 61, completed: 60, disputed: 0, completionRate: 98.4 },
    mock: true,
  },
  {
    address: "0xdec0de0000000000000000000000000000b2b2",
    id: null,
    score: 68,
    grade: "B−",
    onchainScore: null,
    consistent: null,
    revenue: "146.10",
    revenueSeries: revenueSeries(5, 2.2),
    limit: "9,000.00",
    drawn: "8,760.00",
    apr: "9.8%",
    status: "Active",
    health: "At limit",
    jobs: { posted: 22, completed: 19, disputed: 1, completionRate: 86.4 },
    mock: true,
  },
  {
    address: "0xdec0de0000000000000000000000000000c3c3",
    id: null,
    score: 44,
    grade: "D",
    onchainScore: null,
    consistent: null,
    revenue: "18.30",
    revenueSeries: revenueSeries(0.6, 0.5),
    limit: "0.00",
    drawn: "0.00",
    apr: "0.0%",
    status: "None",
    health: "None",
    jobs: { posted: 5, completed: 2, disputed: 2, completionRate: 40 },
    mock: true,
  },
  {
    address: "0xdec0de0000000000000000000000000000d4d4",
    id: null,
    score: 55,
    grade: "C",
    onchainScore: null,
    consistent: null,
    revenue: "61.75",
    revenueSeries: revenueSeries(2, 1.5),
    limit: "2,500.00",
    drawn: "2,500.00",
    apr: "14.5%",
    status: "Delinquent",
    health: "Delinquent",
    jobs: { posted: 14, completed: 9, disputed: 4, completionRate: 64.3 },
    mock: true,
  },
];

// Score is 0–100 (see @synapsefi/shared gradeFor); tier cutoffs align with its
// letter-grade boundaries (75 = B+, 60 = C+).
const tierFilters: Record<string, (score: number) => boolean> = {
  "All tiers": () => true,
  "Prime (A)": (s) => s >= 75,
  "Standard (B)": (s) => s >= 60 && s < 75,
  "Watch (C+)": (s) => s < 60,
};

const statusFilters: Record<string, (health: string) => boolean> = {
  "All statuses": () => true,
  Healthy: (s) => s === "Healthy",
  "At limit": (s) => s === "At limit",
  Delinquent: (s) => s === "Delinquent",
  "No line": (s) => s === "None" || s === "Closed",
};

function pillState(health: string): PillState {
  if (health === "Delinquent") return "crit";
  if (health === "At limit") return "warn";
  return "ok";
}

/** Deterministic accent per agent, so a row keeps its colour across refreshes. */
function hueFor(address: string): string {
  const h = parseInt(address.slice(2, 8), 16) % 360;
  return `hsl(${h} 52% 45%)`;
}

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function MarketView() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("All tiers");
  const [status, setStatus] = useState("All statuses");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["agents"],
    queryFn: api.listAgents,
    refetchInterval: 15_000, // matches the API cache TTL
  });

// Real indexed agents first, then the demo fill-ins, same as the API's
  // best-score-first ordering would tend to interleave them anyway.
  const agents: MarketAgent[] = useMemo(() => [...(data?.agents ?? []), ...MOCK_AGENTS], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter(
      (a) =>
        (!q || a.address.toLowerCase().includes(q) || (a.id ?? "").toLowerCase().includes(q)) &&
        tierFilters[tier](a.score) &&
        statusFilters[status](a.health),
    );
  }, [agents, query, tier, status]);

  const indexedCount = data?.agents.length ?? 0;
  const activeLines = agents.filter((a) => a.status === "Active").length;

  return (
    <section>
      <div className="filters">
        <input
          type="search"
          placeholder="Search agent, ERC-8004 ID, or address"
          aria-label="Search agents"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Filter by tier" value={tier} onChange={(e) => setTier(e.target.value)}>
          {Object.keys(tierFilters).map((t) => <option key={t}>{t}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.keys(statusFilters).map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card span-12">
        <div className="card-head">
          <div>
            <p className="eyebrow">Agent credit market</p>
            <span className="meta">
              {isLoading
                ? "Loading live agents from the indexer…"
                : `${indexedCount} agents indexed, ${MOCK_AGENTS.length} demo · ${activeLines} open lines · scores refresh every oracle epoch (~6 min)`}
            </span>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Agent</th><th>Score</th><th className="num">Revenue 30d</th><th>Trend</th>
                <th className="num">Limit</th><th className="num">Drawn</th><th className="num">APR</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.address}>
                  <td>
                    <span className="agent-cell">
                      <span className="agent-dot" style={{ background: hueFor(a.address) }}>
                        {a.address.slice(2, 4).toUpperCase()}
                      </span>
                      <span>
                        <strong className="mono">{shortAddress(a.address)}</strong>
                        <br />
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          {a.mock ? "demo · not onchain" : a.id ? `ERC-8004 ${a.id}` : "unregistered"}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td><span className="score-chip mono">{a.score}</span><span className="score-grade">{a.grade}</span></td>
                  <td className="num mono">{a.revenue}</td>
                  <td><Sparkline pts={a.revenueSeries} /></td>
                  <td className="num mono">{a.limit}</td>
                  <td className="num mono">{a.drawn}</td>
                  <td className="num mono">{a.status === "None" ? "—" : a.apr}</td>
                  <td><Pill state={pillState(a.health)}>{a.health === "None" ? "No line" : a.health}</Pill></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--ink-3)", padding: 24 }}>
                    {isLoading
                      ? "Loading…"
                      : isError
                        ? `Could not reach the API: ${(error as Error).message}`
                        : indexedCount === 0
                          ? "No agents indexed yet. Run some job traffic to populate the market."
                          : "No agents match the current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
