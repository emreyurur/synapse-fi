"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useReadContract } from "wagmi";
import { api } from "@/lib/api";
import { creditPool, formatUsdc, groupMoney, parseUsdc, toUsdcInput, usdc } from "@/lib/contracts";
import { useAmountInput } from "@/lib/use-amount-input";
import { txErrorMessage, useTx } from "@/lib/use-tx";
import { RateChart } from "./charts";

type Mode = "deposit" | "withdraw";

export function EarnView() {
  const { address, isConnected } = useConnection();
  const [mode, setMode] = useState<Mode>("deposit");
  const amount = useAmountInput();
  const tx = useTx();

  const { data: stats } = useQuery({
    queryKey: ["pool-stats"],
    queryFn: api.poolStats,
    refetchInterval: 15_000,
  });

  const enabled = Boolean(address);
  const { data: shares } = useReadContract({
    ...creditPool,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const { data: position } = useReadContract({
    ...creditPool,
    functionName: "convertToAssets",
    args: shares !== undefined ? [shares] : undefined,
    query: { enabled: shares !== undefined },
  });
  const { data: withdrawable } = useReadContract({
    ...creditPool,
    functionName: "maxWithdraw",
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
    args: address && creditPool.address ? [address, creditPool.address] : undefined,
    query: { enabled: enabled && Boolean(creditPool.address) },
  });

  const parsed = parseUsdc(amount.value);
  const needsApproval = mode === "deposit" && parsed !== null && (allowance ?? 0n) < parsed;
  const max = mode === "deposit" ? walletBalance : withdrawable;
  // `max` is undefined until the chain read resolves (or when a flaky RPC drops
  // it). Treating unknown as "anything goes" let users submit withdrawals with
  // zero balance — a guaranteed on-chain revert that just burns their gas.
  const overMax = parsed !== null && max !== undefined && parsed > max;
  const maxUnknown = max === undefined;

  const disabled = !isConnected || parsed === null || maxUnknown || overMax || tx.isBusy;

  const submit = async () => {
    if (!address || parsed === null) return;
    if (mode === "deposit") {
      if (needsApproval) {
        await tx.send({ ...usdc, functionName: "approve", args: [creditPool.address, parsed] });
        return; // allowance refetches on confirm; the button becomes "Deposit"
      }
      await tx.send({ ...creditPool, functionName: "deposit", args: [parsed, address] });
    } else {
      await tx.send({ ...creditPool, functionName: "withdraw", args: [parsed, address, address] });
    }
    amount.set("");
  };

  const buttonLabel = tx.isBusy
    ? tx.status === "signing"
      ? "Confirm in wallet…"
      : "Pending…"
    : !isConnected
      ? "Connect wallet"
      : mode === "deposit"
        ? needsApproval
          ? "Approve USDC"
          : "Deposit USDC"
        : "Withdraw";

  const earned =
    position !== undefined && shares !== undefined && position > 0n ? position : undefined;

  return (
    <section>
      <div className="tiles">
        <div className="tile">
          <p className="eyebrow">Total value locked</p>
          <div className="t-v mono">${groupMoney(stats?.tvl)}</div>
          <div className="t-s">USDC · source: {stats?.source ?? "loading"}</div>
        </div>
        <div className="tile">
          <p className="eyebrow">Utilization</p>
          <div className="t-v mono">{(stats?.utilization ?? 0).toFixed(1)}%</div>
          <div className="t-s">
            ${groupMoney(stats?.totalLent)} drawn across {stats?.activeLines ?? 0} lines
          </div>
        </div>
        <div className="tile">
          <p className="eyebrow">Supply APY</p>
          <div className="t-v mono">{(stats?.supplyApy ?? 0).toFixed(2)}%</div>
          <div className="t-s">Net of {stats?.reserveFactor ?? 10}% reserve factor</div>
        </div>
        <div className="tile">
          <p className="eyebrow">Default rate</p>
          <div className="t-v mono">{(stats?.defaultRate ?? 0).toFixed(2)}%</div>
          <div className="t-s">{stats?.defaults ?? 0} defaulted lines</div>
        </div>
      </div>

      <div className="grid12">
        <div className="card span-7">
          <div className="card-head">
            <div>
              <p className="eyebrow">Interest rate model</p>
              <span className="meta">Borrow APR by pool utilization · kink at 80%</span>
            </div>
          </div>
          <RateChart utilization={(stats?.utilization ?? 0) / 100} />
        </div>

        <div className="card span-5">
          <div className="card-head">
            <div>
              <p className="eyebrow">My position</p>
              <span className="meta">spUSDC · ERC-4626 vault shares</span>
            </div>
          </div>

          {isConnected ? (
            <>
              <div className="big-num mono">
                {formatUsdc(earned)} <span className="big-unit">USDC</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="kv-row"><span className="k">spUSDC shares</span><span className="mono">{shares !== undefined ? shares.toString() : "0"}</span></div>
                <div className="kv-row"><span className="k">Withdrawable now</span><span className="mono">{formatUsdc(withdrawable)}</span></div>
                <div className="kv-row"><span className="k">Wallet USDC</span><span className="mono">{formatUsdc(walletBalance)}</span></div>
              </div>

              <div className="actions" style={{ gap: 8 }}>
                <button
                  className={mode === "deposit" ? "btn-primary" : "btn-ghost"}
                  type="button"
                  onClick={() => { setMode("deposit"); tx.reset(); }}
                >
                  Deposit
                </button>
                <button
                  className={mode === "withdraw" ? "btn-primary" : "btn-ghost"}
                  type="button"
                  onClick={() => { setMode("withdraw"); tx.reset(); }}
                >
                  Withdraw
                </button>
              </div>

              <div className="amount-field" style={{ marginTop: 14 }}>
                <label className="al" htmlFor="earn-amount">
                  <span>Amount to {mode}</span>
                  <span className="avail">
                    {mode === "deposit" ? "Wallet" : "Withdrawable"} {formatUsdc(max)}
                  </span>
                </label>
                <div className="amount-row">
                  <div className="amount-input">
                    <input
                      id="earn-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...amount.inputProps}
                    />
                    <span className="unit">USDC</span>
                    <button
                      className="max-btn"
                      type="button"
                      onClick={() => max !== undefined && amount.set(toUsdcInput(max))}
                    >
                      MAX
                    </button>
                  </div>
                  <button className="btn-primary" type="button" disabled={disabled} onClick={submit}>
                    {buttonLabel}
                  </button>
                </div>
                {amount.value && parsed === null && <p className="field-error">Enter a valid amount (e.g. 500 or 500.25).</p>}
                {overMax && (
                  <p className="field-error">
                    Exceeds your {mode === "deposit" ? "wallet balance" : "withdrawable balance"} of {formatUsdc(max)} USDC.
                  </p>
                )}
                {mode === "withdraw" && withdrawable === 0n && (
                  <p className="field-error">Nothing to withdraw — you have no pool position yet. Deposit first.</p>
                )}
              </div>

              {tx.status === "error" && (
                <p className="meta" style={{ color: "var(--crit)", marginTop: 8 }}>{txErrorMessage(tx.error)}</p>
              )}
              {tx.status === "success" && (
                <p className="meta" style={{ color: "var(--good-text)", marginTop: 8 }}>Confirmed on-chain.</p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "18px 0" }}>
              Connect a wallet to supply USDC and view your position.
            </p>
          )}

          <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "14px 0 0" }}>
            Deposits are lent against scored onchain revenue, not token collateral.
            Risk is priced per agent by the ScoreOracle; defaults burn the agent&apos;s
            ERC-8004 reputation and trigger revenue-claim recovery.
          </p>
        </div>
      </div>
    </section>
  );
}
