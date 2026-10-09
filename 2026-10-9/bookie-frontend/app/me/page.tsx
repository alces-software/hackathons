import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllUsers, fetchAll, ApiError, type Txn } from "@/lib/api";
import { getSession } from "@/lib/session";
import { fmtAmount } from "@/lib/format";
import { TxnTable } from "@/components/txn-table";

export const metadata = { title: "Your account" };

export default async function MePage() {
  const me = await getSession();
  if (!me) {
    redirect("/login?next=/me");
  }

  const balance = await loadBalance(me);
  const entries = await loadEntries(me);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-3xl">{me}</h1>
          <p className="sc mt-1 text-muted">your side of the book</p>
        </div>
        {balance !== null && (
          <p className="text-right">
            <span className="sc block text-muted">standing</span>
            <span className="amt font-serif text-3xl leading-tight">
              {fmtAmount(balance)}
            </span>
          </p>
        )}
      </div>

      <div className="mt-8">
        <TxnTable
          rows={entries}
          emptyMessage="Nothing has been entered against your name yet. Entries appear the moment a service moves your balance."
        />
      </div>

      <p className="mt-5 text-xs text-muted">
        Balances are read from the{" "}
        <Link href="/ledger" className="underline underline-offset-4">
          whole ledger
        </Link>{" "}
        — every account’s book is open.
      </p>
    </div>
  );
}

/** Balances only live on the user list, so walk it and find ours. */
async function loadBalance(me: string): Promise<number | null> {
  try {
    const users = await getAllUsers();
    const found = users.find((u) => u.username === me);
    return found?.balance ?? null;
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
}

async function loadEntries(me: string): Promise<Txn[] | null> {
  try {
    const all = await fetchAll<Txn>("/transactions", 60, 100);
    return all.filter((t) => t.username === me);
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
}