import { ArcIcon } from "./arc-icon";
import { XLogo } from "./x-icon";

/** Shared by the dashboard and the landing page — same credibility signal either place. */
export function ProtocolFooter() {
  return (
    <footer>
      <div className="col">
        <strong style={{ color: "var(--ink-2)" }}>SynapseFi</strong>
        <a
          href="https://x.com/xemreyrr"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <XLogo className="h-3 w-3" /> Founder · @xemreyrr ↗
        </a>
      </div>
      <div className="col" style={{ marginLeft: "auto" }}>
        <strong style={{ color: "var(--ink-2)" }}>
          <ArcIcon /> Built on Arc
        </strong>
      </div>
    </footer>
  );
}
