"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { groupAmountInput } from "./contracts";

/**
 * Index in `formatted` that sits after the same number of significant characters
 * (digits and the dot) as precede `pos` in `typed`.
 *
 * Grouping inserts and removes commas to the left of the caret, so the raw offset
 * the browser reports is stale the moment we reformat — typing "2000" would land
 * the caret at "2,00|0". Counting significant characters instead of raw offsets is
 * what keeps it on the digit the user just typed.
 */
function caretAfterGrouping(typed: string, pos: number, formatted: string): number {
  const target = typed.slice(0, pos).replace(/[^\d.]/g, "").length;
  let seen = 0;
  let i = 0;
  for (; i < formatted.length && seen < target; i++) {
    if (/[\d.]/.test(formatted[i])) seen++;
  }
  return i;
}

/**
 * State for an amount field that groups as you type. `value` is always display
 * form ("2,000.5") and is safe to hand to parseUsdc, which strips the separators.
 */
export function useAmountInput() {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Restore before paint: setting it in the change handler would run against the
  // pre-render DOM, and after paint the caret would visibly jump.
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.currentTarget.value;
    const pos = e.currentTarget.selectionStart ?? typed.length;
    const next = groupAmountInput(typed);
    caret.current = caretAfterGrouping(typed, pos, next);
    setValue(next);
  }, []);

  /** For programmatic values (the Max button), which arrive ungrouped. */
  const set = useCallback((next: string) => setValue(groupAmountInput(next)), []);

  return { value, set, inputProps: { ref, value, onChange } };
}
