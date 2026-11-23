"use client";

import Link from "next/link";

const cabinets = [
  {
    name: "Whack-a-Mole",
    icon: "🫎",
    accent: "from-amber-300 to-orange-600",
    description: "One stake buys three pops at a steady rhythm. A plastic mole prints 21% of your stake, a golden moose prints 80%.",
    href: "/whack-a-mole",
  },
  {
    name: "Basketball Hoops",
    icon: "🏀",
    accent: "from-sky-300 to-orange-600",
    description: "Buy in for thirty seconds and five balls. Tap the drifting rim — a rim tap prints 16% of your buy-in, a clean swish prints 35%.",
    href: "/basketball",
  },
];

export default function Arcade() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.2),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.16),_transparent_35%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-2xl text-[#071426]">🫎</span>
          <span className="font-serif text-xl font-bold">Alces Casino</span>
        </Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">← Back to the floor</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 lg:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Side room</p>
        <h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">The Alces Arcade</h1>
        <p className="mt-3 max-w-2xl text-sm text-sky-100/65">Ticket cabinets tucked behind the main floor. They look like fairground skill games and play like them too — feed in moose bucks, beat the machine, and it prints back what it decides your shots were worth.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {cabinets.map((cabinet) => (
            <Link
              key={cabinet.href}
              href={cabinet.href}
              className="group rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow-lg ${cabinet.accent}`}>{cabinet.icon}</div>
              <h2 className="mt-4 font-serif text-2xl font-bold group-hover:text-amber-200">{cabinet.name}</h2>
              <p className="mt-2 text-sm leading-6 text-sky-100/65">{cabinet.description}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-amber-300/80">Play the cabinet →</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
