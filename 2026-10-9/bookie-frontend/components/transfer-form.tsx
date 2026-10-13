"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1.5 w-full border border-rule bg-paper-2 px-3 py-2 font-mono text-sm " +
  "focus:border-ink focus:bg-paper focus:outline-none";

const buttonClass =
  "sc w-full border border-ink bg-ink px-4 py-2.5 text-paper transition-colors " +
  "hover:bg-transparent hover:text-ink disabled:opacity-50";

type Props = {
  /** Names you can pay. null when the book couldn't be read — falls back
   *  to typing the name in. */
  recipients: string[] | null;
  /** The percent the house takes off each transfer. null when the fee
   *  couldn't be read — the pair then moves one to one. */
  fee: number | null;
};

const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function TransferForm({ recipients, fee }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noted, setNoted] = useState<string | null>(null);

  // What the sender types, and what the recipient is shown to get — the two
  // fields keep each other honest through the fee.
  const [send, setSend] = useState("");
  const [receive, setReceive] = useState("");

  const factor = fee === null ? 1 : 1 - fee / 100;
  const syncs = factor > 0;

  function onSend(v: string) {
    setSend(v);
    const n = num(v);
    setReceive(Number.isFinite(n) && syncs ? r2(n * factor) : "");
  }

  function onReceive(v: string) {
    setReceive(v);
    const n = num(v);
    setSend(Number.isFinite(n) && syncs ? r2(n / factor) : "");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    e.preventDefault();
    setError(null);
    setNoted(null);
    setBusy(true);
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient: fd.get("recipient"),
          amount: Number(send),
          password: fd.get("password"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "The core didn’t answer as expected — try again.");
        return;
      }
      form.reset();
      setSend("");
      setReceive("");
      setNoted("The transfer is on the book.");
      router.refresh();
    } catch {
      setError("Could not reach the ledger office.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5 text-sm">
      <label className="block">
        <span className="sc text-muted">Recipient</span>
        {recipients === null ? (
          <input
            name="recipient"
            required
            minLength={4}
            maxLength={25}
            autoComplete="off"
            spellCheck={false}
            placeholder="name on the book"
            className={inputClass}
          />
        ) : (
          <select
            name="recipient"
            required
            defaultValue=""
            className={`${inputClass} appearance-none`}
          >
            <option value="" disabled>
              {recipients.length === 0
                ? "no other accounts on the book yet"
                : "pick a name"}
            </option>
            {recipients.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </label>
      <div className="grid grid-cols-2 gap-x-4">
        <label className="block">
          <span className="sc text-muted">You send</span>
          <input
            name="amount"
            type="number"
            min="1"
            step="0.01"
            inputMode="decimal"
            required
            placeholder="10.00"
            value={send}
            onChange={(e) => onSend(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="sc text-muted">They receive</span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder={syncs ? "9.50" : "10.00"}
            value={receive}
            disabled={!syncs}
            onChange={(e) => onReceive(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        {fee === null
          ? "The core wouldn’t say the fee just now — treated as none, so the pair moves one to one."
          : fee === 0
            ? "The house takes nothing off transfers right now."
            : `The house takes ${String(fee)}% off every transfer — type one side and the other follows.`}
      </p>
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
        {busy ? "Filing…" : "Make the transfer"}
      </button>
    </form>
  );
}