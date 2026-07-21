"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection, useReadContract } from "wagmi";
import { api } from "@/lib/api";
import { creditLineManager, formatUsdc, parseUsdc, toUsdcInput, usdc } from "@/lib/contracts";
import { useAmountInput } from "@/lib/use-amount-input";
import { txErrorMessage, useTx } from "@/lib/use-tx";
import { RevenueChart } from "./charts";
import { Pill, type PillState } from "./pill";

// Gauge geometry: a 270° dial (90° gap at the bottom). Track length is 264 of
// a 352 total (matches the circle's circumference at r=56).
const GAUGE_TRACK_LEN = 264;
const GAUGE_TOTAL_LEN = 352;

/** CreditLineManager.lines() tuple. */
type LineTuple = readonly [bigint, bigint, bigint, bigint, number, number, `0x${string}`, `0x${string}`];

const LINE_STATUS = ["None", "Active", "Delinquent", "Closed"] as const;
const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Date labels for a trailing daily series (oldest first, today last). */
function dayLabels(length: number): string[] {
  return Array.from({ length }, (_, i) => {
    const d = new Date(Date.now() - (length - 1 - i) * 86_400_000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

export function BorrowView() {
  const { address, isConnected } = useConnection();
  const draw = useAmountInput();
  const repay = useAmountInput();
  const tx = useTx();

  const enabled = Boolean(address);

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["agent", address],
    queryFn: () => api.getAgent(address!),
    enabled,
    refetchInterval: 15_000,
  });

  // Chain reads are the source of truth for the line; the API supplies the
  // score breakdown and payment history the contracts don't store.
  const { data: line } = useReadContract({
    ...creditLineManager,
    functionName: "lines",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const { data: limit } = useReadContract({
    ...creditLineManager,
    functionName: "creditLimit",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const { data: debt } = useReadContract({
    ...creditLineManager,
    functionName: "totalDebt",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const { data: aprBps } = useReadContract({
    ...creditLineManager,
    functionName: "currentAprBps",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const { data: walletBalance } = useReadContract({
    ...usdc,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const { data: allowance } = useReadContract({
    ...usdc,
    functionName: "allowance",
    args: address && creditLineManager.address ? [address, creditLineManager.address] : undefined,
    query: { enabled: enabled && Boolean(creditLineManager.address) },
  });

  // MVP onboarding: a wallet with no oracle score yet reads a $0 limit and
  // can't open a line. Ask the backend for a deterministic mock score — it's
  // a real on-chain ScoreOracle write via the same authorized updater the
  // epoch worker uses, so it actually unlocks `openLine`/`draw`, not just the
  // display. No-op once the wallet has any live score.
  const queryClient = useQueryClient();
  const onboardedRef = useRef<string | null>(null);
  const onboard = useMutation({
    mutationFn: (addr: string) => api.onboardAgent(addr),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  useEffect(() => {
    if (!address || limit === undefined || limit > 0n) return;
    if (onboardedRef.current === address) return;
    onboardedRef.current = address;
    onboard.mutate(address);
  }, [address, limit, onboard]);

  if (!isConnected) {
    return (
      <section>
        <div className="card span-12" style={{ textAlign: "center", padding: 48 }}>
          <p className="eyebrow">Borrow</p>
          <h1 style={{ fontSize: 20, margin: "8px 0" }}>Connect your agent wallet</h1>
          <p style={{ color: "var(--ink-3)", fontSize: 13 }}>
            Your credit line, score, and revenue routing are read from the chain for the connected address.
          </p>
        </div>
      </section>
    );
  }

  const t = line as LineTuple | undefined;
  const status = t ? LINE_STATUS[t[5]] ?? "None" : "None";
  const hasLine = status === "Active" || status === "Delinquent";
  const principal = t?.[0] ?? 0n;
  const interest = t?.[1] ?? 0n;
  const splitter = t?.[7];
  const totalDebt = debt ?? 0n;
  const creditLimit = limit ?? 0n;

  const score = agent?.score ?? 0;
  const gaugeValueLen = (score / 100) * GAUGE_TRACK_LEN;
  const gaugeRemainderLen = GAUGE_TOTAL_LEN - gaugeValueLen;

  const utilPct =
    creditLimit > 0n ? Math.min(100, (Number(totalDebt) / Number(creditLimit)) * 100) : 0;
  const available = creditLimit > totalDebt ? creditLimit - totalDebt : 0n;

  const healthState: PillState =
    status === "Delinquent" ? "crit" : utilPct >= 100 ? "warn" : "ok";
  const healthLabel =
    status === "Delinquent" ? "Delinquent" : !hasLine ? "No line" : utilPct >= 100 ? "At limit" : "Healthy";

  const series = agent?.revenue.series.map((p) => p.amount) ?? [];
  const labels = dayLabels(series.length);

  const parsedDraw = parseUsdc(draw.value);
  const parsedRepay = parseUsdc(repay.value);
  const needsRepayApproval = parsedRepay !== null && (allowance ?? 0n) < parsedRepay;

  const factors = agent?.factors;
  const factorRows = factors
    ? [
        { label: "Job completion", value: factors.jobCompletion },
        { label: "Revenue continuity", value: factors.revenueContinuity },
        { label: "Dispute-free rate", value: factors.disputeFree },
        { label: "Revenue stability", value: factors.revenueStability },
      ]
    : [];

  const drawOverAvailable = parsedDraw !== null && parsedDraw > available;
  const repayOverBalance = parsedRepay !== null && walletBalance !== undefined && parsedRepay > walletBalance;

  const onOpenLine = () => tx.send({ ...creditLineManager, functionName: "openLine", args: [address] });
  const onDraw = async () => {
    if (parsedDraw === null || drawOverAvailable) return;
    await tx.send({ ...creditLineManager, functionName: "draw", args: [parsedDraw] });
    draw.set("");
  };
  const onRepay = async () => {
    if (parsedRepay === null || !address) return;
    if (needsRepayApproval) {
      await tx.send({ ...usdc, functionName: "approve", args: [creditLineManager.address, parsedRepay] });
      return; // allowance refetches on confirm; the button becomes "Repay"
    }
    await tx.send({ ...creditLineManager, functionName: "repay", args: [address, parsedRepay] });
    repay.set("");
  };

  const busyLabel = tx.status === "signing" ? "Confirm in wallet…" : "Pending…";
  const repaidTotal = (agent?.repayments ?? []).reduce(
    (sum, r) => sum + Number(r.principal.replace(/,/g, "")),
    0,
  );

  return (
    <section>
      <div className="identity">
        <svg className="synapse-bg" width="340" height="90" viewBox="0 0 340 90" aria-hidden="true">
          <path d="M20 70 L90 30 L170 55 L250 22 L320 48" stroke="var(--hairline)" strokeWidth="1.2" fill="none" />
          <circle className="p" cx="20" cy="70" r="3" fill="var(--accent)" />
          <circle className="p" cx="90" cy="30" r="3" fill="var(--accent)" />
          <circle className="p" cx="170" cy="55" r="3" fill="var(--series-2)" />
          <circle className="p" cx="250" cy="22" r="3" fill="var(--accent)" />
          <circle className="p" cx="320" cy="48" r="3" fill="var(--series-2)" />
        </svg>
        <div className="avatar" aria-hidden="true">{address!.slice(2, 4).toUpperCase()}</div>
        <div>
          <h1 className="mono">{shortAddress(address!)}</h1>
          <div className="sub mono">
            {agent?.id ? `ERC-8004 ${agent.id}` : "not registered"}
            {agent?.reputation != null && ` · reputation ${agent.reputation}`}
            {agent?.scoreUpdatedAt
              ? ` · score updated ${new Date(agent.scoreUpdatedAt * 1000).toLocaleTimeString()}`
              : " · awaiting first oracle epoch"}
          </div>
        </div>
        <div className="id-badges">
          {agent && <span className="badge tier">Grade {agent.grade}</span>}
          {agent && <span className="badge">{agent.jobs.completed} jobs completed</span>}
          {agent && <span className="badge">{agent.jobs.disputed} disputed</span>}
        </div>
      </div>

      {!agent && !agentLoading && (
        <div className="card span-12" style={{ marginBottom: 14 }}>
          {onboard.isPending ? (
            <>
              <p className="eyebrow">Setting up your demo score</p>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "6px 0 0" }}>
                Writing a starter credit score on-chain for this wallet so it can open a real line —
                confirming the transaction…
              </p>
            </>
          ) : onboard.isError ? (
            <>
              <p className="eyebrow" style={{ color: "var(--crit)" }}>Couldn&apos;t fetch a demo score</p>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "6px 0 0" }}>
                {txErrorMessage(onboard.error as Error) ?? "The onboarding oracle is unreachable."} Complete
                ERC-8183 jobs to build a real score, or retry.
              </p>
              <button
                className="btn-ghost"
                type="button"
                style={{ marginTop: 10 }}
                onClick={() => address && onboard.mutate(address)}
              >
                Retry
              </button>
            </>
          ) : onboard.isSuccess ? (
            <>
              <p className="eyebrow">Demo score confirmed on-chain</p>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "6px 0 0" }}>
                Syncing the indexer — this card clears in a few seconds once the score lands above.
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">No indexed activity</p>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "6px 0 0" }}>
                This address has no jobs or payments on the JobBoard yet. Complete ERC-8183 jobs to build
                a real score, or wait a moment for a demo score.
              </p>
            </>
          )}
        </div>
      )}

      <div className="grid12">
        {/* Credit score */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <p className="eyebrow">Credit score</p>
              <span className="meta">ScoreOracle · epoch {agent?.epoch ?? "—"}</span>
            </div>
            {agent && <Pill state={score >= 60 ? "ok" : score >= 50 ? "warn" : "crit"}>Grade {agent.grade}</Pill>}
          </div>
          <div className="gauge-wrap">
            <div className="gauge">
              <svg viewBox="0 0 132 132" aria-label={`Credit score ${score} of 100`}>
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--hairline-soft)" strokeWidth="9"
                  strokeDasharray={`${GAUGE_TRACK_LEN} ${GAUGE_TOTAL_LEN - GAUGE_TRACK_LEN}`} strokeDashoffset="-44" strokeLinecap="round" transform="rotate(90 66 66)" />
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--series-1)" strokeWidth="9"
                  strokeDasharray={`${gaugeValueLen.toFixed(1)} ${gaugeRemainderLen.toFixed(1)}`} strokeDashoffset="-44" strokeLinecap="round" transform="rotate(90 66 66)" />
              </svg>
              <div className="val">
                <div>
                  <div className="n mono">{agent ? score : "—"}</div>
                  <div className="d">of 100</div>
                </div>
              </div>
            </div>
            <div className="factors">
              {factorRows.map((f) => (
                <div className="factor" key={f.label}>
                  <span className="fl">{f.label}</span>
                  <span className="fv mono">{f.value.toFixed(1)}%</span>
                  <span className="bar"><i style={{ width: `${f.value}%` }} /></span>
                </div>
              ))}
            </div>
          </div>
          {agent?.consistent === false && (
            <p className="meta" style={{ marginTop: 8, color: "var(--ink-3)" }}>
              Syncing — on-chain still shows {agent.onchainScore} for now; the next oracle epoch
              updates it to match the score above.
            </p>
          )}
        </div>

        {/* Credit line */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <p className="eyebrow">Credit line</p>
              <span className="meta">CreditLineManager</span>
            </div>
            <Pill state={healthState}>{healthLabel}</Pill>
          </div>

          {hasLine ? (
            <>
              <div className="big-num mono">
                {formatUsdc(totalDebt)} <span className="big-unit">/ {formatUsdc(creditLimit)} USDC</span>
              </div>
              <div className="legend-inline">
                <span><span className="sw" style={{ background: "var(--accent)" }} />Drawn {utilPct.toFixed(1)}%</span>
                <span><span className="sw" style={{ background: "var(--hairline)" }} />Available {formatUsdc(available)}</span>
              </div>
              <div className="util-bar" role="img" aria-label={`${formatUsdc(totalDebt)} of ${formatUsdc(creditLimit)} USDC drawn`}>
                <span className="drawn" style={{ width: `${utilPct}%` }} />
                <span className="avail" />
              </div>
              <div className="kv-row"><span className="k">Borrow APR</span><span className="mono">{aprBps !== undefined ? `${(Number(aprBps) / 100).toFixed(2)}%` : "—"}</span></div>
              <div className="kv-row"><span className="k">Principal</span><span className="mono">{formatUsdc(principal)}</span></div>
              <div className="kv-row"><span className="k">Interest accrued</span><span className="mono">{formatUsdc(interest)}</span></div>
              <div className="kv-row"><span className="k">Wallet USDC</span><span className="mono">{formatUsdc(walletBalance)}</span></div>

              <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                <div className="amount-field">
                  <label className="al" htmlFor="draw-amount">
                    <span>Amount to draw</span>
                    <span className="avail">Available {formatUsdc(available)}</span>
                  </label>
                  <div className="amount-row">
                    <div className="amount-input">
                      <input
                        id="draw-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        {...draw.inputProps}
                      />
                      <span className="unit">USDC</span>
                      <button className="max-btn" type="button" onClick={() => draw.set(toUsdcInput(available))}>
                        MAX
                      </button>
                    </div>
                    <button className="btn-primary" type="button" onClick={onDraw} disabled={parsedDraw === null || drawOverAvailable || tx.isBusy}>
                      {tx.isBusy ? busyLabel : "Draw"}
                    </button>
                  </div>
                  {draw.value && parsedDraw === null && (
                    <p className="field-error">Enter a valid amount (e.g. 500 or 500.25).</p>
                  )}
                  {drawOverAvailable && (
                    <p className="field-error">Exceeds your available limit of {formatUsdc(available)} USDC.</p>
                  )}
                </div>

                <div className="amount-field">
                  <label className="al" htmlFor="repay-amount">
                    <span>Amount to repay</span>
                    <span className="avail">Debt {formatUsdc(totalDebt)}</span>
                  </label>
                  <div className="amount-row">
                    <div className="amount-input">
                      <input
                        id="repay-amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        {...repay.inputProps}
                      />
                      <span className="unit">USDC</span>
                      <button
                        className="max-btn"
                        type="button"
                        onClick={() => {
                          // Cap at the wallet balance — repaying more than you hold reverts.
                          const most = walletBalance !== undefined && walletBalance < totalDebt ? walletBalance : totalDebt;
                          repay.set(toUsdcInput(most));
                        }}
                      >
                        MAX
                      </button>
                    </div>
                    <button className="btn-ghost" type="button" onClick={onRepay} disabled={parsedRepay === null || repayOverBalance || tx.isBusy}>
                      {tx.isBusy ? busyLabel : needsRepayApproval ? "Approve" : "Repay"}
                    </button>
                  </div>
                  {repay.value && parsedRepay === null && (
                    <p className="field-error">Enter a valid amount (e.g. 500 or 500.25).</p>
                  )}
                  {repayOverBalance && (
                    <p className="field-error">Exceeds your wallet balance of {formatUsdc(walletBalance)} USDC.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="big-num mono">{formatUsdc(creditLimit)} <span className="big-unit">USDC eligible</span></div>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "10px 0" }}>
                {creditLimit > 0n
                  ? "Your score qualifies for a line. Opening one deploys a RevenueRouter that splits your inflows between repayment and your treasury."
                  : "A fresh oracle score of 50 or higher is required to open a credit line. Keep completing jobs to raise it."}
              </p>
              <div className="actions">
                <button className="btn-primary" type="button" onClick={onOpenLine} disabled={creditLimit === 0n || tx.isBusy}>
                  {tx.isBusy ? busyLabel : "Apply for a line"}
                </button>
              </div>
            </>
          )}

          {tx.status === "error" && (
            <p className="meta" style={{ color: "var(--crit)", marginTop: 8 }}>{txErrorMessage(tx.error)}</p>
          )}
          {tx.status === "success" && (
            <p className="meta" style={{ color: "var(--good-text)", marginTop: 8 }}>Confirmed on-chain.</p>
          )}
        </div>

        {/* Revenue */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <p className="eyebrow">Revenue · last 30 days</p>
              <span className="meta">Job payouts &amp; nanopayments, USDC</span>
            </div>
          </div>
          <div className="big-num mono">{agent?.revenue.gross ?? "—"} <span className="big-unit">USDC</span></div>
          <RevenueChart data={series} days={labels} />
          <div className="kv-row" style={{ marginTop: 8 }}><span className="k">Payments received</span><span className="mono">{agent?.payments.length ?? 0}</span></div>
          <div className="kv-row"><span className="k">Jobs completed</span><span className="mono">{agent?.jobs.completed ?? 0} / {agent?.jobs.posted ?? 0}</span></div>
        </div>

        {/* Repayment routing */}
        <div className="card span-12">
          <div className="card-head">
            <div>
              <p className="eyebrow">Repayment routing</p>
              <span className="meta">Every inflow passes through RevenueRouter until the line is repaid</span>
            </div>
            {splitter && splitter !== "0x0000000000000000000000000000000000000000" && (
              <span className="chip mono" style={{ padding: "4px 9px" }}>RevenueRouter {shortAddress(splitter)}</span>
            )}
          </div>

          <div className="flow">
            <div className="flow-node">
              <div className="fn-t">Incoming revenue</div>
              <div className="fn-s">ERC-8183 job payouts &amp; nanopayments</div>
              <div className="fn-s mono" style={{ marginTop: 6 }}>{agent?.revenue.gross ?? "0.00"} USDC / 30d</div>
            </div>
            <div className="flow-arrow" aria-hidden="true">→</div>
            <div className="flow-node hl">
              <div className="fn-t">RevenueRouter</div>
              <div className="fn-s">Onchain split, no custodian</div>
              <div className="fn-s mono" style={{ marginTop: 6 }}>
                split {totalDebt > 0n ? (status === "Delinquent" ? "100 / 0" : "12 / 88") : "0 / 100"}
              </div>
            </div>
            <div className="flow-arrow" aria-hidden="true">→</div>
            <div className="flow-split">
              <div className="flow-node">
                <div className="fn-t">
                  <span className="fn-pct to-pool">{totalDebt > 0n ? (status === "Delinquent" ? "100%" : "12%") : "0%"}</span> → Credit Pool
                </div>
                <div className="fn-s">Principal + interest amortization</div>
              </div>
              <div className="flow-node">
                <div className="fn-t">
                  <span className="fn-pct">{totalDebt > 0n ? (status === "Delinquent" ? "0%" : "88%") : "100%"}</span> → Agent treasury
                </div>
                <div className="fn-s">Free cash flow, spendable instantly</div>
              </div>
            </div>
          </div>

          {hasLine && (
            <div className="progress-wrap">
              <div className="progress" role="img" aria-label={`${formatUsdc(totalDebt)} USDC outstanding of ${formatUsdc(creditLimit)} limit`}>
                <i style={{ width: `${utilPct}%` }} />
              </div>
              <div className="progress-meta">
                <span>Outstanding <strong className="mono">{formatUsdc(totalDebt)} USDC</strong> of {formatUsdc(creditLimit)} limit</span>
                <span>Repaid to date <span className="mono">{repaidTotal.toFixed(2)} USDC</span></span>
              </div>
            </div>
          )}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th><th>Kind</th><th>Job</th><th>Payer</th>
                  <th className="num">Amount</th><th>Tx</th>
                </tr>
              </thead>
              <tbody className="mono">
                {(agent?.payments ?? []).slice(0, 12).map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.timestamp * 1000).toLocaleTimeString()}</td>
                    <td>{p.kind === "job" ? "Job payout" : "Nanopayment"}</td>
                    <td>{p.jobId != null ? `#${p.jobId}` : "stream"}</td>
                    <td>{p.payer ? shortAddress(p.payer) : "—"}</td>
                    <td className="num">{p.amount}</td>
                    <td>{shortAddress(p.txHash)}</td>
                  </tr>
                ))}
                {(agent?.payments.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--ink-3)", padding: 24 }}>
                      No revenue inflows indexed for this address yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
