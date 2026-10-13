"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtTimestamp } from "@/lib/format";

const inputClass =
  "mt-1.5 w-full border border-rule bg-paper px-3 py-2 font-mono text-sm " +
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

/** Figures only: digits and one dot, at most two decimals. The fields are
 *  plain text because browsers blank out partial `type=number` input — the
 *  reason a mid-typed decimal used to make everything evaporate. */
const sanitize = (v: string) => {
  let s = v.replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  const frac = s.indexOf(".");
  if (frac !== -1) s = s.slice(0, frac + 3);
  return s.slice(0, 12);
};

/* — the office's rubber stamps. One of these goes on every filed docket,
   chosen at the whimsy of whoever was holding the stamp. */
const STAMPS = [
  "Without enthusiasm",
  "The teller did not blink",
  "Noted, reluctantly",
  "Cleaner than most",
  "Money: departed, as designed",
  "Filed under “probably fine”",
  "The ledger yawned",
  "Approved by nobody in particular",
  "The book remembers",
  "One cent closer to something",
  "Seen by the office, unimpressed",
  "The house thanks you, sort of",
];

type Filed = {
  no: string;
  to: string;
  send: string;
  receive: string;
  stamp: string;
  tilt: number;
  remarkTilt: number;
  at: string;
};

const pickStamp = () => STAMPS[Math.floor(Math.random() * STAMPS.length)];
const tilt = () => Math.random() * 8 - 4;

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty",
  "sixty", "seventy", "eighty", "ninety",
];

/* a cheque-style chunk: 325 → "three hundred and twenty-five" */
function chunk(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let s = hundred ? `${ONES[hundred]} hundred` : "";
  if (rest) {
    if (s) s += " and ";
    if (rest < 20) s += ONES[rest];
    else {
      s += TENS[Math.floor(rest / 10)];
      if (rest % 10) s += `-${ONES[rest % 10]}`;
    }
  }
  return s;
}

/** The sum in words, the way the paperwork likes it: 9.5 → "nine and 50/100" */
function inWords(send: string): string {
  const n = num(send);
  if (!Number.isFinite(n) || n <= 0) return "…";
  if (n >= 1e9) return "a sum best left in figures";
  const cents = Math.round((n - Math.floor(n)) * 100);
  const m = Math.floor(n / 1e6);
  const k = Math.floor((n % 1e6) / 1e3);
  const r = n % 1e3;
  const parts: string[] = [];
  if (m) parts.push(`${chunk(m)} million`);
  if (k) parts.push(`${chunk(k)} thousand`);
  if (r) parts.push(chunk(r));
  let whole = parts.join(", ");
  if (parts.length === 2 && !k) whole = parts.join(" and ");
  const unit = n === 1 ? " Moose Buck" : " Moose Bucks";
  if (!whole && cents === 0) return "nothing";
  if (cents === 0) return whole + unit;
  return `${whole || "nothing"} and ${String(cents).padStart(2, "0")}/100${unit}`;
}

export function TransferForm({ recipients, fee }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the sender types, and what the recipient is shown to get — the two
  // fields keep each other honest through the fee.
  const [send, setSend] = useState("");
  const [receive, setReceive] = useState("");

  // A filed docket rides in place of the form until "file another".
  const [filed, setFiled] = useState<Filed | null>(null);

  const feeOk = fee !== null && Number.isFinite(fee);
  const factor = feeOk ? 1 - (fee as number) / 100 : 1;
  const syncs = factor > 0;

  function onSend(v: string) {
    const clean = sanitize(v);
    setSend(clean);
    const n = num(clean);
    setReceive(Number.isFinite(n) && syncs ? r2(n * factor) : "");
  }

  function onReceive(v: string) {
    const clean = sanitize(v);
    setReceive(clean);
    const n = num(clean);
    setSend(Number.isFinite(n) && syncs ? r2(n / factor) : "");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    e.preventDefault();
    setError(null);
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
        setError(data.error ?? "The office didn’t answer — try again.");
        return;
      }
      const got = r2(num(send) * factor);
      setFiled({
        no: `T-${Math.floor(10000 + Math.random() * 90000)}`,
        to: String(fd.get("recipient") ?? "—"),
        send: r2(num(send)),
        receive: Number(got) >= 0 ? got : "—",
        stamp: pickStamp(),
        tilt: tilt(),
        remarkTilt: tilt(),
        at: fmtTimestamp(new Date().toISOString()),
      });
      form.reset();
      setSend("");
      setReceive("");
      router.refresh();
    } catch {
      setError("Could not reach the ledger office.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet mt-6 p-5 sm:p-6">
      <div className="border-b border-dashed border-rule pb-3 text-center">
        <p className="sc">The Alces book — transfer docket</p>
        <p className="mt-1 font-mono text-[0.65rem] text-muted">
          to be completed in ink · errors are permanent
        </p>
      </div>

      {filed === null ? (
        <form onSubmit={onSubmit} className="mt-5 space-y-5 text-sm">
          <label className="block">
            <span className="sc text-muted">Pay to the name of</span>
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

          <div>
            <div className="grid grid-cols-2 gap-x-4">
              <label className="block">
                <span className="sc text-muted">You send</span>
                <input
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{0,2})?"
                  required
                  placeholder="10.00"
                  value={send}
                  onChange={(e) => onSend(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="sc text-muted">They get</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]{0,2}"
                  placeholder={syncs ? "9.50" : "10.00"}
                  value={receive}
                  disabled={!syncs}
                  onChange={(e) => onReceive(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">
              {!feeOk
                ? "The office wouldn’t quote the fee just now — figures move one to one."
                : fee === 0
                  ? "The house skims nothing today. Do tell your friends."
                  : syncs
                    ? `The house skims ${String(fee)}% in the middle — write one figure and the other obliges.`
                    : `The house skims ${String(fee)}% — which is all of it, so “they get” is shut for now.`}
            </p>
            <p className="mt-1 font-mono text-xs text-muted">
              which is to say&nbsp;
              <span className="text-ink">“{inWords(send)}”</span>
            </p>
          </div>

          <div className="border-t border-dashed border-rule pt-4">
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
                The office checks it, then forgets it — no copy is kept here.
              </span>
            </label>
          </div>

          {error && (
            <p className="border-l-2 border-debit pl-3 text-sm text-debit">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Filing…" : "File this docket"}
          </button>
        </form>
      ) : (
        <div className="relative mt-5 border border-ink bg-paper p-5">
          <span
            className="stamp absolute right-4 top-4 border-debit text-debit"
            style={{ transform: `rotate(${filed.tilt}deg)` }}
          >
            Filed
          </span>
          <p className="sc text-muted">docket {filed.no}</p>
          <dl className="mt-3 max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="sc text-muted">paid</dt>
              <dd className="amt">{filed.send}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="sc text-muted">to</dt>
              <dd className="font-mono">{filed.to}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="sc text-muted">landed</dt>
              <dd className="amt">{filed.receive}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="sc text-muted">at</dt>
              <dd className="font-mono text-xs leading-6">{filed.at}</dd>
            </div>
          </dl>
          <div className="mt-5 text-center">
            <span
              className="stamp border-debit text-debit"
              style={{ transform: `rotate(${filed.remarkTilt}deg)` }}
            >
              {filed.stamp}
            </span>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Both entries are in the ledger already — the ink was never dry, it
            never gets to be.
          </p>
          <button
            type="button"
            onClick={() => setFiled(null)}
            className={`mt-4 ${buttonClass}`}
          >
            File another docket
          </button>
        </div>
      )}
    </div>
  );
}