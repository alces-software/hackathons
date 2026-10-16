/** Reward-style figure: $2,500 or $2,500.50. */
export function fmtMoney(amount: number): string {
  return (
    "$" +
    amount.toLocaleString("en-US", { maximumFractionDigits: 2 })
  );
}

/** Counter-stamp date: OCT 16, 2026. Unreadable dates render as an em dash. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

/** Small zero-padded form number: Nº 0007. */
export function fmtNumber(n: number): string {
  return String(n).padStart(4, "0");
}