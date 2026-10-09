import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  itemTotal: number;
  basePath: string;
};

function pageHref(basePath: string, p: number) {
  return p === 1 ? basePath : `${basePath}?page=${p}`;
}

/** Links around the current page, plus the ends, with ellipses between. */
function windowPages(current: number, total: number): (number | "…")[] {
  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  for (let p = current - 3; p <= current + 3; p++) {
    if (p > 1 && p < total) wanted.add(p);
  }
  const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function PageNav({ page, totalPages, itemTotal, basePath }: Props) {
  if (totalPages <= 1) {
    return (
      <p className="sc mt-4 text-muted">
        {itemTotal} {itemTotal === 1 ? "entry" : "entries"} in the book
      </p>
    );
  }

  return (
    <nav className="mt-5 flex items-center justify-between border-t border-rule pt-3">
      <p className="sc text-muted">
        Page {page} of {totalPages} · {itemTotal} entries
      </p>
      <div className="flex items-center gap-1 text-sm">
        {page > 1 && (
          <Link className="px-2 py-1 hover:underline" href={pageHref(basePath, page - 1)}>
            ←
          </Link>
        )}
        {windowPages(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-muted">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={pageHref(basePath, p)}
              aria-current={p === page ? "page" : undefined}
              className={`px-2 py-1 font-mono tabular-nums ${
                p === page
                  ? "bg-ink text-paper"
                  : "text-muted hover:text-ink hover:underline"
              }`}
            >
              {p}
            </Link>
          ),
        )}
        {page < totalPages && (
          <Link className="px-2 py-1 hover:underline" href={pageHref(basePath, page + 1)}>
            →
          </Link>
        )}
      </div>
    </nav>
  );
}