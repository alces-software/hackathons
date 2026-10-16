"use client";

import Link from "next/link";
import { useState } from "react";
import { GateSlip, WireLoading } from "@/components/wire-note";
import { errorMessage, jsonInit, wire } from "@/lib/client";
import { fmtMoney } from "@/lib/format";
import type { Bounty } from "@/lib/types";
import { useClerk } from "@/components/session";

export function FileNotice() {
  const { clerk, ready } = useClerk();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [pending, setPending] = useState(false);
  const [filed, setFiled] = useState<Bounty | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!ready) return <WireLoading />;

  if (!clerk) {
    return (
      <main className="px-4 pb-24 sm:px-6">
        <GateSlip
          title="Sign in to post a bounty"
          body="Posting takes an account at the bank — the reward is escrowed against your balance when the bounty goes up."
          href="/sign-in?then=/file"
          action="Sign in"
        />
      </main>
    );
  }

  async function postBounty(event: React.FormEvent) {
    event.preventDefault();
    if (!clerk) return;

    const name = title.trim();
    const price = Number(reward.replace(/[$,\s]/g, ""));

    if (!name) {
      setNote("Enter a title.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setNote("Enter a reward amount greater than zero.");
      return;
    }

    setNote(null);
    setPending(true);
    try {
      const created = await wire<Bounty>(
        "/api/bounties",
        jsonInit("POST", {
          username: clerk.username,
          password: clerk.password,
          title: name,
          description: description.trim(),
          price,
        }),
      );
      setFiled(created);
    } catch (error) {
      setNote(errorMessage(error, "Could not post the bounty. Try again."));
    } finally {
      setPending(false);
    }
  }

  if (filed) {
    return (
      <main className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-xl border border-ink px-6 py-10 text-center">
          <span className="stamp text-bill">Filed</span>
          <p className="font-display mt-5 text-[2rem] font-semibold uppercase leading-tight tracking-[0.06em]">
            Bounty Nº {filed.id} is posted
          </p>
          <p className="mt-3 text-[0.95rem] text-ink-soft">
            A reward of {fmtMoney(filed.price)} is held in escrow against{" "}
            <span className="font-bold text-ink">{clerk.username}</span> until
            the bounty is settled.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="btn">
              Back to the board
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFiled(null);
                setTitle("");
                setDescription("");
                setReward("");
              }}
            >
              Post another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pb-24 sm:px-6">
      <form
        onSubmit={(event) => {
          void postBounty(event);
        }}
        className="mx-auto mt-2 max-w-xl border border-ink bg-paper px-6 py-8 sm:px-10"
      >
        <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
          <p className="font-display text-[1.8rem] font-semibold leading-none tracking-[0.16em]">
            FORM B-7
          </p>
          <p className="label">Bounty notice</p>
        </div>

        <div className="mt-7">
          <label className="label" htmlFor="notice-title">
            Title
          </label>
          <input
            id="notice-title"
            className="field mt-1"
            autoComplete="off"
            placeholder="e.g. The Reno Gang job"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
          />
        </div>

        <div className="mt-6">
          <label className="label" htmlFor="notice-body">
            Description
          </label>
          <textarea
            id="notice-body"
            className="field mt-1"
            rows={4}
            placeholder="Describe the work, and what counts as done. Optional."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
        </div>

        <div className="mt-6">
          <label className="label" htmlFor="notice-price">
            Reward ($)
          </label>
          <input
            id="notice-price"
            className="field mt-1"
            inputMode="decimal"
            autoComplete="off"
            placeholder="500"
            value={reward}
            onChange={(event) => setReward(event.target.value)}
          />
          <p className="mt-2 text-[0.78rem] text-ink-soft">
            Taken from your balance and held in escrow until the bounty is
            settled.
          </p>
        </div>

        {note && (
          <p
            role="alert"
            className="mt-6 border border-oxblood px-4 py-3 text-[0.85rem]"
          >
            {note}
          </p>
        )}

        <button type="submit" className="btn mt-8 w-full" disabled={pending}>
          {pending ? "Posting…" : "Post bounty"}
        </button>
      </form>
    </main>
  );
}