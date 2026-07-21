"use client";

// Shared transaction flow: submit → wait for receipt → refresh reads.
// Views get one `status` to render against instead of juggling the write
// mutation and the receipt query separately.

import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

export type TxStatus = "idle" | "signing" | "pending" | "success" | "error";

export function useTx() {
  const queryClient = useQueryClient();
  const { mutateAsync: write, data: hash, isPending: isSigning, error: writeError, reset } = useWriteContract();
  // Bound the receipt wait: `isConfirming` feeds `isBusy`, which disables every
  // action in the view. A hash that never lands a receipt — sent to a different
  // chain, or mined on a local chain that has since been reset — would otherwise
  // leave the buttons disabled forever with no way out but a page reload.
  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash,
    timeout: 60_000,
  });

  // A confirmed tx invalidates every contract read and API query at once —
  // simpler than tracking which keys each flow touches, and cheap at this size.
  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries();
  }, [isSuccess, queryClient]);

  const status: TxStatus = isSigning
    ? "signing"
    : isConfirming
      ? "pending"
      : isSuccess
        ? "success"
        : writeError || receiptError
          ? "error"
          : "idle";

  const error = writeError ?? receiptError ?? null;

  const send = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- call shape varies per contract; wagmi types it at the call site
    async (request: any) => {
      try {
        return await write(request);
      } catch {
        // Surfaced via `error`; rejections here are usually the user declining.
        return undefined;
      }
    },
    [write],
  );

  return { send, status, error, hash, reset, isBusy: isSigning || isConfirming };
}

/** Short, human-readable reason from a viem/wagmi error. */
export function txErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  const first = error.message.split("\n")[0];
  if (/user rejected|denied transaction/i.test(first)) return "Transaction rejected in wallet.";
  return first;
}
