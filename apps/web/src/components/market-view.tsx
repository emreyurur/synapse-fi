"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type AgentSummary } from "@/lib/api";
import { Sparkline } from "./charts";
import { Pill, type PillState } from "./pill";

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

  const agents: AgentSummary[] = useMemo(() => data?.agents ?? [], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter(
      (a) =>
        (!q || a.address.toLowerCase().includes(q) || (a.id ?? "").toLowerCase().includes(q)) &&
        tierFilters[tier](a.score) &&
        statusFilters[status](a.health),
    );
  }, [agents, query, tier, status]);

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
                : `${agents.length} agents indexed · ${activeLines} open lines · scores refresh every oracle epoch (~6 min)`}
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
                          {a.id ? `ERC-8004 ${a.id}` : "unregistered"}
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
                        : agents.length === 0
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
