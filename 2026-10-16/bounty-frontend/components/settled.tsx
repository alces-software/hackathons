"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BountyCard } from "@/components/bounty-card";
import {
  EmptySlip,
  SheetNav,
  WireErrorNote,
  WireLoading,
} from "@/components/wire-note";
import { errorMessage, wire } from "@/lib/client";
import type { Bounty, Page } from "@/lib/types";

const PAGE_SIZE = 12;
const TILTS = [0.3, -0.4, 0.2, -0.25, 0.45, -0.3];

type Feed = { loading: boolean; sheet?: Page<Bounty>; error?: string };

export function Settled() {
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [feed, setFeed] = useState<Feed>({ loading: true });

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
        completed: "true",
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
          error: errorMessage(error, "Could not load the ledger."),
        });
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [page, tick]);

  if (feed.loading && !sheet) return <WireLoading />;
  if (feed.error && !sheet) {
    return (
      <main className="px-4 pb-24 sm:px-6">
        <WireErrorNote
          message={feed.error}
          onRetry={() => setTick((t) => t + 1)}
        />
      </main>
    );
  }
  if (!sheet) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-5">
        <p className="label">
          {sheet.itemTotal} paid out · page {page} of{" "}
          {Math.max(1, totalPages)}
        </p>
        <p className="label">
          <Link href="/" className="underline underline-offset-2">
            Back to the board
          </Link>
        </p>
      </div>

      {sheet.data.length === 0 ? (
        <EmptySlip
          title="Nothing settled yet"
          body="Bounties show up here once they've been paid out."
        />
      ) : (
        <div className="grid items-stretch gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {sheet.data.map((bounty, index) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              tilt={TILTS[index % TILTS.length]}
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