"use client";

import { useRef, useState } from "react";
import { borrowAprPercent as borrowApr } from "@synapsefi/shared";

/* ── Revenue area chart (last 30 days) ────────────────── */

/** Rounds a range outward to tidy gridline values. */
function niceBounds(values: number[]) {
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 1);
  const span = hi - lo || 1;
  const step = Math.pow(10, Math.floor(Math.log10(span))) / 2;
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}

export function RevenueChart({ data, days }: { data: number[]; days: string[] }) {
  const W = 340, H = 120, padL = 6, padR = 6, padT = 10, padB = 18;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; left: number; top: number } | null>(null);

  if (data.length < 2) {
    return (
      <div className="chart-box" style={{ marginTop: 10 }}>
        <p style={{ fontSize: 12, color: "var(--ink-3)", padding: "28px 0", textAlign: "center" }}>
          Not enough revenue history yet.
        </p>
      </div>
    );
  }

  const { min, max, step } = niceBounds(data);
  const x = (i: number) => padL + (i * (W - padL - padR)) / (data.length - 1);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);

  let line = "";
  data.forEach((v, i) => {
    line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
  });
  const area = line + `L${x(data.length - 1).toFixed(1)} ${H - padB} L${x(0).toFixed(1)} ${H - padB} Z`;
  const last = data.length - 1;

  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step * 2) ticks.push(v);

  const onMove = (e: React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(last, Math.round((px - padL) / ((W - padL - padR) / last))));
    setHover({
      i,
      left: Math.min(r.width - 110, Math.max(4, (x(i) / W) * r.width + 10)),
      top: (y(data[i]) / H) * r.height - 44,
    });
  };

  return (
    <div className="chart-box" style={{ marginTop: 10 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        aria-label={`Daily revenue, last ${data.length} days, ranging ${Math.min(...data).toFixed(0)} to ${Math.max(...data).toFixed(0)} USDC`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
            <text x={padL} y={y(v) - 4} fontSize="9" fill="var(--ink-3)">{v.toFixed(0)}</text>
          </g>
        ))}
        <path d={area} fill="var(--series-1)" opacity="0.14" />
        <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
        {hover && (
          <>
            <line x1={x(hover.i)} x2={x(hover.i)} y1={padT} y2={H - padB} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover.i)} cy={y(data[hover.i])} r="4" fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth="2" />
          </>
        )}
        <circle cx={x(last)} cy={y(data[last])} r="3.5" fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth="2" />
        <text x={x(last) - 6} y={y(data[last]) - 8} fontSize="10" fontWeight="700" fill="var(--ink)" textAnchor="end">
          {data[last].toFixed(0)} USDC
        </text>
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.left, top: hover.top }}>
          <div className="tt-t">{days[hover.i]}</div>
          <div className="tt-v mono">{data[hover.i].toFixed(2)} USDC</div>
        </div>
      )}
    </div>
  );
}

/* ── Interest-rate model chart ─────────────────────────── */

/** @param utilization Current pool utilization in [0, 1] — marks the live point. */
export function RateChart({ utilization }: { utilization: number }) {
  const W = 560, H = 230, padL = 40, padR = 16, padT = 14, padB = 30;
  const xs = (u: number) => padL + u * (W - padL - padR);
  const ys = (a: number) => padT + (1 - a / 20) * (H - padT - padB);

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ u: number; left: number; top: number } | null>(null);

  let d = "";
  for (let u = 0; u <= 1.001; u += 0.02) {
    const uc = Math.min(u, 1);
    d += (u ? "L" : "M") + xs(uc).toFixed(1) + " " + ys(borrowApr(uc)).toFixed(1) + " ";
  }
  const cu = Math.min(Math.max(utilization, 0), 1);
  const ca = borrowApr(cu);

  const onMove = (e: React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, (((e.clientX - r.left) / r.width) * W - padL) / (W - padL - padR)));
    setHover({
      u,
      left: Math.min(r.width - 130, Math.max(4, (xs(u) / W) * r.width + 10)),
      top: (ys(borrowApr(u)) / H) * r.height - 46,
    });
  };

  return (
    <div className="chart-box">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        aria-label={`Borrow APR versus utilization; 2% at zero, 10% at the 80% kink, 19% at full utilization; current utilization ${(cu * 100).toFixed(1)}% gives ${ca.toFixed(1)}% APR`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 5, 10, 15, 20].map((a) => (
          <g key={a}>
            <line x1={padL} x2={W - padR} y1={ys(a)} y2={ys(a)} stroke="var(--grid)" strokeWidth="1" />
            <text x={padL - 8} y={ys(a) + 3} fontSize="10" fill="var(--ink-3)" textAnchor="end">{a}%</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((u) => (
          <text key={u} x={xs(u)} y={H - 10} fontSize="10" fill="var(--ink-3)" textAnchor="middle">
            {(u * 100).toFixed(0)}%
          </text>
        ))}
        <line x1={xs(0.8)} x2={xs(0.8)} y1={padT} y2={H - padB} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        <text x={xs(0.8)} y={padT + 2} fontSize="10" fill="var(--ink-3)" textAnchor="middle">kink 80%</text>
        <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={xs(cu)} cy={ys(ca)} r="4.5" fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth="2" />
        <text
          x={cu > 0.62 ? xs(cu) - 9 : xs(cu) + 9}
          y={ys(ca) - 9}
          fontSize="11"
          fontWeight="700"
          fill="var(--ink)"
          textAnchor={cu > 0.62 ? "end" : "start"}
        >
          current · {(cu * 100).toFixed(1)}% → {ca.toFixed(1)}% APR
        </text>
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.left, top: hover.top }}>
          <div className="tt-t">Utilization {(hover.u * 100).toFixed(1)}%</div>
          <div className="tt-v mono">Borrow APR {borrowApr(hover.u).toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
}

/* ── Sparkline (market table) ──────────────────────────── */

export function Sparkline({ pts }: { pts: number[] }) {
  const w = 72, h = 22;
  if (pts.length < 2) return <svg width={w} height={h} aria-label="No revenue trend yet" />;

  const mx = Math.max(...pts), mn = Math.min(...pts);
  const px = (i: number) => 2 + (i * (w - 4)) / (pts.length - 1);
  const py = (v: number) => 2 + (1 - (v - mn) / (mx - mn || 1)) * (h - 4);
  let d = "";
  pts.forEach((v, i) => (d += (i ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1) + " "));
  const trendUp = pts[pts.length - 1] >= pts[0];

  return (
    <svg width={w} height={h} aria-label={`30-day revenue trend, ${trendUp ? "rising" : "falling"}`}>
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle
        cx={px(pts.length - 1)}
        cy={py(pts[pts.length - 1])}
        r="2.6"
        fill="var(--series-1)"
        stroke="var(--chart-surface)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
