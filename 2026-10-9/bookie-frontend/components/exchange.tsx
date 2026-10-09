"use client";

import { useState } from "react";

type State = {
  mb: string;
  gbp: string;
};

const EMPTY: State = { mb: "", gbp: "" };

export function Exchange() {
  const [state, setState] = useState<State>(EMPTY);

  function edit(field: "mb" | "gbp", raw: string) {
    const value = Number(raw);
    const valid = raw.trim() !== "" && Number.isFinite(value) && value > 0;
    if (!valid) {
      setState(EMPTY);
      return;
    }

    // 1 Moose Buck in GBP, marked anew whenever an amount is entered
    const rate = 0.25 + Math.random() * 1.5;
    setState(
      field === "mb"
        ? { mb: raw, gbp: (value * rate).toFixed(2) }
        : { gbp: raw, mb: (value / rate).toFixed(2) },
    );
  }

  const box =
    "amt w-44 border-b border-rule bg-transparent pb-1 text-2xl outline-none focus:border-ink";

  return (
    <div className="flex items-end gap-x-10 gap-y-4">
      <div>
        <p className="sc text-muted">moose bucks</p>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={state.mb}
          onChange={(e) => edit("mb", e.target.value)}
          placeholder="0.00"
          className={`mt-2 ${box}`}
          aria-label="Amount in Moose Bucks"
        />
      </div>
      <span className="sc pb-2 text-muted">⇄</span>
      <div>
        <p className="sc text-muted">pounds sterling</p>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={state.gbp}
          onChange={(e) => edit("gbp", e.target.value)}
          placeholder="0.00"
          className={`mt-2 ${box}`}
          aria-label="Amount in GBP"
        />
      </div>
    </div>
  );
}