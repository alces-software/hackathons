"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bankingPayout, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";

type BetType = "red" | "black" | "odd" | "even" | "number";

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);


const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const tableNumbers = Array.from({ length: 37 }, (_, number) => number);

const STEP = 360 / 37;
const C = 170; 
const TRACK_R = 138; 
const REST_R = 114; 
const SPIN_MS = 6500;

function numberColor(number: number) {
  if (number === 0) return "green";
  return redNumbers.has(number) ? "red" : "black";
}

function polar(radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  const round = (value: number) => Math.round(value * 100) / 100;
  return [round(C + radius * Math.sin(rad)), round(C - radius * Math.cos(rad))] as const;
}

function wedge(index: number, inner: number, outer: number) {
  const a0 = (index - 0.5) * STEP;
  const a1 = (index + 0.5) * STEP;
  const [ox0, oy0] = polar(outer, a0);
  const [ox1, oy1] = polar(outer, a1);
  const [ix1, iy1] = polar(inner, a1);
  const [ix0, iy0] = polar(inner, a0);
  return `M${ox0} ${oy0} A${outer} ${outer} 0 0 1 ${ox1} ${oy1} L${ix1} ${iy1} A${inner} ${inner} 0 0 0 ${ix0} ${iy0} Z`;
}

const mod = (value: number, base: number) => ((value % base) + base) % base;
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

const pocketFill = { red: "#b91c1c", black: "#111827", green: "#047857" } as const;

