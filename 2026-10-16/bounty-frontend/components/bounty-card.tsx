"use client";

import { useState } from "react";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";
import { wire } from "@/lib/client";
import type { Bounty, Page, PublicUser } from "@/lib/types";

export function BountyCard({
  bounty,
  justSettled = false,
  settling = false,
  tilt = 0,
  selfName = null,
  onSettle,
}: {
  bounty: Bounty;
  /** Stamp lands before the fresh data does. */
  justSettled?: boolean;
  settling?: boolean;
  /** Slight print wobble, degrees. */
  tilt?: number;
  /** Signed-in account, excluded from the recipient list. */
  selfName?: string | null;
  /** Present once the viewer can settle; receives the chosen recipient. */
  onSettle?: (claiment: string) => void;
}) {
  const paid = bounty.endDate !== null;
  const stamped = paid || justSettled;

  const [picking, setPicking] = useState(false);
  const [recipients, setRecipients] = useState<string[] | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [chosen, setChosen] = useState("");

  // The panel yields the moment the settle stamp lands.
  const panelOpen = picking && !stamped;

  async function openPanel() {
    setPicking(true);
    setChosen("");
    setRecipientError(null);
    setRecipients(null);
    try {
      // The API caps a sheet at 100; plenty for the county.
      const sheet = await wire<Page<PublicUser>>(
        "/users?page=1&limit=100&orderByBalance=desc",
      );
      setRecipients(
        sheet.data
          .map((user) => user.username)
          .filter((name) => name !== selfName)
          .sort((a, b) => a.localeCompare(b)),
      );
    } catch {
      setRecipientError("Could not load the accounts. Try again.");
    }
  }

  return (
    <article
      className="card flex flex-col"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-rule px-5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-soft">
        <span>Nº {fmtNumber(bounty.id)}</span>
        <span>{paid ? `Paid ${fmtDate(bounty.endDate)}` : "Open"}</span>
      </div>

      <div className="relative flex flex-1 flex-col px-5 pb-5 pt-4">
        {stamped && (
          <div className="stamp-seal" aria-hidden="true">
            <span
              className={`stamp seal-face text-bill ${justSettled ? "stamp-in" : ""}`}
            >
              Paid
            </span>
          </div>
        )}

        <p className="font-display text-[2.7rem] font-semibold uppercase leading-[0.9] tracking-[0.07em]">
          Wanted
        </p>
        <h3 className="mt-2 text-[1.05rem] font-bold leading-snug">
          {bounty.title}
        </h3>
        <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-soft line-clamp-4">
          {bounty.description?.trim()
            ? bounty.description
            : "No description provided."}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-dashed border-rule pt-4">
          <div className="pt-4">
            <p className="label">{paid ? "Reward paid" : "Reward"}</p>
            <p className="font-display mt-1 text-[2.1rem] font-semibold leading-none tracking-[0.03em] text-oxblood">
              {fmtMoney(bounty.price)}
            </p>
          </div>
          {!paid && (
            <span className="stamp stamp-sm rotate-2 self-end text-bill">
              Escrow held
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[0.72rem] uppercase tracking-[0.1em] text-ink-soft">
          <span>
            Posted by{" "}
            <span className="font-bold normal-case text-ink">
              {bounty.patron}
            </span>
          </span>
          {bounty.claiment && (
            <span>
              Claimed by{" "}
              <span className="font-bold normal-case text-ink">
                {bounty.claiment}
              </span>
            </span>
          )}
        </div>

        {onSettle &&
          !paid &&
          (panelOpen ? (
            <div className="border-t border-ink mt-4 pt-4">
              <label className="label" htmlFor={`recipient-${bounty.id}`}>
                Pay the reward to
              </label>

              {recipientError !== null ? (
                <div className="mt-2">
                  <p className="text-[0.82rem] text-oxblood">
                    {recipientError}
                  </p>
                  <button
                    type="button"
                    className="btn-ghost btn-sm mt-3"
                    onClick={() => {
                      void openPanel();
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : recipients === null ? (
                <p className="mt-2 text-[0.85rem] text-ink-soft">
                  Loading accounts
                  <span className="dots" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </p>
              ) : recipients.length === 0 ? (
                <p className="mt-2 text-[0.85rem] text-ink-soft">
                  {selfName
                    ? "No other accounts at the bank yet."
                    : "The bank returned no accounts."}
                </p>
              ) : (
                <select
                  id={`recipient-${bounty.id}`}
                  className="select-boxed mt-2"
                  value={chosen}
                  onChange={(event) => setChosen(event.target.value)}
                >
                  <option value="">Choose an account —</option>
                  {recipients.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  className="btn flex-1"
                  disabled={recipients === null || !chosen || settling}
                  onClick={() => {
                    if (chosen && onSettle) onSettle(chosen);
                  }}
                >
                  {settling ? "Paying…" : `Pay ${fmtMoney(bounty.price)}`}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={settling}
                  onClick={() => {
                    setPicking(false);
                    setChosen("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-rule pt-4 mt-4">
              <button
                type="button"
                className="btn w-full"
                disabled={justSettled}
                onClick={() => {
                  void openPanel();
                }}
              >
                {justSettled ? "Settled" : "Settle"}
              </button>
              <p className="mt-2 text-center text-[0.68rem] uppercase tracking-[0.1em] text-ink-soft">
                Choose who receives the reward
              </p>
            </div>
          ))}
      </div>
    </article>
  );
}
