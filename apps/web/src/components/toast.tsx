"use client";

// Bottom-right toast stack for transaction status — the pattern most web3
// apps use instead of mutating button copy ("Confirm in wallet…") or an
// inline status line under the form. One toast per send(), updated in place
// as it moves signing -> pending -> success/error, not stacked separately.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastKind = "pending" | "success" | "error" | "info";

export interface ToastInput {
  kind: ToastKind;
  title: string;
  description?: string;
  /** e.g. an ArcScan tx link. */
  href?: string;
}

interface ToastEntry extends ToastInput {
  id: number;
}

interface ToastContextValue {
  push: (toast: ToastInput) => number;
  update: (id: number, patch: Partial<ToastInput>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Pending toasts stay until explicitly updated to success/error — there's no
// fixed duration for "waiting on a wallet" or "waiting on a receipt".
const AUTO_DISMISS_MS: Record<ToastKind, number | null> = {
  pending: null,
  success: 5_000,
  error: 8_000,
  info: 5_000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback(
    (id: number, kind: ToastKind) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      const ms = AUTO_DISMISS_MS[kind];
      if (ms === null) return;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ms),
      );
    },
    [dismiss],
  );

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...toast, id }]);
      schedule(id, toast.kind);
      return id;
    },
    [schedule],
  );

  const update = useCallback(
    (id: number, patch: Partial<ToastInput>) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      if (patch.kind) schedule(id, patch.kind);
    },
    [schedule],
  );

  const value = useMemo(() => ({ push, update, dismiss }), [push, update, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-icon" aria-hidden="true">
              {t.kind === "pending" ? <span className="toast-spinner" /> : t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
            </span>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.description && <div className="toast-desc">{t.description}</div>}
              {t.href && (
                <a className="toast-link" href={t.href} target="_blank" rel="noreferrer">
                  View on ArcScan ↗
                </a>
              )}
            </div>
            <button className="toast-close" type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
