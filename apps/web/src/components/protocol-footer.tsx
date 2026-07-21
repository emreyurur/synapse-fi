import { chain } from "@/lib/wagmi";
import { contractAddresses } from "@/lib/contracts";

const short = (a: string | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "not deployed");

/** Shared by the dashboard and the landing page — same credibility signal either place. */
export function ProtocolFooter() {
  return (
    <footer>
      <div className="col">
        <strong style={{ color: "var(--ink-2)" }}>Protocol contracts · {chain.name}</strong>
        <span className="mono">CreditPool (ERC-4626) {short(contractAddresses.creditPool)}</span>
        <span className="mono">CreditLineManager {short(contractAddresses.creditLineManager)}</span>
        <span className="mono">ScoreOracle {short(contractAddresses.scoreOracle)}</span>
      </div>
      <div className="col">
        <strong style={{ color: "var(--ink-2)" }}>Built on</strong>
        <span>Arc · Circle App Kit · USDC · ERC-8004 · ERC-8183</span>
      </div>
      <div className="col" style={{ marginLeft: "auto" }}>
        <strong style={{ color: "var(--ink-2)" }}>SynapseFi</strong>
        <span>Working capital for the agentic economy.</span>
      </div>
    </footer>
  );
}
