import Image from "next/image";

/** The Arc network mark — prefixes every "Arc Testnet" label in the app. */
export function ArcIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/arc.svg"
      alt=""
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
    />
  );
}
