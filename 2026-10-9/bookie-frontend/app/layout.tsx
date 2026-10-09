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
        <header className="border-b-2 border-ink">
          <div className="mx-auto w-full max-w-3xl px-5 pt-7">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <Link href="/" className="font-serif text-4xl leading-none">
                Bookie
              </Link>
              <p className="sc text-muted">
                a running account of who spent what
              </p>
            </div>
            <nav className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-rule py-2 text-sm">
              <div className="flex gap-5">
                <Link href="/ledger" className={link}>
                  The ledger
                </Link>
                <Link href="/exchange" className={link}>
                  The exchange
                </Link>
                <Link href="/me" className={link}>
                  Your account
                </Link>
              </div>
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">{user}</span>
                  <SignOutButton />
                </div>
              ) : (
                <div className="flex gap-5">
                  <Link href="/login" className={link}>
                    Sign in
                  </Link>
                  <Link href="/signup" className={link}>
                    Open an account
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-3xl px-5 py-10">{children}</div>
        </main>

        <footer className="border-t border-rule">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-5">
            <p className="sc text-muted">Bookie</p>
            <p className="text-xs text-muted">
              Every line accounted for.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}