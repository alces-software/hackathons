"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bankingPayout, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";


const multipliers = [16, 6, 2.5, 1.2, 0.6, 0.2, 0.6, 1.2, 2.5, 6, 16];
const ROWS = 10;


const CX = 215;
const SPACING = 34;
const PEG_TOP = 70;
const ROW_H = 32;
const PEG_R = 3.5;
const BALL_R = 7;
const BUCKET_Y = 392;
const BUCKET_H = 34;
const BUCKET_W = 30;
const FALL_MS = 300;
const HOP_MS = 230;
const LAST_MS = 270;

const ballColors = ["#38bdf8", "#fbbf24", "#34d399", "#f472b6", "#a78bfa"];

type Pt = { x: number; y: number };
type Ball = { id: number; start: number; slot: number; stake: number; pts: Pt[]; durs: number[]; total: number; color: string };
type Hit = { slot: number; time: number };

function choose(n: number, k: number) {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
}
const returnToPlayer = multipliers.reduce((sum, multiplier, slot) => sum + (multiplier * choose(ROWS, slot)) / 2 ** ROWS, 0);

function fmt(multiplier: number) {
  return Number.isInteger(multiplier) ? String(multiplier) : multiplier.toFixed(1);
}

// Builds the waypoints a chip follows: a drop onto the first peg, a hop to the next peg for every row, then a hop into its slot.
function buildBall(id: number, start: number, stake: number, speed: number): Ball {
  const dirs = Array.from({ length: ROWS }, () => (Math.random() < 0.5 ? -1 : 1));
  const slot = dirs.filter((direction) => direction === 1).length;
  const pts: Pt[] = [{ x: CX, y: 24 }];
  let offset = 0; // (rights - lefts) so far, in half-spacings
  dirs.forEach((direction, row) => {
    pts.push({ x: CX + (offset * SPACING) / 2, y: PEG_TOP + row * ROW_H - (PEG_R + BALL_R) });
    offset += direction;
  });
  pts.push({ x: CX + (offset * SPACING) / 2, y: BUCKET_Y - 12 });
  const durs = [FALL_MS, ...Array.from({ length: ROWS - 1 }, () => HOP_MS), LAST_MS].map((ms) => ms * speed);
  return { id, start, slot, stake, pts, durs, total: durs.reduce((sum, ms) => sum + ms, 0), color: ballColors[id % ballColors.length] };
}

function positionAt(ball: Ball, elapsed: number): Pt {
  let acc = 0;
  for (let segment = 0; segment < ball.durs.length; segment += 1) {
    const dur = ball.durs[segment];
    if (elapsed < acc + dur) {
      const t = (elapsed - acc) / dur;
      const a = ball.pts[segment];
      const b = ball.pts[segment + 1];
      if (segment === 0) return { x: a.x, y: a.y + (b.y - a.y) * t * t }; // free fall onto the first peg
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - 4 * 9 * t * (1 - t) }; // hop off a peg
    }
    acc += dur;
  }
  return ball.pts[ball.pts.length - 1];
}

function slotStyle(multiplier: number) {
  if (multiplier >= 5) return { fill: "#f59e0b", text: "#020617" };
  if (multiplier >= 1) return { fill: "#0284c7", text: "#ffffff" };
  return { fill: "#334155", text: "#e0f2fe" };
}

