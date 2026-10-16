"use client";

import { useEffect, useState } from "react";
import {
  EmptySlip,
  SheetNav,
  WireErrorNote,
  WireLoading,
} from "@/components/wire-note";
import { errorMessage, wire } from "@/lib/client";
import { fmtMoney } from "@/lib/format";
import type { Page, PublicUser } from "@/lib/types";

const PAGE_SIZE = 20;

type Feed = { loading: boolean; sheet?: Page<PublicUser>; error?: string };

export function Register() {
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
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
        orderByBalance: sort,
      });
      try {
        const data = await wire<Page<PublicUser>>(`/users?${query}`, {
          signal: controller.signal,
        });
        if (!alive) return;
        setFeed({ loading: false, sheet: data });
      } catch (error) {
        if (!alive || controller.signal.aborted) return;
        setFeed({
          loading: false,
          error: errorMessage(error, "Could not load the register."),
        });
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [page, sort]);

  if (feed.loading && !sheet) return <WireLoading />;
  if (feed.error && !sheet) {
    return (
      <main className="px-4 pb-24 sm:px-6">
        <WireErrorNote message={feed.error} onRetry={() => setPage(1)} />
      </main>
    );
  }
  if (!sheet) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
        <p className="label">
          {sheet.itemTotal} accounts · page {page} of {Math.max(1, totalPages)}
        </p>
        <div className="flex border border-ink">
          <button
            type="button"
            className="seg"
            aria-pressed={sort === "desc"}
            onClick={() => {
              setPage(1);
              setSort("desc");
            }}
          >
            Highest balance
          </button>
          <button
            type="button"
            className="seg"
            aria-pressed={sort === "asc"}
            onClick={() => {
              setPage(1);
              setSort("asc");
            }}
          >
            Lowest balance
          </button>
        </div>
      </div>

      {sheet.data.length === 0 ? (
        <EmptySlip
          title="No accounts found"
          body="The bank returned no accounts. It may be down — try again in a minute."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="ledger w-full">
            <thead>
              <tr>
                <th scope="col" className="w-[4.5rem]">
                  Nº
                </th>
                <th scope="col">Account</th>
                <th scope="col" className="text-right">
                  Balance
                </th>
                <th scope="col" className="text-right">
                  Debt
                </th>
                <th scope="col" className="text-right">
                  Winnings
                </th>
                <th scope="col" className="text-right">
                  Losses
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.data.map((user, index) => (
                <tr key={user.id}>
                  <td className="text-ink-soft">
                    {String(user.id).padStart(3, "0")}
                  </td>
                  <td>
                    <span className="font-bold">{user.username}</span>
                    {sort === "desc" && index === 0 && (
                      <span className="stamp stamp-sm ml-3 rotate-[-3deg] text-oxblood">
                        Top hand
                      </span>
                    )}
                  </td>
                  <td className="text-right font-bold">
                    {fmtMoney(user.balance)}
                  </td>
                  <td
                    className={`text-right ${
                      user.debt > 0 ? "text-oxblood" : "text-ink-soft"
                    }`}
                  >
                    {fmtMoney(user.debt)}
                  </td>
                  <td
                    className={`text-right ${
                      user.winnings > 0 ? "text-bill" : "text-ink-soft"
                    }`}
                  >
                    {fmtMoney(user.winnings)}
                  </td>
                  <td className="text-right text-ink-soft">
                    {fmtMoney(user.losses)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
