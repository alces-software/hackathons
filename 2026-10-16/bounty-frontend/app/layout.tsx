import type { Metadata } from "next";
import { Courier_Prime, Newsreader, Oswald } from "next/font/google";
import { Masthead } from "@/components/masthead";
import { SessionProvider } from "@/components/session";
import "./globals.css";

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-courier",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Deadeye · Territorial Bounty Office",
    template: "%s · Deadeye",
  },
  description:
    "A bounty board. Post a bounty with the reward escrowed at the bank, settle it once the work is done.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${newsreader.variable} ${courier.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          <Masthead />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-ink bg-paper-deep/60">
            <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-[0.8rem] leading-relaxed text-ink-soft sm:flex-row sm:items-start sm:justify-between sm:px-6">
              <p className="max-w-md">
                <span className="font-bold uppercase text-ink">
                  Deadeye — Territorial Bounty Office · Houndstooth County, est.
                  1886.
                </span>{" "}
                All rewards posted here are held in escrow by the bank until
                the bounty is settled.
              </p>
              <p className="uppercase tracking-[0.1em]">
                Form B-1 — sign in
                <br />
                Form B-7 — post a bounty
              </p>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}