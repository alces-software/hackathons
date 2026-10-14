"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";

type Sym = "moose" | "diamond" | "seven" | "bell" | "cherry" | "lemon";

const symbolEmoji: Record<Sym, string> = { moose: "🫎", diamond: "💎", seven: "7️⃣", bell: "🔔", cherry: "🍒", lemon: "🍋" };

// 24 stops per reel: moose 1, diamond 2, seven 3, bell 4, cherry 6, lemon 8
const strip: Sym[] = [
  "lemon", "cherry", "lemon", "bell", "lemon", "seven", "cherry", "lemon",
  "diamond", "lemon", "cherry", "bell", "lemon", "moose", "cherry", "lemon",
  "bell", "seven", "cherry", "lemon", "diamond", "bell", "cherry", "seven",
];

// Three of a kind pays N:1 (profit). Two matching on reels 1 + 2 returns the bet.
const threeKindPays: Record<Sym, number> = { moose: 110, diamond: 100, seven: 55, bell: 28, cherry: 15, lemon: 7 };
const MAX_MULT = 110;
const paytableOrder: Sym[] = ["moose", "diamond", "seven", "bell", "cherry", "lemon"];

const MAX_BET = 100;
const CELL = 96;
const REELS = 3;
const START_POSITIONS = [0, 8, 16];

const round2 = (value: number) => Math.round(value * 100) / 100;
const mod = (value: number, base: number) => ((value % base) + base) % base;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function randomIndex(maxExclusive: number) {
  const range = 2 ** 32;
  const limit = range - (range % maxExclusive);
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
}

