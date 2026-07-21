"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Small icon button that copies `value` to the clipboard, with a brief checkmark confirmation. */
export function CopyButton({
  value,
  className = "",
  size = 13,
  label = "address",
}: {
  value: string;
  className?: string;
  size?: number;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable — nothing to recover, just no-op.
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`copy-btn ${className}`}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}
