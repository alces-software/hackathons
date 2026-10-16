import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-col items-center px-4 py-28 text-center sm:px-6">
      <span className="stamp rotate-[-4deg] text-oxblood">404</span>
      <h1 className="font-display mt-7 text-4xl font-semibold uppercase tracking-[0.06em]">
        Page not found
      </h1>
      <p className="mt-3 max-w-sm text-[0.95rem] text-ink-soft">
        That page doesn’t exist. The bounty board, however, is one click away.
      </p>
      <Link href="/" className="btn mt-9">
        Back to the board
      </Link>
    </main>
  );
}