function Reel({ pos, lit }: { pos: number; lit: boolean }) {
  const base = Math.floor(pos);
  const frac = pos - base;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 bg-slate-950 transition-shadow ${lit ? "border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.55)]" : "border-sky-300/30"}`}
      style={{ width: CELL + 8, height: CELL * 3 }}
    >
      {[-1, 0, 1, 2].map((d) => (
        <div key={d} className="absolute inset-x-0 flex items-center justify-center" style={{ height: CELL, top: (1 + frac - d) * CELL, fontSize: 52 }}>
          {symbolEmoji[strip[mod(base + d, strip.length)]]}
        </div>
      ))}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/55" />
    </div>
  );
}

export default function Slots() {
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [pos, setPos] = useState<number[]>(START_POSITIONS);
  const [spinning, setSpinning] = useState(false);
  const [lit, setLit] = useState<boolean[]>([false, false, false]);
  const [message, setMessage] = useState("Set your bet and pull the lever.");
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  async function spin() {
    if (spinning) return;
    const stake = round2(bet);
    if (stake < 1 || stake > MAX_BET || stake > balance) {
      setMessage(stake < 1
        ? "Place a bet of at least 1 moose buck."
        : stake > MAX_BET
          ? `The table limit is ${MAX_BET} moose bucks per spin.`
          : "Not enough balance to cover that bet.");
      return;
    }
    setSpinning(true);
    try {
      await bankingStake(stake, "slots", round2(stake * (MAX_MULT + 1)));
      await syncBankingBalance(setBalance);
    } catch (error) {
      setSpinning(false);
      setMessage(error instanceof Error ? error.message : "Could not place the stake.");
      return;
    }

    // Decide the outcome up front; the animation just lands on it.
    const stops = Array.from({ length: REELS }, () => randomIndex(strip.length));
    const symbols = stops.map((stop) => strip[stop]);
    const triple = symbols[0] === symbols[1] && symbols[1] === symbols[2];
    const pair = !triple && symbols[0] === symbols[1];
    const profit = triple ? round2(stake * threeKindPays[symbols[0]]) : pair ? 0 : -stake;

    const starts = pos.map((value) => Math.round(value));
    const travels = stops.map((stop, i) => strip.length * (2 + i) + mod(stop - starts[i], strip.length));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const durations = Array.from({ length: REELS }, (_, i) => (reduced ? 600 + i * 200 : 2000 + i * 650));

    setLit([false, false, false]);
    setMessage("Reels are spinning...");

    const start = performance.now();
    const tick = (now: number) => {
      const progress = durations.map((duration) => Math.min(1, (now - start) / duration));
      setPos(starts.map((from, i) => from + travels[i] * easeOut(progress[i])));
      if (progress.some((p) => p < 1)) {
        frame.current = requestAnimationFrame(tick);
        return;
      }

      const line = symbols.map((s) => symbolEmoji[s]).join(" ");
      if (profit > 0) {
        setLit([true, true, true]);
        bankingReturn(stake).then(() => bankingPayout(profit)).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage(`${line} — three ${symbols[0]}s! ${profit.toFixed(2)} profit + ${stake.toFixed(2)} stake returned = ${round2(profit + stake).toFixed(2)} moose bucks credited.`);
        }).catch((error) => setMessage(error instanceof Error ? error.message : "Payout failed.")).finally(() => setSpinning(false));
      } else if (profit === 0) {
        setLit([true, true, false]);
        bankingReturn(stake).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage(`${line} — a pair on the first two reels. Your ${stake.toFixed(2)} stake was returned.`);
        }).catch((error) => setMessage(error instanceof Error ? error.message : "Stake could not be returned.")).finally(() => setSpinning(false));
      } else {
        bankingReturn(stake).then(() => bankingLoss(stake)).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage(`${line} — no match. ${stake.toFixed(2)} moose bucks lost.`);
        }).catch((error) => setMessage(error instanceof Error ? error.message : "Loss could not be recorded.")).finally(() => setSpinning(false));
      }
    };
    frame.current = requestAnimationFrame(tick);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino floor</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Moose Slots</h1><p className="mt-2 text-sm text-sky-100/65">Three reels · One payline · Return to player 96.2%</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Settlements are processed through your connected banking account.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_280px]">
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-emerald-300/10 bg-[#0a3a36]/70 p-6">
              <div className="rounded-3xl border-4 border-amber-400/80 bg-gradient-to-b from-[#12335a] to-[#071426] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                <div className="relative flex gap-2" role="img" aria-label="Slot machine reels">
                  {pos.map((value, index) => <Reel key={index} pos={value} lit={lit[index]} />)}
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500/70" style={{ top: CELL * 1.5 }} />
                  <div className="pointer-events-none absolute -left-3 z-10 h-0 w-0 border-y-[7px] border-l-[10px] border-y-transparent border-l-red-500" style={{ top: CELL * 1.5 - 7 }} />
                  <div className="pointer-events-none absolute -right-3 z-10 h-0 w-0 border-y-[7px] border-r-[10px] border-y-transparent border-r-red-500" style={{ top: CELL * 1.5 - 7 }} />
                </div>
              </div>
              <p className="mt-6 min-h-6 text-center text-sm font-semibold text-sky-100">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <label htmlFor="slots-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet per spin</label>
                <div className="mt-2 flex items-center gap-2">
                  <input id="slots-bet" type="number" min="1" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={spinning} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" />
                  <span className="text-sm text-sky-100/65">moose bucks</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[10, 25, 50, MAX_BET].map((amount) => (
                    <button key={amount} onClick={() => setBet(amount)} disabled={spinning} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${bet === amount ? "border-sky-300 bg-sky-300/20 text-sky-100" : "border-white/15 text-sky-100/70 hover:bg-white/10"}`}>{amount === MAX_BET ? "Max" : amount}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-sky-100/45">Table limit: {MAX_BET} moose bucks per spin</p>
              </div>
              <button onClick={spin} disabled={spinning} className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">{spinning ? "Spinning..." : "Spin the reels"}</button>
              <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Paytable</p>
                <ul className="mt-2 space-y-1.5 text-sm text-sky-100">
                  {paytableOrder.map((sym) => (
                    <li key={sym} className="flex items-center justify-between"><span>{symbolEmoji[sym]} {symbolEmoji[sym]} {symbolEmoji[sym]}</span><span className="font-bold text-sky-300">{threeKindPays[sym]}:1</span></li>
                  ))}
                  <li className="flex items-center justify-between border-t border-white/10 pt-1.5 text-xs text-sky-100/70"><span>Matching pair on reels 1 + 2</span><span className="font-bold text-sky-300">Bet back</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}