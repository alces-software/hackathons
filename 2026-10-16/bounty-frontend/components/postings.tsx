"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BountyCard } from "@/components/bounty-card";
import { useClerk } from "@/components/session";
import {
  EmptySlip,
  SheetNav,
  WireErrorNote,
  WireLoading,
} from "@/components/wire-note";
import { errorMessage, jsonInit, wire } from "@/lib/client";
import type { Bounty, Page } from "@/lib/types";

const PAGE_SIZE = 12;
const TILTS = [-0.45, 0.35, -0.2, 0.5, -0.3, 0.25];

type Feed = { loading: boolean; sheet?: Page<Bounty>; error?: string };

export function Postings() {
  const { clerk } = useClerk();
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [feed, setFeed] = useState<Feed>({ loading: true });
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [justSettled, setJustSettled] = useState<number[]>([]);
  const [settleNote, setSettleNote] = useState<string | null>(null);

  const sheet = feed.sheet;
  const totalPages = sheet?.totalPages ?? 1;

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    (async () => {
      setFeed((state) => ({ ...state, loading: true, error: undefined }));
      const query = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        completed: "false",
      });
      try {
        const data = await wire<Page<Bounty>>(`/api/bounties?${query}`, {
          signal: controller.signal,
        });
        if (!alive) return;
        setFeed({ loading: false, sheet: data });
      } catch (error) {
        if (!alive || controller.signal.aborted) return;
        setFeed({
          loading: false,
          error: errorMessage(error, "Could not load the board."),
        });
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [page, tick]);

  async function settle(bounty: Bounty, claiment: string) {
    if (!clerk || settlingId !== null) return;
    setSettleNote(null);
    setSettlingId(bounty.id);
    try {
      const cleared = await wire<Bounty>(
        `/api/bounties/${bounty.id}/complete`,
        jsonInit("PATCH", {
          username: clerk.username,
          password: clerk.password,
          claiment,
        }),
      );
      setJustSettled((ids) => [...ids, cleared.id]);
      // Let the stamp land, then pull fresh data.
      window.setTimeout(() => {
        setJustSettled((ids) => ids.filter((id) => id !== cleared.id));
        setTick((t) => t + 1);
      }, 800);
    } catch (error) {
      setSettleNote(errorMessage(error, "Could not settle this bounty."));
    } finally {
      setSettlingId(null);
    }
  }

  if (feed.loading && !sheet) return <WireLoading />;
  if (feed.error && !sheet) {
    return (
      <main className="px-4 pb-24 sm:px-6">
        <WireErrorNote message={feed.error} onRetry={() => setTick((t) => t + 1)} />
      </main>
    );
  }
  if (!sheet) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-5">
        <p className="label">
          {sheet.itemTotal} open bounties · page {page} of{" "}
          {Math.max(1, totalPages)}
        </p>
        {!clerk && (
          <p className="label">
            <Link href="/sign-in" className="underline underline-offset-2">
              Sign in
            </Link>{" "}
            to settle a bounty
          </p>
        )}
      </div>

      {settleNote && (
        <div className="mb-7">
          <div
            role="alert"
            className="border border-oxblood px-4 py-3 text-[0.85rem]"
          >
            <span className="font-bold uppercase tracking-[0.1em] text-oxblood">
              Could not settle ·{" "}
            </span>
            {settleNote}
          </div>
        </div>
      )}

      {sheet.data.length === 0 ? (
        <EmptySlip
          title="No open bounties"
          body="Nothing is outstanding right now. Post one and it goes up here immediately."
        >
          {clerk ? (
            <Link href="/file" className="btn">
              Post a bounty
            </Link>
          ) : (
            <Link href="/sign-in" className="btn">
              Sign in to post one
            </Link>
          )}
        </EmptySlip>
      ) : (
        <div className="grid items-stretch gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {sheet.data.map((bounty, index) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              tilt={TILTS[index % TILTS.length]}
              settling={settlingId === bounty.id}
              justSettled={justSettled.includes(bounty.id)}
              selfName={clerk ? clerk.username : null}
              onSettle={
                clerk
                  ? (claiment) => {
                      void settle(bounty, claiment);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <SheetNav
        page={page}
        totalPages={totalPages}
        busy={feed.loading}
        onMove={setPage}
      />
    </main>
  );
}