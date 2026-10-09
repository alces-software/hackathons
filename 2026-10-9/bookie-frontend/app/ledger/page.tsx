import { getTransactions, ApiError, type Txn } from "@/lib/api";
import { TxnTable } from "@/components/txn-table";
import { PageNav } from "@/components/pagination";
import { LiveLedger } from "@/components/live-ledger";

export const metadata = { title: "The ledger" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LedgerPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);

  let data: {
    rows: Txn[];
    totalPages: number;
    itemTotal: number;
  } | null = null;
  try {
    const res = await getTransactions(page, 25);
    data = {
      rows: res.data,
      totalPages: res.totalPages,
      itemTotal: res.itemTotal,
    };
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    data = null;
  }

  return (
    <div>
      <LiveLedger />
      <h1 className="font-serif text-3xl">The ledger</h1>
      <p className="sc mt-1 text-muted">every entry, newest first</p>

      <div className="mt-8">
        <TxnTable
          rows={data?.rows ?? null}
          emptyMessage={
            data !== null && page > 1
              ? "Nothing on this page — turn back."
              : "The book is blank — no service has made an entry yet."
          }
        />
      </div>

      {data !== null && (
        <PageNav
          page={page}
          totalPages={data.totalPages}
          itemTotal={data.itemTotal}
          basePath="/ledger"
        />
      )}
    </div>
  );
}