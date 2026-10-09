const amount = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Plain figure, e.g. `412.50` */
export function fmtAmount(n: number): string {
  return Number.isFinite(n) ? amount.format(n) : "—";
}

/** Movement between balances, e.g. `−12.50` or `+30.00` */
export function fmtDelta(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${amount.format(Math.abs(n))}`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Fixed-width timestamp for table rows, e.g. `09 Oct 2026, 14:32` */
export function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFmt.format(d);
}

/** Newest first, used for every table we render. */
export function byTimestampDesc(
  a: { timestamp: string },
  b: { timestamp: string },
): number {
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}