export default function Plinko() {
  const MAX_BET = 250;
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [message, setMessage] = useState("Choose a stake and drop a chip.");
  const [net, setNet] = useState(0);
  const [history, setHistory] = useState<{ id: number; multiplier: number }[]>([]);
  const [view, setView] = useState<{ now: number; balls: Ball[]; hit: Hit | null }>({ now: 0, balls: [], hit: null });

  const balls = useRef<Ball[]>([]);
  const hit = useRef<Hit | null>(null);
  const raf = useRef(0);
  const nextId = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function loop(now: number) {
    const landed = balls.current.filter((ball) => now - ball.start >= ball.total);
    if (landed.length > 0) {
      balls.current = balls.current.filter((ball) => now - ball.start < ball.total);
      landed.forEach((ball) => {
        const multiplier = multipliers[ball.slot];
        const returned = ball.stake * multiplier;
        const profit = returned - ball.stake;
        hit.current = { slot: ball.slot, time: now };
        bankingPayout(returned).then(() => syncBankingBalance(setBalance)).then(() => {
          setNet((current) => current + profit);
          setHistory((current) => [{ id: ball.id, multiplier }, ...current].slice(0, 12));
          setMessage(multiplier >= 1
            ? `${fmt(multiplier)}× slot — ${profit.toFixed(2)} profit + ${ball.stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.`
            : `${fmt(multiplier)}× slot — ${returned.toFixed(2)} returned from your ${ball.stake.toFixed(2)} stake (${profit.toFixed(2)}).`);
        }).catch((error) => setMessage(error instanceof Error ? error.message : "Payout failed."));
      });
    }
    setView({ now, balls: [...balls.current], hit: hit.current });
    const flashing = hit.current !== null && now - hit.current.time < 600;
    raf.current = balls.current.length > 0 || flashing ? requestAnimationFrame(loop) : 0;
  }

  async function drop(count: number) {
    if (bet < 5 || bet > MAX_BET || bet * count > balance) {
      setMessage(bet < 5 ? "The minimum bet is 5 moose bucks per chip." : bet > MAX_BET ? `The table limit is ${MAX_BET} moose bucks per chip.` : count > 1 ? "Not enough balance to drop that many chips." : "Choose a bet within your available balance.");
      return;
    }
    try {
      let placed = 0;
      try {
        for (; placed < count; placed += 1) await bankingStake(bet);
      } catch (error) {
        if (placed > 0) await bankingPayout(bet * placed);
        throw error;
      }
      await syncBankingBalance(setBalance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not place the stake.");
      return;
    }
    const speed = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.4 : 1;
    const now = performance.now();
    for (let i = 0; i < count; i += 1) {
      nextId.current += 1;
      balls.current.push(buildBall(nextId.current, now + i * 260 * speed, bet, speed));
    }
    setMessage(count > 1 ? `${count} chips dropped...` : "Your chip is bouncing...");
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  }

  const flash = view.hit && view.now - view.hit.time < 600 ? 1 - (view.now - view.hit.time) / 600 : 0;
  const inPlay = view.balls.length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino game</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Plinko</h1><p className="mt-2 text-sm text-sky-100/65">Drop a chip, watch it bounce, and land on a multiplier.</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Settlements are processed through your connected banking account.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-2xl border border-sky-200/15 bg-[#08233c]">
                <svg viewBox="0 0 430 436" role="img" aria-label="Plinko board" className="block h-auto w-full">
                  <text x={CX} y="13" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="2" fill="#e0f2fe" opacity="0.4">DROP ZONE</text>
                  {Array.from({ length: ROWS }, (_, row) =>
                    Array.from({ length: row + 3 }, (_, peg) => {
                      const x = CX + (peg - (row + 2) / 2) * SPACING;
                      const y = PEG_TOP + row * ROW_H;
                      return (
                        <g key={`${row}-${peg}`}>
                          <circle cx={x} cy={y} r={PEG_R + 3} fill="#7dd3fc" opacity="0.12" />
                          <circle cx={x} cy={y} r={PEG_R} fill="#bae6fd" opacity="0.85" />
                        </g>
                      );
                    }),
                  )}
                  {multipliers.map((multiplier, slot) => {
                    const style = slotStyle(multiplier);
                    const lit = view.hit?.slot === slot ? flash : 0;
                    const x = CX + (slot - 5) * SPACING - BUCKET_W / 2;
                    return (
                      <g key={slot} transform={`translate(0 ${(lit * 5).toFixed(2)})`}>
                        <rect x={x} y={BUCKET_Y} width={BUCKET_W} height={BUCKET_H} rx="6" fill={style.fill} />
                        <rect x={x} y={BUCKET_Y} width={BUCKET_W} height={BUCKET_H} rx="6" fill="#ffffff" opacity={(lit * 0.75).toFixed(2)} />
                        <text x={x + BUCKET_W / 2} y={BUCKET_Y + BUCKET_H / 2 + 4} textAnchor="middle" fontSize="10.5" fontWeight="900" fill={style.text}>{fmt(multiplier)}×</text>
                      </g>
                    );
                  })}
                  {view.balls.filter((ball) => view.now >= ball.start).map((ball) => {
                    const { x, y } = positionAt(ball, view.now - ball.start);
                    return (
                      <g key={ball.id}>
                        <circle cx={x + 1.5} cy={y + 2.5} r={BALL_R} fill="#000" opacity="0.3" />
                        <circle cx={x} cy={y} r={BALL_R} fill={ball.color} stroke="#ffffff" strokeWidth="1.2" />
                        <circle cx={x - 2.2} cy={y - 2.4} r="2" fill="#ffffff" opacity="0.75" />
                      </g>
                    );
                  })}
                </svg>
              </div>
              {history.length > 0 && (
                <div className="mx-auto mt-4 flex max-w-[430px] flex-wrap justify-center gap-1.5" aria-label="Recent results">
                  {history.map((entry, index) => <span key={entry.id} className={`rounded-md px-2 py-1 text-xs font-black ${entry.multiplier >= 5 ? "bg-amber-500 text-slate-950" : entry.multiplier >= 1 ? "bg-sky-600 text-white" : "bg-slate-700 text-sky-100/80"} ${index === 0 ? "ring-2 ring-white/70" : "opacity-80"}`}>{fmt(entry.multiplier)}×</span>)}
                </div>
              )}
              <p className="mt-5 min-h-6 text-center text-sm font-semibold text-sky-100" aria-live="polite">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><label htmlFor="plinko-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet per chip</label><div className="mt-2 flex items-center gap-2"><input id="plinko-bet" type="number" min="5" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Table limit: 5–{MAX_BET} moose bucks per chip</p></div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => drop(1)} className="col-span-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] transition active:scale-95 hover:bg-sky-300">Drop chip</button>
                <button onClick={() => drop(5)} className="rounded-xl border border-sky-300/40 px-4 py-3 text-sm font-semibold text-sky-100 transition active:scale-95 hover:bg-sky-300/10">Drop ×5</button>
                <button onClick={() => drop(10)} className="rounded-xl border border-sky-300/40 px-4 py-3 text-sm font-semibold text-sky-100 transition active:scale-95 hover:bg-sky-300/10">Drop ×10</button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs uppercase tracking-wider text-sky-100/55">In play</p><p className="mt-1 text-xl font-bold text-sky-200">{inPlay}</p></div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-xs uppercase tracking-wider text-sky-100/55">Session</p><p className={`mt-1 text-xl font-bold ${net > 0 ? "text-emerald-300" : net < 0 ? "text-rose-300" : "text-sky-200"}`}>{net > 0 ? "+" : ""}{net.toFixed(2)}</p></div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-100/55">Payouts</p><p className="mt-2 text-sm leading-6 text-sky-100/65">Every peg sends a chip left or right, so the middle slots come up most often and the edges rarely. The 16× edge slots pay your stake plus 15× profit. Expected return is about {(returnToPlayer * 100).toFixed(1)}%.</p></div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
