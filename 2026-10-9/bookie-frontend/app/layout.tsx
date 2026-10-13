import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, Spline_Sans_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/session";
import { SignOutButton } from "@/components/signout";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans-src",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif-src",
});

const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono-src",
});

export const metadata: Metadata = {
  title: {
    default: "Bookie — a book of accounts",
    template: "%s · Bookie",
  },
  description: "Who spent what, written down where everyone can read it.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSession();

  const link =
    "underline-offset-4 decoration-rule hover:decoration-ink hover:underline";

  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header>
          <div className="mx-auto w-full max-w-3xl px-5 pt-6">
            <div className="flex items-baseline justify-between text-[0.62rem] tracking-[0.18em] uppercase text-muted">
              <span>Est. the hackathon</span>
              <span>The window is open while the lights are on</span>
            </div>

            <Link
              href="/"
              className="mt-4 block text-center font-serif text-6xl leading-none"
            >
              Bookie
            </Link>
            <p className="sc mt-2 text-center text-muted">
              A book of accounts · kept in ink · open to all
            </p>

            <div className="rule-double mt-5" />
            <nav className="sc flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 border-y border-rule py-2.5 text-sm">
              <Link href="/ledger" className={link}>
                The ledger
              </Link>
              <Link href="/exchange" className={link}>
                The exchange
              </Link>
              <Link href="/bank" className={link}>
                The bank
              </Link>
              <Link href="/transfer" className={link}>
                Transfers
              </Link>
              <Link href="/me" className={link}>
                Your account
              </Link>
              <span className="text-muted">·</span>
              {user ? (
                <span className="inline-flex items-baseline gap-3 text-muted">
                  at the window:{" "}
                  <span className="font-mono text-xs normal-case tracking-normal text-ink">
                    {user}
                  </span>
                  <SignOutButton />
                </span>
              ) : (
                <span className="inline-flex items-baseline gap-4 text-muted">
                  <Link href="/login" className={link}>
                    Present yourself
                  </Link>
                  <Link href="/signup" className={link}>
                    Open an account
                  </Link>
                </span>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1 border-b border-rule">
          <div className="mx-auto w-full max-w-3xl px-5 py-10">{children}</div>
        </main>

        <footer>
          <div className="mx-auto w-full max-w-3xl px-5 py-6 text-center">
            <p className="sc text-sm">Bookie — the office</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Member of no institution · no deposit guaranteed · entries are
              written in ink and are never struck out
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}