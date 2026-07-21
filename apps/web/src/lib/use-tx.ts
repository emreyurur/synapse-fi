"use client";

// Shared transaction flow: submit → wait for receipt → refresh reads. Status
// is surfaced as a bottom-right toast (one per send(), updated in place as it
// moves signing -> pending -> success/error) instead of button copy or an
// inline status line — views just disable the button while `isBusy`.

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ARC_TESTNET } from "@synapsefi/shared";
import { useToast } from "@/components/toast";

export type TxStatus = "idle" | "signing" | "pending" | "success" | "error";

export function useTx() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const toastId = useRef<number | null>(null);

  const { mutateAsync: write, data: hash, isPending: isSigning, error: writeError, reset: resetWrite } = useWriteContract();
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

  // Mirrors `status` into the toast stack. One toast per attempt, updated in
  // place rather than stacking a new one per phase.
  useEffect(() => {
    const href = hash ? `${ARC_TESTNET.explorerUrl}/tx/${hash}` : undefined;

    if (status === "signing") {
      toastId.current = toast.push({ kind: "pending", title: "Confirm in wallet…" });
    } else if (status === "pending") {
      const patch = { kind: "pending" as const, title: "Transaction submitted", description: "Waiting for confirmation…", href };
      if (toastId.current !== null) toast.update(toastId.current, patch);
      else toastId.current = toast.push(patch);
    } else if (status === "success") {
      const patch = { kind: "success" as const, title: "Confirmed on-chain", description: undefined, href };
      if (toastId.current !== null) toast.update(toastId.current, patch);
      else toast.push(patch);
      toastId.current = null;
    } else if (status === "error") {
      const patch = { kind: "error" as const, title: "Transaction failed", description: txErrorMessage(error) ?? undefined, href };
      if (toastId.current !== null) toast.update(toastId.current, patch);
      else toast.push(patch);
      toastId.current = null;
    }
    // Re-runs only on a real status transition; `toast`/`hash`/`error` are
    // read at that moment, not watched for their own sake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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

  const reset = useCallback(() => {
    resetWrite();
    if (toastId.current !== null) {
      toast.dismiss(toastId.current);
      toastId.current = null;
    }
  }, [resetWrite, toast]);

  return { send, status, error, hash, reset, isBusy: isSigning || isConfirming };
}

/** Short, human-readable reason from a viem/wagmi error. */
export function txErrorMessage(error: Error | null): string | null {
  if (!error) return null;
  const first = error.message.split("\n")[0];
  if (/user rejected|denied transaction/i.test(first)) return "Transaction rejected in wallet.";
  return first;
}
