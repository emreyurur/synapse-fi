"use client";

import { useMemo, useState } from "react";
import { agents } from "@/lib/mock-data";
import { Sparkline } from "./charts";
import { Pill } from "./pill";

const tierFilters: Record<string, (score: number) => boolean> = {
  "All tiers": () => true,
  "Prime (A)": (s) => s >= 750,
  "Standard (B)": (s) => s >= 600 && s < 750,
  "Watch (C+)": (s) => s < 600,
};

const statusFilters: Record<string, (stl: string) => boolean> = {
  "All statuses": () => true,
  Active: (s) => s === "Active",
  Repaying: (s) => s === "Repaying",
  Delinquent: (s) => s === "Delinquent",
};

export function MarketView() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("All tiers");
  const [status, setStatus] = useState("All statuses");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter(
      (a) =>
        (!q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)) &&
        tierFilters[tier](a.score) &&
        statusFilters[status](a.stl),
    );
  }, [query, tier, status]);

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
            <span className="meta">187 open lines · scores refresh every oracle epoch (~6 min)</span>
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
                <tr key={a.id}>
                  <td>
                    <span className="agent-cell">
                      <span className="agent-dot" style={{ background: a.hue }}>{a.name.slice(0, 2).toUpperCase()}</span>
                      <span>
                        <strong>{a.name}</strong>
                        <br />
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>ERC-8004 {a.id}</span>
                      </span>
                    </span>
                  </td>
                  <td><span className="score-chip mono">{a.score}</span><span className="score-grade">{a.grade}</span></td>
                  <td className="num mono">{a.rev}</td>
                  <td><Sparkline pts={a.spark} /></td>
                  <td className="num mono">{a.limit}</td>
                  <td className="num mono">{a.drawn}</td>
                  <td className="num mono">{a.apr}</td>
                  <td><Pill state={a.st}>{a.stl}</Pill></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--ink-3)", padding: 24 }}>
                    No agents match the current filters.
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
