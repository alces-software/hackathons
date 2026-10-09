import type { Txn } from "@/lib/api";
import { byTimestampDesc, fmtAmount, fmtTimestamp } from "@/lib/format";

type Props = {
  rows: Txn[] | null;
  emptyMessage?: string;
};

export function TxnTable({ rows, emptyMessage }: Props) {
  if (rows === null) {
    return (
      <div className="border border-rule bg-paper-2 px-4 py-6 text-sm text-muted">
        The ledger core is unreachable, so no entries can be shown. Check{" "}
        <code className="font-mono text-[0.8em]">API_URL</code> in{" "}
        <code className="font-mono text-[0.8em]">.env</code> and that the core
        is running.
      </div>
    );
  }

  const txns = [...rows].sort(byTimestampDesc);

  if (txns.length === 0) {
    return (
      <div className="border border-dashed border-rule px-4 py-6 text-sm text-muted">
        {emptyMessage ?? "Nothing has been entered yet."}
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="sc text-muted">
          {["Date", "Account", "Service", "Debit", "Credit", "Balance"].map(
            (h, i) => (
              <th
                key={h}
                className={`border-b border-ink py-1.5 font-medium ${
                  i >= 3 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {txns.map((t, i) => {
          const delta = t.after - t.before;
          const debit = delta < 0 ? -delta : 0;
          const credit = delta > 0 ? delta : 0;
          return (
            <tr key={i} className="border-b border-rule/70">
              <td className="whitespace-nowrap py-2 font-mono text-xs text-muted">
                {fmtTimestamp(t.timestamp)}
              </td>
              <td className="pe-4 py-2 font-medium">{t.username}</td>
              <td className="pe-4 py-2 text-muted">{t.service?.name ?? "—"}</td>
              <td className="amt whitespace-nowrap py-2 text-right text-debit">
                {debit ? `(${fmtAmount(debit)})` : ""}
              </td>
              <td className="amt whitespace-nowrap py-2 text-right text-credit">
                {credit ? fmtAmount(credit) : ""}
              </td>
              <td className="amt whitespace-nowrap py-2 text-right">
                {fmtAmount(t.after)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}