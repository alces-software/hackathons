import Link from "next/link";
import type { ReactNode } from "react";

export function WireLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="mx-auto max-w-xl border border-ink/40 px-6 py-20 text-center"
    >
      <p className="text-[0.9rem] font-bold uppercase tracking-[0.14em] text-ink-soft">
        {label}
        <span className="dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  );
}

export function WireErrorNote({
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-xl border border-oxblood px-6 py-7 text-center"
    >
      <p className="label text-oxblood">Request failed</p>
      <p className="mt-2 text-[0.95rem]">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn mt-5">
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptySlip({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl border border-ink px-6 py-12 text-center">
      <p className="font-display text-[1.7rem] font-semibold uppercase leading-tight tracking-[0.08em]">
        {title}
      </p>
      <p className="mx-auto mt-3 max-w-sm text-[0.9rem] text-ink-soft">
        {body}
      </p>
      {children && <div className="mt-7">{children}</div>}
    </div>
  );
}

export function SheetNav({
  page,
  totalPages,
  busy,
  onMove,
}: {
  page: number;
  totalPages: number;
  busy: boolean;
  onMove: (page: number) => void;
}) {
  const last = Math.max(1, totalPages);
  if (last <= 1) return null;
  return (
    <nav
      className="mt-12 flex items-center justify-center gap-5 pb-16"
      aria-label="Pages"
    >
      <button
        type="button"
        className="btn-ghost btn-sm"
        disabled={page <= 1 || busy}
        onClick={() => onMove(page - 1)}
      >
        ← Previous
      </button>
      <p className="label">
        Page {page} of {last}
      </p>
      <button
        type="button"
        className="btn-ghost btn-sm"
        disabled={page >= last || busy}
        onClick={() => onMove(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}

export function GateSlip({
  title,
  body,
  href,
  action,
}: {
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <div className="mx-auto max-w-xl border border-ink px-6 py-12 text-center">
      <p className="font-display text-[1.7rem] font-semibold uppercase leading-tight tracking-[0.08em]">
        {title}
      </p>
      <p className="mx-auto mt-3 max-w-sm text-[0.9rem] text-ink-soft">
        {body}
      </p>
      <Link href={href} className="btn mt-7">
        {action}
      </Link>
    </div>
  );
}