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
      <div className="text-center">
        <p className="sc text-muted">form s-1 · statement of account</p>
        <h1 className="mt-1 font-serif text-4xl">{me}</h1>
        {standing !== null && (
          <p className="mt-3">
            <span className="sc block text-muted">standing</span>
            <span className="amt font-serif text-4xl leading-tight">
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
        <dl className="sheet mt-8 grid grid-cols-3 px-4 py-3 sm:px-6">
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

      <section className="sheet mx-auto mt-10 max-w-sm p-5 sm:p-6">
        <div className="border-b border-dashed border-rule pb-3 text-center">
          <p className="sc">Change of password</p>
          <p className="mt-1 font-mono text-[0.65rem] text-muted">
            form pw-2 · the old one must check out first
          </p>
        </div>
        <PasswordForm />
      </section>

      <div className="mt-10 border-t border-dashed border-rule pt-4 text-center text-xs leading-relaxed text-muted">
        <p>
          Short of pocket, or flush with it?{" "}
          <Link href="/bank" className="underline underline-offset-4">
            The bank
          </Link>{" "}
          takes loans and repayments,{" "}
          <Link href="/transfer" className="underline underline-offset-4">
            a transfer
          </Link>{" "}
          hands money to another name on the book.
        </p>
        <p className="mt-2">
          Every account’s book is open — yours is also on the{" "}
          <Link href="/ledger" className="underline underline-offset-4">
            whole ledger
          </Link>{" "}
          for anyone to read.
        </p>
      </div>
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
    <div className="text-center">
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