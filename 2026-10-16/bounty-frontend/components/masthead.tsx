"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StarMark } from "@/components/icons";
import { useClerk } from "@/components/session";

const NAV = [
  { href: "/", label: "Postings" },
  { href: "/settled", label: "Settled" },
  { href: "/register", label: "Register" },
  { href: "/file", label: "Post a bounty" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Masthead() {
  const pathname = usePathname();
  const { clerk, ready, signOut } = useClerk();

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur-[3px]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <StarMark className="h-3.5 w-3.5 -rotate-12 text-oxblood transition-transform duration-200 group-hover:rotate-12" />
          <span className="flex flex-col gap-[3px]">
            <span className="font-display text-[1.55rem] font-semibold leading-none tracking-[0.26em]">
              DEADEYE
            </span>
            <span className="label text-[0.62rem]">
              Territorial Bounty Office · Est. 1886
            </span>
          </span>
        </Link>

        <nav
          className="ms-auto flex flex-wrap items-center gap-x-5 gap-y-2"
          aria-label="The office"
        >
          {NAV.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`text-[0.76rem] font-bold uppercase tracking-[0.14em] ${
                  active
                    ? "text-oxblood underline decoration-2 underline-offset-[5px]"
                    : "hover:text-oxblood"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {ready && clerk === null && (
            <Link
              href={
                pathname === "/" || pathname.startsWith("/sign-in")
                  ? "/sign-in"
                  : `/sign-in?then=${encodeURIComponent(pathname)}`
              }
              className="btn btn-sm"
            >
              Sign in
            </Link>
          )}
          {ready && clerk !== null && (
            <span className="flex items-center gap-3">
              <span className="label">
                Signed in as <span className="text-ink">{clerk.username}</span>
              </span>
              <button
                type="button"
                onClick={signOut}
                className="btn-ghost btn-sm"
              >
                Sign out
              </button>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
