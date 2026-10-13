import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, fetchAll, ApiError, type Txn, type User } from "@/lib/api";
import { getSession } from "@/lib/session";
import { fmtAmount } from "@/lib/format";
import { TxnTable } from "@/components/txn-table";
import { PasswordForm } from "@/components/password-form";

export const metadata = { title: "Your account" };

export default async function MePage() {
  const me = await getSession();
  if (!me) {
    redirect("/login?next=/me");
  }

  const standing = await loadStanding(me);
  const entries = await loadEntries(me);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-serif text-3xl">{me}</h1>
          <p className="sc mt-1 text-muted">your side of the book</p>
        </div>
        {standing !== null && (
          <p className="text-right">
            <span className="sc block text-muted">standing</span>
            <span className="amt font-serif text-3xl leading-tight">
              {fmtAmount(standing.balance)}
            </span>
            {standing.debt > 0 && (
              <span className="amt block text-xs text-debit">
                owes the bank {fmtAmount(standing.debt)}
              </span>
            )}
          </p>
        )}
      </div>

      {standing !== null && (
        <dl className="mt-6 grid grid-cols-3 gap-x-6 border-t border-rule pt-3 sm:max-w-md">
          <Stat label="winnings" value={standing.winnings} tone="credit" />
          <Stat label="losses" value={standing.loses} tone="debit" />
          <Stat label="bank debt" value={standing.debt} tone="debit" />
        </dl>
      )}

      <div className="mt-8">
        <TxnTable
          rows={entries}
          emptyMessage="Nothing has been entered against your name yet. Entries appear the moment a service moves your balance."
        />
      </div>

      <section className="mt-8 max-w-sm border-t border-rule pt-6">
        <h2 className="sc font-serif text-lg">Change your password</h2>
        <p className="mt-1 text-xs text-muted">
          The core holds one password per account — this swaps it, once the
          current one checks out.
        </p>
        <PasswordForm />
      </section>

      <p className="mt-6 text-xs text-muted">
        Short of pocket, or flush with it?{" "}
        <Link href="/bank" className="underline underline-offset-4">
          The bank
        </Link>{" "}
        takes loans and repayments, and{" "}
        <Link href="/transfer" className="underline underline-offset-4">
          a transfer
        </Link>{" "}
        hands money to another name on the book.
      </p>
      <p className="mt-2 text-xs text-muted">
        Balances are read from the{" "}
        <Link href="/ledger" className="underline underline-offset-4">
          whole ledger
        </Link>{" "}
        — every account’s book is open.
      </p>
    </div>
  );
}

/** The core hands out a single account's facts straight off
 *  GET /users/{username} — no walking the list. */
async function loadStanding(me: string): Promise<User | null> {
  try {
    return await getUser(me);
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "credit" | "debit";
}) {
  return (
    <div>
      <dt className="sc text-muted">{label}</dt>
      <dd
        className={`amt mt-0.5 ${
          tone === "credit" ? "text-credit" : tone === "debit" ? "text-debit" : ""
        }`}
      >
        {fmtAmount(value)}
      </dd>
    </div>
  );
}