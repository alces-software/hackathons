import Link from "next/link";
import { getTransactions, getUsers, ApiError, type Txn, type User } from "@/lib/api";
import { fmtAmount } from "@/lib/format";
import { TxnTable } from "@/components/txn-table";

export default async function HomePage() {
  let recent: Txn[] | null = null;
  let users: User[] | null = null;
  let userTotal = 0;

  try {
    const [t, u] = await Promise.all([
      getTransactions(1, 8),
      getUsers(1, 12),
    ]);
    recent = t.data;
    users = u.data;
    userTotal = u.itemTotal;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    recent = null;
    users = null;
  }

  return (
    <div className="space-y-12">
      <section>
        <p className="max-w-xl text-[0.95rem] leading-relaxed text-muted">
          Bookie keeps a single ledger of every payment made through the core.
          Open an account, put your name on the book, and watch your line of
          the story accumulate below.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="sc">Latest entries</h2>
          <Link
            href="/ledger"
            className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            the whole ledger →
          </Link>
        </div>
        <div className="mt-4">
          <TxnTable
            rows={recent}
            emptyMessage="The book is blank — no service has made an entry yet."
          />
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-4">
          <h2 className="sc">Accounts</h2>
          <span className="text-xs text-muted">
            {users !== null
              ? `${userTotal} on the book`
              : "—"}
          </span>
        </div>
        {users === null ? (
          <p className="mt-4 text-sm text-muted">
            Names and balances can’t be read right now.
          </p>
        ) : users.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nobody has signed the book yet.{" "}
            <Link href="/signup" className="underline underline-offset-4">
              Open the first account
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-rule/70 border-t border-b border-rule/70">
            {users.map((u) => (
              <li
                key={u.username}
                className="flex items-baseline justify-between gap-4 py-1.5"
              >
                <span className="text-sm font-medium">{u.username}</span>
                <span className="amt text-sm">{fmtAmount(u.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}