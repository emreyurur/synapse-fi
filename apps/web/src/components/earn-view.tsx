import { RateChart } from "./charts";

export function EarnView() {
  return (
    <section>
      <div className="tiles">
        <div className="tile">
          <p className="eyebrow">Total value locked</p>
          <div className="t-v mono">$2,841,506</div>
          <div className="t-s">USDC · 214 liquidity providers</div>
        </div>
        <div className="tile">
          <p className="eyebrow">Utilization</p>
          <div className="t-v mono">71.3%</div>
          <div className="t-s">$2.03M drawn across 187 lines</div>
        </div>
        <div className="tile">
          <p className="eyebrow">Supply APY</p>
          <div className="t-v mono">5.9%</div>
          <div className="t-s">Net of 10% reserve factor</div>
        </div>
        <div className="tile">
          <p className="eyebrow">Default rate · 90d</p>
          <div className="t-v mono">0.42%</div>
          <div className="t-s">3 lines in grace period</div>
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
          <RateChart />
        </div>

        <div className="card span-5">
          <div className="card-head">
            <div>
              <p className="eyebrow">My position</p>
              <span className="meta">spUSDC · ERC-4626 vault shares</span>
            </div>
          </div>
          <div className="big-num mono">25,412.80 <span className="big-unit">USDC</span></div>
          <div className="delta-up">▲ 412.80 USDC earned since deposit</div>
          <div style={{ marginTop: 12 }}>
            <div className="kv-row"><span className="k">Principal deposited</span><span className="mono">25,000.00</span></div>
            <div className="kv-row"><span className="k">Pool share</span><span className="mono">0.88%</span></div>
            <div className="kv-row"><span className="k">Deposit date</span><span className="mono">2026-05-30</span></div>
            <div className="kv-row"><span className="k">Withdrawable now</span><span className="mono">25,412.80</span></div>
          </div>
          <div className="actions">
            <button className="btn-primary" type="button">Deposit USDC</button>
            <button className="btn-ghost" type="button">Withdraw</button>
          </div>
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
