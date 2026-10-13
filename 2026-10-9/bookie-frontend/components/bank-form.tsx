"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "loan" | "repay";

const inputClass =
  "mt-1.5 w-full border border-rule bg-paper px-3 py-2 font-mono text-sm " +
  "focus:border-ink focus:bg-paper focus:outline-none";

const buttonClass =
  "sc w-full border border-ink bg-ink px-4 py-2.5 text-paper transition-colors " +
  "hover:bg-transparent hover:text-ink disabled:opacity-50";

export function BankForm({ action }: { action: Action }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noted, setNoted] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    e.preventDefault();
    setError(null);
    setNoted(null);
    setBusy(true);
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          amount: fd.get("amount"),
          password: fd.get("password"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "The bank didn’t answer as expected — try again.");
        return;
      }
      form.reset();
      setNoted(
        action === "loan"
          ? "The loan is on the book."
          : "The repayment is on the book.",
      );
      router.refresh();
    } catch {
      setError("Could not reach the ledger office.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4 text-sm">
      <label className="block">
        <span className="sc text-muted">Amount</span>
        <input
          name="amount"
          type="number"
          min="1"
          step="0.01"
          inputMode="decimal"
          required
          placeholder="10.00"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="sc text-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={4}
          maxLength={30}
          autoComplete="current-password"
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-muted">
          The password for your account — asked for fresh, kept by nobody.
        </span>
      </label>

      {error && (
        <p className="border-l-2 border-debit pl-3 text-sm text-debit">{error}</p>
      )}
      {noted && (
        <p className="border-l-2 border-credit pl-3 text-sm text-credit">
          {noted}
        </p>
      )}

      <button type="submit" disabled={busy} className={buttonClass}>
        {busy
          ? "Filing…"
          : action === "loan"
            ? "Take the loan"
            : "Make the repayment"}
      </button>
    </form>
  );
}