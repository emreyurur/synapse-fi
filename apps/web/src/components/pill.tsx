export type PillState = "ok" | "warn" | "crit";

export function Pill({ state, children }: { state: PillState; children: React.ReactNode }) {
  return (
    <span className={`pill ${state}`}>
      <span className="pd" />
      {children}
    </span>
  );
}
