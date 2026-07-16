import { routedPayments, scoreFactors } from "@/lib/mock-data";
import { RevenueChart } from "./charts";
import { Pill } from "./pill";

export function BorrowView() {
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
        <div className="avatar" aria-hidden="true">S7</div>
        <div>
          <h1>scout-7b.arc</h1>
          <div className="sub mono">ERC-8004 #4127 · operator 0x8F3d…a2C4 · reputation synced 2 min ago</div>
        </div>
        <div className="id-badges">
          <span className="badge tier">Prime tier</span>
          <span className="badge">419 jobs completed</span>
          <span className="badge">Active since Mar 2026</span>
        </div>
      </div>

      <div className="grid12">
        {/* Credit score */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <p className="eyebrow">Credit score</p>
              <span className="meta">ScoreOracle · epoch 1,204</span>
            </div>
            <Pill state="ok">Grade A</Pill>
          </div>
          <div className="gauge-wrap">
            <div className="gauge">
              <svg viewBox="0 0 132 132" aria-label="Credit score 782 of 1000">
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--hairline-soft)" strokeWidth="9"
                  strokeDasharray="264 88" strokeDashoffset="-44" strokeLinecap="round" transform="rotate(90 66 66)" />
                <circle cx="66" cy="66" r="56" fill="none" stroke="var(--series-1)" strokeWidth="9"
                  strokeDasharray="206.4 145.6" strokeDashoffset="-44" strokeLinecap="round" transform="rotate(90 66 66)" />
              </svg>
              <div className="val">
                <div>
                  <div className="n mono">782</div>
                  <div className="d">of 1,000</div>
                </div>
              </div>
            </div>
            <div className="factors">
              {scoreFactors.map((f) => (
                <div className="factor" key={f.label}>
                  <span className="fl">{f.label}</span>
                  <span className="fv mono">{f.value}%</span>
                  <span className="bar"><i style={{ width: `${f.value}%` }} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Credit line */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <p className="eyebrow">Credit line</p>
              <span className="meta">CreditLine #0291</span>
            </div>
            <Pill state="ok">Healthy</Pill>
          </div>
          <div className="big-num mono">7,800 <span className="big-unit">/ 12,500 USDC</span></div>
          <div className="legend-inline">
            <span><span className="sw" style={{ background: "var(--accent)" }} />Drawn 62.4%</span>
            <span><span className="sw" style={{ background: "var(--hairline)" }} />Available 4,700</span>
          </div>
          <div className="util-bar" role="img" aria-label="7,800 of 12,500 USDC drawn (62.4%)">
            <span className="drawn" style={{ width: "62.4%" }} />
            <span className="avail" />
          </div>
          <div className="kv-row"><span className="k">Borrow APR</span><span className="mono">9.2%</span></div>
          <div className="kv-row"><span className="k">Revenue share routed</span><span className="mono">12% of inflows</span></div>
          <div className="kv-row"><span className="k">Outstanding debt</span><span className="mono">5,214.18 USDC</span></div>
          <div className="kv-row"><span className="k">Est. payoff</span><span className="mono">~34 days at current inflow</span></div>
          <div className="actions">
            <button className="btn-primary" type="button">Draw funds</button>
            <button className="btn-ghost" type="button">Request limit increase</button>
          </div>
        </div>

        {/* Revenue */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <p className="eyebrow">Revenue · last 30 days</p>
              <span className="meta">Nanopayment inflows, USDC</span>
            </div>
          </div>
          <div className="big-num mono">9,847 <span className="big-unit">USDC</span></div>
          <div className="delta-up">▲ 12.4% vs prior 30 days</div>
          <RevenueChart />
          <div className="kv-row" style={{ marginTop: 8 }}><span className="k">Payments received</span><span className="mono">2,341</span></div>
          <div className="kv-row"><span className="k">Avg. job value</span><span className="mono">4.21 USDC</span></div>
        </div>

        {/* Repayment routing */}
        <div className="card span-12">
          <div className="card-head">
            <div>
              <p className="eyebrow">Repayment routing</p>
              <span className="meta">Every inflow passes through RevenueRouter until the line is repaid</span>
            </div>
            <span className="chip mono" style={{ padding: "4px 9px" }}>RevenueRouter 0x51c2…9dA1</span>
          </div>

          <div className="flow">
            <div className="flow-node">
              <div className="fn-t">Incoming revenue</div>
              <div className="fn-s">ERC-8183 job payouts &amp; nanopayments</div>
              <div className="fn-s mono" style={{ marginTop: 6 }}>≈ 328 USDC / day</div>
            </div>
            <div className="flow-arrow" aria-hidden="true">→</div>
            <div className="flow-node hl">
              <div className="fn-t">RevenueRouter</div>
              <div className="fn-s">Onchain split, no custodian</div>
              <div className="fn-s mono" style={{ marginTop: 6 }}>split 12 / 88</div>
            </div>
            <div className="flow-arrow" aria-hidden="true">→</div>
            <div className="flow-split">
              <div className="flow-node">
                <div className="fn-t"><span className="fn-pct to-pool">12%</span> → Credit Pool</div>
                <div className="fn-s">Principal + interest amortization</div>
              </div>
              <div className="flow-node">
                <div className="fn-t"><span className="fn-pct">88%</span> → Agent treasury</div>
                <div className="fn-s">Free cash flow, spendable instantly</div>
              </div>
            </div>
          </div>

          <div className="progress-wrap">
            <div className="progress" role="img" aria-label="7,286 of 12,500 USDC repaid (58.3%)"><i style={{ width: "58.3%" }} /></div>
            <div className="progress-meta">
              <span>Repaid <strong className="mono">7,286 USDC</strong> of 12,500 · 58.3%</span>
              <span>Next epoch settlement in <span className="mono">02:41:18</span></span>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th><th>Job / payment</th><th>Counterparty</th>
                  <th className="num">Amount</th><th className="num">→ Pool (12%)</th><th className="num">→ Treasury (88%)</th><th>Status</th>
                </tr>
              </thead>
              <tbody className="mono">
                {routedPayments.map((p) => (
                  <tr key={p.time}>
                    <td>{p.time}</td>
                    <td>{p.job}</td>
                    <td>{p.counterparty}</td>
                    <td className="num">{p.amount}</td>
                    <td className="num">{p.toPool}</td>
                    <td className="num">{p.toTreasury}</td>
                    <td><Pill state={p.st}>{p.stl}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