export default function Roulette() {
  const MAX_BET = 250;
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [betType, setBetType] = useState<BetType>("red");
  const [number, setNumber] = useState(17);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [message, setMessage] = useState("Choose a bet and spin the wheel.");
  const [spinning, setSpinning] = useState(false);
  const [view, setView] = useState({ wheel: 0, ball: 0, radius: TRACK_R });
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  async function spin() {
    if (spinning) return;
    if (bet < 1 || bet > MAX_BET || bet > balance) {
      setMessage(`Choose a bet between 1 and ${MAX_BET} moose bucks within your available balance.`);
      return;
    }
    setSpinning(true);
    try {
      await bankingStake(bet);
      await syncBankingBalance(setBalance);
    } catch (error) {
      setSpinning(false);
      setMessage(error instanceof Error ? error.message : "Could not place the stake.");
      return;
    }
    const outcome = Math.floor(Math.random() * 37);
    const wins = betType === "red"
      ? numberColor(outcome) === "red"
      : betType === "black"
        ? numberColor(outcome) === "black"
        : betType === "odd"
          ? outcome !== 0 && outcome % 2 === 1
          : betType === "even"
            ? outcome !== 0 && outcome % 2 === 0
            : outcome === number;
    const multiplier = betType === "number" ? 35 : 1;
    const profit = wins ? bet * multiplier : -bet;
    const returned = wins ? bet * (multiplier + 1) : 0;
    const stake = bet;

    const target = wheelOrder.indexOf(outcome) * STEP;
    const wheelStart = view.wheel;
    const wheelTravel = 360 * (3 + Math.random() * 1.5);
    const ballOffset = mod(view.ball - wheelStart - target, 360) + 360 * 9; 
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 1500 : SPIN_MS;

    setMessage("No more bets — the wheel is spinning...");

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      const wheel = wheelStart + wheelTravel * eased;
      const ball = wheel + target + ballOffset * (1 - eased);
      let radius = TRACK_R - (TRACK_R - REST_R) * smooth((p - 0.55) / 0.3);
      if (p > 0.85) {
        const q = (p - 0.85) / 0.15;
        radius += 8 * (1 - q) ** 2 * Math.abs(Math.sin(q * Math.PI * 3)); 
      }
      setView({ wheel, ball, radius });
      if (p < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      setResult(outcome);
      setHistory((current) => [outcome, ...current].slice(0, 12));
      if (returned > 0) {
        bankingPayout(returned).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage(`${outcome} ${numberColor(outcome)} — won ${profit.toFixed(2)} profit + ${stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.`);
        }).catch((error) => setMessage(error instanceof Error ? error.message : "Payout failed.")).finally(() => setSpinning(false));
      } else {
        setMessage(`${outcome} ${numberColor(outcome)} — ${stake.toFixed(2)} stake lost.`);
        setSpinning(false);
      }
    };
    frame.current = requestAnimationFrame(tick);
  }

  const [ballX, ballY] = polar(view.radius, view.ball);
  const resultFill = result === null ? "#7dd3fc" : numberColor(result) === "red" ? "#f87171" : numberColor(result) === "green" ? "#34d399" : "#e0f2fe";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino table</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Roulette</h1><p className="mt-2 text-sm text-sky-100/65">European single-zero wheel · 37 pockets · True casino payouts</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Settlements are processed through your connected banking account.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_280px]">
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-emerald-300/10 bg-[#0a3a36]/70 p-6">
              <svg viewBox="0 0 340 340" role="img" aria-label="European roulette wheel" className="h-auto w-full max-w-[360px] drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                <defs>
                  <radialGradient id="rw-wood" cx="50%" cy="50%" r="50%"><stop offset="85%" stopColor="#6b4423" /><stop offset="100%" stopColor="#2a1608" /></radialGradient>
                  <radialGradient id="rw-track" cx="50%" cy="50%" r="50%"><stop offset="80%" stopColor="#0b1d33" /><stop offset="100%" stopColor="#1e3a5f" /></radialGradient>
                  <radialGradient id="rw-cone" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#d4a017" /><stop offset="55%" stopColor="#7c5a12" /><stop offset="100%" stopColor="#3a2a08" /></radialGradient>
                  <radialGradient id="rw-ball" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#ffffff" /><stop offset="60%" stopColor="#e2e8f0" /><stop offset="100%" stopColor="#94a3b8" /></radialGradient>
                </defs>

                {/* Fixed bowl: wooden rim, gold edge and the ball track */}
                <circle cx={C} cy={C} r="166" fill="url(#rw-wood)" />
                <circle cx={C} cy={C} r="158" fill="none" stroke="#fbbf24" strokeWidth="2.5" opacity="0.85" />
                <circle cx={C} cy={C} r="152" fill="url(#rw-track)" />
                <circle cx={C} cy={C} r="138" fill="none" stroke="#475569" strokeWidth="0.6" opacity="0.6" />
                <polygon points={`${C - 7},6 ${C + 7},6 ${C},20`} fill="#fbbf24" />

                {/* Rotating wheel */}
                <g transform={`rotate(${view.wheel} ${C} ${C})`}>
                  <circle cx={C} cy={C} r="126" fill="#fbbf24" />
                  {wheelOrder.map((value, index) => (
                    <path key={`pocket-${value}`} d={wedge(index, 102, 125)} fill={pocketFill[numberColor(value)]} />
                  ))}
                  <circle cx={C} cy={C} r="102" fill="#0b1d33" />
                  {wheelOrder.map((value, index) => (
                    <g key={`label-${value}`} transform={`rotate(${index * STEP} ${C} ${C})`}>
                      <text x={C} y={C - 89} textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight="700" fill={numberColor(value) === "green" ? "#6ee7b7" : "#f1f5f9"}>{value}</text>
                    </g>
                  ))}
                  {wheelOrder.map((value, index) => {
                    const [x0, y0] = polar(102, (index - 0.5) * STEP);
                    const [x1, y1] = polar(126, (index - 0.5) * STEP);
                    return <line key={`fret-${value}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#fbbf24" strokeWidth="1.2" />;
                  })}
                  <circle cx={C} cy={C} r="76" fill="url(#rw-cone)" stroke="#fbbf24" strokeWidth="1.5" />
                  {[0, 45, 90, 135].map((angle) => (
                    <line key={angle} x1={C} y1={C - 74} x2={C} y2={C + 74} stroke="#fde68a" strokeWidth="2" opacity="0.55" transform={`rotate(${angle} ${C} ${C})`} />
                  ))}
                </g>

                {/* Static hub that shows the last result */}
                <circle cx={C} cy={C} r="44" fill="#071426" stroke="#fbbf24" strokeWidth="3" />
                <text x={C} y={C - 14} textAnchor="middle" fontSize="8" letterSpacing="1.5" fill="#bae6fd" opacity="0.6">RESULT</text>
                <text x={C} y={C + 12} textAnchor="middle" fontSize="30" fontWeight="900" fill={resultFill}>{result ?? "—"}</text>

                {/* Ball (absolute position, so it can travel against the wheel) */}
                <circle cx={ballX + 1.5} cy={ballY + 2} r="5.5" fill="#000" opacity="0.35" />
                <circle cx={ballX} cy={ballY} r="5.5" fill="url(#rw-ball)" />
              </svg>
              {history.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Recent results">
                  {history.map((value, index) => (
                    <span key={`${value}-${index}`} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${numberColor(value) === "red" ? "bg-red-700 text-red-50" : numberColor(value) === "green" ? "bg-emerald-700 text-emerald-50" : "bg-slate-950 text-slate-100"} ${index === 0 ? "ring-2 ring-sky-300" : "opacity-80"}`}>{value}</span>
                  ))}
                </div>
              )}
              <p className="mt-5 min-h-6 text-center text-sm font-semibold text-sky-100">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><label htmlFor="roulette-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet amount</label><div className="mt-2 flex items-center gap-2">              <input id="roulette-bet" type="number" min="1" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={spinning} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Table limit: {MAX_BET} moose bucks</p></div>
              <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-100/65">Choose your bet</p><div className="grid grid-cols-2 gap-2">{(["red", "black", "odd", "even"] as BetType[]).map((type) => <button key={type} onClick={() => setBetType(type)} disabled={spinning} className={`rounded-xl border px-3 py-3 text-sm font-semibold capitalize transition disabled:opacity-40 ${betType === type ? "border-sky-300 bg-sky-300/20 text-sky-100" : "border-white/15 text-sky-100/70 hover:bg-white/10"}`}>{type}<span className="block text-[10px] font-normal opacity-60">Pays 1:1</span></button>)}</div></div>
              <div className={`rounded-xl border p-3 ${betType === "number" ? "border-sky-300/60 bg-sky-300/10" : "border-white/15 bg-white/[0.03]"}`}><div className="flex items-center justify-between text-sm font-semibold text-sky-100"><span>Straight-up number</span><span className="text-sky-300">Pays 35:1</span></div><p className="mt-1 text-xs text-sky-100/55">Choose a number</p><div className="mt-3 grid grid-cols-7 gap-1">{tableNumbers.map((value) => <button key={value} onClick={() => { setNumber(value); setBetType("number"); }} disabled={spinning} className={`rounded px-1 py-2 text-xs font-bold transition disabled:opacity-40 ${value === 0 ? "bg-emerald-700 text-emerald-50 hover:bg-emerald-600" : numberColor(value) === "red" ? "bg-red-700 text-red-50 hover:bg-red-600" : "bg-slate-950 text-slate-100 hover:bg-slate-800"} ${betType === "number" && number === value ? "ring-2 ring-sky-300 ring-offset-1 ring-offset-[#0b2741]" : ""}`}>{value}</button>)}</div></div>
              <button onClick={spin} disabled={spinning} className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">{spinning ? "Spinning..." : "Spin the wheel"}</button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
