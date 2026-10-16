import type { Txn } from "@/lib/api";
import { byTimestampAsc, fmtTimestamp } from "@/lib/format";

type Props = {
  rows: Txn[] | null;
  emptyMessage?: string;
  /** Newest first — how the teaser and the ledger itself read. */
  newestFirst?: boolean;
};

export function TxnTable({ rows, emptyMessage, newestFirst }: Props) {
  if (rows === null) {
    return (
      <div className="sheet px-4 py-6 text-sm text-muted">
        The ledger core is unreachable, so no entries can be shown. Check{" "}
        <code className="font-mono text-[0.8em]">API_URL</code> in{" "}
        <code className="font-mono text-[0.8em]">.env</code> and that the core
        is running.
      </div>
    );
  }

  const txns = [...rows].sort(byTimestampAsc);
  if (newestFirst) txns.reverse();

  if (txns.length === 0) {
    return (
      <div className="border border-dashed border-rule px-4 py-6 text-sm text-muted">
        {emptyMessage ?? "Nothing has been entered yet."}
      </div>
    );
  }

  return (
    <div className="sheet overflow-x-auto px-3 py-2 sm:px-4 sm:py-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="sc text-muted">
            {["Date", "From", "To", "Service"].map((h) => (
              <th
                key={h}
                className="border-b border-ink pb-1.5 pt-1 text-left font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txns.map((t, i) => (
            <tr
              key={t.id ?? i}
              className="border-b border-rule/70 last:border-b-0 hover:bg-paper"
            >
              <td className="whitespace-nowrap py-2 font-mono text-xs text-muted">
                {fmtTimestamp(t.createdAt)}
              </td>
              <td className="pe-4 py-2 font-medium">{t.sender ?? "—"}</td>
              <td className="pe-4 py-2 font-medium">{t.receiver ?? "—"}</td>
              <td className="pe-4 py-2 font-serif italic text-muted">
                {t.service?.name ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}