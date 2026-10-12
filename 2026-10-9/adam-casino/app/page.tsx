import Link from "next/link";
import AccountStatus from "./components/AccountStatus";

const games = [
  { name: "Blackjack", description: "Beat the dealer and get as close to 21 as you can.", icon: "21", accent: "from-sky-300 to-blue-600", href: "/blackjack" },
  { name: "Roulette", description: "Place your bets, spin the wheel, and trust your luck.", icon: "0", accent: "from-blue-300 to-indigo-600", href: "/roulette" },
  { name: "UNO", description: "Match colors, stack cards, and be first to shout UNO.", icon: "UNO", accent: "from-indigo-300 to-violet-600", href: "/uno" },
  { name: "Minesweeper", description: "Reveal safe tiles, avoid the mines, and clear the board.", icon: "💣", accent: "from-emerald-300 to-teal-600", href: "/minesweeper" },
  { name: "Plinko", description: "Drop your chip and watch it bounce toward the big prize.", icon: "●", accent: "from-violet-300 to-purple-600", href: "/plinko" },
  { name: "Crash", description: "Ride the multiplier higher, then cash out before it crashes.", icon: "↗", accent: "from-orange-300 to-red-600", href: "/crash" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,_rgba(37,99,235,0.4),_transparent_32%),radial-gradient(circle_at_0%_70%,_rgba(14,116,144,0.22),_transparent_36%)]" />
      <div className="pointer-events-none absolute -right-32 top-28 h-80 w-80 rounded-full border border-sky-300/10 sm:h-96 sm:w-96" />
      <div className="pointer-events-none absolute -right-20 top-40 h-64 w-64 rounded-full border border-sky-300/10 sm:h-80 sm:w-80" />
      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Alces Casino home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400 text-2xl text-[#071426] shadow-[0_0_24px_rgba(56,189,248,0.3)]">🫎</span>
          <span className="font-serif text-xl font-bold tracking-wide">Alces Casino</span>
        </Link>
        <div className="flex items-center gap-3">
          <AccountStatus />
        </div>
      </nav>
      <section className="relative mx-auto max-w-7xl px-6 pb-16 pt-12 lg:px-10 lg:pt-16">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_360px]">
          <div className="max-w-2xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-sky-300">Welcome to the herd</p>
            <h1 className="font-serif text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl">Find your edge<span className="block text-sky-300">at the table.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-sky-100/65 sm:text-lg">A winter lodge of classic casino games, quick rounds, and big moments. Pick a table and make your move.</p>
          </div>
        </div>
        <div id="games" className="mt-20 scroll-mt-8">
          <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300/70">The lodge</p><h2 className="mt-2 font-serif text-3xl font-bold">Choose your game</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <Link key={game.name} href={game.href} className="group relative flex min-h-60 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-sky-300/50 hover:bg-white/[0.1] hover:shadow-sky-950/40">
                <div><span aria-hidden="true" className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${game.accent} ${game.name === "UNO" ? "text-base tracking-tight" : "text-3xl"} font-serif font-bold text-white shadow-lg transition duration-300 group-hover:scale-105`}>{game.icon}</span></div>
                <div><h3 className="font-serif text-2xl font-bold">{game.name}</h3><p className="mt-2 text-sm leading-5 text-sky-100/65">{game.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-sky-300 transition group-hover:gap-3">Play now <span aria-hidden="true">→</span></span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <footer className="relative mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/10 px-6 py-7 text-xs text-sky-100/55 sm:flex-row sm:items-center sm:justify-between lg:px-10"><span>© 2026 Alces Casino</span><span>Play responsibly · 18+</span></footer>
    </main>
  );
}
