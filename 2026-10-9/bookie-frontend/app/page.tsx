import Link from "next/link";
import {
  getTransactions,
  getUsers,
  ApiError,
  type Txn,
  type User,
} from "@/lib/api";
import { fmtAmount } from "@/lib/format";
import { TxnTable } from "@/components/txn-table";
import { PageNav } from "@/components/pagination";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const accountsPage = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);

  let latest: Txn[] | null = null;
  let users: User[] | null = null;
  let userTotal = 0;
  let userPages = 1;

  try {
    const [t, u] = await Promise.all([loadLatestEntries(), getUsers(accountsPage, 12)]);
    latest = t;
    users = u.data;
    userTotal = u.itemTotal;
    userPages = u.totalPages;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    latest = null;
    users = null;
  }

  const hairline = <div className="h-px flex-1 bg-rule" />;

  return (
    <div className="space-y-12">
      <p className="mx-auto max-w-xl text-center font-serif text-xl italic leading-relaxed">
        Bookie keeps a single ledger of every payment made through the core.
        Open an account, put your name on the book, and watch your line of the
        story accumulate below.
      </p>

      <section>
        <div className="flex items-center gap-4">
          <h2 className="sc whitespace-nowrap">Latest entries</h2>
          {hairline}
          <Link
            href="/ledger"
            className="whitespace-nowrap text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            the whole ledger →
          </Link>
        </div>
        <div className="mt-4">
          <TxnTable
            rows={latest}
            newestFirst
            emptyMessage="The book is blank — no service has made an entry yet."
          />
        </div>
      </section>

      <section>
        <div className="flex items-center gap-4">
          <h2 className="sc whitespace-nowrap">The register</h2>
          {hairline}
          <span className="whitespace-nowrap text-xs text-muted">
            {users !== null ? `${userTotal} on the book` : "—"}
          </span>
        </div>
        {users === null ? (
          <p className="mt-4 text-sm text-muted">
            Names and balances can’t be read right now.
          </p>
        ) : users.length === 0 ? (
          accountsPage > 1 ? (
            <p className="mt-4 text-sm text-muted">
              Nothing on this page — turn back.
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Nobody has signed the book yet.{" "}
              <Link href="/signup" className="underline underline-offset-4">
                Open the first account
              </Link>
              .
            </p>
          )
        ) : (
          <>
            <ul className="sheet mt-4 divide-y divide-rule px-3 sm:px-4">
              {users.map((u, i) => (
                <li
                  key={u.username}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                >
                  <span className="flex min-w-0 items-baseline gap-4">
                    <span className="flex-shrink-0 font-mono text-xs text-muted">
                      № {(accountsPage - 1) * 12 + i + 1}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {u.username}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-baseline gap-3">
                    {u.debt > 0 && (
                      <span className="amt whitespace-nowrap text-xs text-debit">
                        owes {fmtAmount(u.debt)}
                      </span>
                    )}
                    <span className="amt text-sm">{fmtAmount(u.balance)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <PageNav
              page={accountsPage}
              totalPages={userPages}
              itemTotal={userTotal}
              basePath="/"
              noun="account"
            />
          </>
        )}
      </section>
    </div>
  );
}

/** The core reads newest-first now, so the freshest entries are simply the
 *  first page — no more peeking at the end of the book to find it. */
async function loadLatestEntries(): Promise<Txn[]> {
  return (await getTransactions(1, 8, "desc")).data;
}