"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { bankingPayout, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";

type Phase = "idle" | "playing" | "lost" | "cashed" | "cleared";
type Round = { id: number; phase: Phase; mines: Set<number>; picked: Set<number>; exploded: number | null; stake: number };

const gridSizes = [5, 6, 7, 8];
const densities = [0.2, 0.32, 0.48, 0.64, 0.8]; 
const RETURN_TO_PLAYER = 0.97;
const MAX_MULTIPLIER = 1000; 
const iconSize: Record<number, number> = { 5: 34, 6: 30, 7: 26, 8: 22 };

const emptyRound: Round = { id: 0, phase: "idle", mines: new Set(), picked: new Set(), exploded: null, stake: 0 };

const animationCss = `
@keyframes mn-flip { from { opacity: 0; transform: perspective(420px) rotateY(88deg) scale(0.8); } to { opacity: 1; transform: perspective(420px) rotateY(0deg) scale(1); } }
@keyframes mn-ghost-in { from { opacity: 0; transform: perspective(420px) rotateY(88deg) scale(0.8); } to { opacity: 0.5; transform: perspective(420px) rotateY(0deg) scale(1); } }
@keyframes mn-boom { 0% { opacity: 0; transform: scale(0.4); } 35% { opacity: 1; transform: scale(1.35); } 55% { transform: scale(0.95) rotate(-4deg); } 75% { transform: scale(1.08) rotate(3deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
@keyframes mn-shimmer { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.28); } }
@keyframes mn-shake { 0%, 100% { transform: translate(0, 0); } 15% { transform: translate(-6px, 2px); } 35% { transform: translate(5px, -2px); } 55% { transform: translate(-4px, 2px); } 75% { transform: translate(3px, -1px); } }
@keyframes mn-gem { 0%, 100% { transform: translateY(0); filter: drop-shadow(0 0 4px rgba(110, 231, 183, 0.6)); } 50% { transform: translateY(-2px); filter: drop-shadow(0 0 9px rgba(110, 231, 183, 0.95)); } }
@keyframes mn-badge { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 14% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); } 24% { transform: translate(-50%, -50%) scale(1); } 78% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -62%) scale(1); } }
@keyframes mn-fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.mn-tile { position: relative; aspect-ratio: 1; border: 0; padding: 0; border-radius: 12px; background: linear-gradient(180deg, #2a86b3 0%, #16597f 55%, #10476a 100%); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.28), inset 0 -3px 6px rgba(0, 0, 0, 0.25), 0 4px 0 #0a3047, 0 8px 14px rgba(0, 0, 0, 0.35); transition: transform 0.12s, box-shadow 0.12s, filter 0.12s; }
.mn-tile:enabled { cursor: pointer; }
.mn-tile:enabled:hover { transform: translateY(-2px); filter: brightness(1.18); }
.mn-tile:enabled:active { transform: translateY(2px); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.2), 0 1px 0 #0a3047, 0 3px 6px rgba(0, 0, 0, 0.35); }
.mn-tile:disabled { cursor: default; }
.mn-tile:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 2px; }
.mn-tile.mn-open { background: #0b2c45; box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.55); transform: translateY(3px); }
.mn-idle { animation: mn-shimmer 5s ease-in-out infinite; animation-delay: calc(var(--i) * 70ms); }
.mn-face { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: var(--mn-icon, 28px); line-height: 1; animation: mn-flip 0.42s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.mn-safe { background: radial-gradient(circle at 50% 35%, #134e4a 0%, #0b2f35 100%); box-shadow: inset 0 0 0 2px rgba(110, 231, 183, 0.55), 0 0 16px rgba(52, 211, 153, 0.35); }
.mn-safe span { animation: mn-gem 2.4s ease-in-out infinite; }
.mn-mine { background: radial-gradient(circle at 50% 35%, #4c1d2b, #2a0f1a); box-shadow: inset 0 0 0 2px rgba(251, 113, 133, 0.5); }
.mn-boom { background: radial-gradient(circle at 50% 40%, #fb7185, #9f1239); box-shadow: 0 0 24px rgba(251, 113, 133, 0.85), inset 0 0 0 2px #fecdd3; animation: mn-boom 0.6s ease-out both; z-index: 1; }
.mn-ghost { background: rgba(7, 20, 38, 0.6); filter: saturate(0.5); animation: mn-ghost-in 0.4s ease-out both; }
.mn-shake { animation: mn-shake 0.5s ease-in-out; }
.mn-badge { animation: mn-badge 2.1s ease-out both; }
.mn-fade { animation: mn-fade 0.3s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .mn-idle, .mn-safe span, .mn-shake, .mn-fade { animation: none; }
  .mn-face, .mn-boom, .mn-ghost { animation-duration: 0.01s; }
  .mn-badge { animation-duration: 1.5s; }
}
`;

function randomIndex(maxExclusive: number) {
  const range = 2 ** 32;
  const limit = range - (range % maxExclusive);
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % maxExclusive;
}

function createMines(tiles: number, count: number) {
  const positions = Array.from({ length: tiles }, (_, index) => index);
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [positions[index], positions[swap]] = [positions[swap], positions[index]];
  }
  return new Set(positions.slice(0, count));
}

function mineCountFor(size: number, densityIndex: number) {
  const tiles = size * size;
  return Math.max(1, Math.min(tiles - 1, Math.round(tiles * densities[densityIndex])));
}


function rawMultiplier(revealed: number, tiles: number, mines: number) {
  const safe = tiles - mines;
  let multiplier = RETURN_TO_PLAYER;
  for (let step = 0; step < revealed; step += 1) multiplier *= (tiles - step) / (safe - step);
  return multiplier;
}

function multiplierFor(revealed: number, tiles: number, mines: number) {
  if (revealed === 0) return 1;
  return Math.min(MAX_MULTIPLIER, Math.floor(rawMultiplier(revealed, tiles, mines) * 100) / 100);
}

const fmtX = (value: number) => `${value >= 100 ? value.toFixed(0) : value.toFixed(2)}×`;

export default function Minesweeper() {
  const MAX_BET = 250;
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [size, setSize] = useState(5);
  const [densityIndex, setDensityIndex] = useState(0);
  const [round, setRound] = useState<Round>(emptyRound);
  const [message, setMessage] = useState("Choose your stake and start a round.");
  const [settling, setSettling] = useState(false);

  const tiles = size * size;
  const mineCount = mineCountFor(size, densityIndex);
  const safeTotal = tiles - mineCount;
  const playing = round.phase === "playing";
  const over = round.phase === "lost" || round.phase === "cashed" || round.phase === "cleared";
  const revealed = round.picked.size;
  const multiplier = multiplierFor(revealed, tiles, mineCount);
  const stake = playing ? round.stake : bet;
  const potential = stake * multiplier;
  const nextMultiplier = multiplierFor(revealed + 1, tiles, mineCount);
  const nextChance = ((safeTotal - revealed) / (tiles - revealed)) * 100;
  const topPrize = multiplierFor(safeTotal, tiles, mineCount);

  function changeGrid(nextSize: number, nextDensity: number) {
    if (playing) return;
    setSize(nextSize);
    setDensityIndex(nextDensity);
    setRound((current) => ({ ...emptyRound, id: current.id }));
    setMessage("Choose your stake and start a round.");
  }

  async function startRound() {
    if (playing) return;
    if (bet < 1 || bet > MAX_BET || bet > balance) {
      setMessage(`Choose a bet between 1 and ${MAX_BET} moose bucks within your available balance.`);
      return;
    }
    try {
      await bankingStake(bet);
      await syncBankingBalance(setBalance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not place the stake.");
      return;
    }
    setRound((current) => ({ id: current.id + 1, phase: "playing", mines: createMines(tiles, mineCount), picked: new Set(), exploded: null, stake: bet }));
    setMessage("Round live — reveal safe tiles or cash out.");
  }

  async function settleWin(finished: Round, phase: "cashed" | "cleared", text: (returned: number, profit: number, multiplierValue: number) => string) {
    setSettling(true);
    const winMultiplier = multiplierFor(finished.picked.size, tiles, mineCount);
    const returned = finished.stake * winMultiplier;
    try {
      await bankingPayout(returned);
      await syncBankingBalance(setBalance);
    } catch (error) {
      setSettling(false);
      setMessage(error instanceof Error ? error.message : "Payout failed.");
      return;
    }
    setRound({ ...finished, phase });
    setMessage(text(returned, returned - finished.stake, winMultiplier));
    setSettling(false);
  }

  async function reveal(index: number) {
    if (!playing || settling || round.picked.has(index)) return;
    if (round.mines.has(index)) {
      setRound({ ...round, phase: "lost", exploded: index });
      setMessage(`Mine hit — ${round.stake.toFixed(2)} stake lost.`);
      return;
    }
    const next: Round = { ...round, picked: new Set([...round.picked, index]) };
    const count = next.picked.size;
    if (count === safeTotal) {
      await settleWin(next, "cleared", (returned, profit) => `Board cleared — ${profit.toFixed(2)} profit + ${next.stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.`);
    } else if (rawMultiplier(count, tiles, mineCount) >= MAX_MULTIPLIER) {
      await settleWin(next, "cashed", (returned, profit) => `Maximum win reached — ${profit.toFixed(2)} profit + ${next.stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.`);
    } else {
      setRound(next);
      setMessage(`Safe! ${fmtX(multiplierFor(count, tiles, mineCount))} active · cash out for ${(next.stake * multiplierFor(count, tiles, mineCount)).toFixed(2)} moose bucks.`);
    }
  }

  async function cashOut() {
    if (!playing || settling || revealed === 0) return;
    await settleWin(round, "cashed", (returned, profit, winMultiplier) => `Cashed out at ${winMultiplier.toFixed(2)}× — ${profit.toFixed(2)} profit + ${round.stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.`);
  }

  function randomTile() {
    if (!playing) return;
    const hidden = Array.from({ length: tiles }, (_, index) => index).filter((index) => !round.picked.has(index));
    if (hidden.length === 0) return;
    reveal(hidden[randomIndex(hidden.length)]);
  }

  function reset() {
    setRound((current) => ({ ...emptyRound, id: current.id }));
    setMessage("Choose your stake and start a round.");
  }

  
  const order = new Map<number, number>();
  if (over) {
    const centre = round.exploded ?? Math.floor(tiles / 2);
    const distance = (index: number) => (Math.floor(index / size) - Math.floor(centre / size)) ** 2 + ((index % size) - (centre % size)) ** 2;
    [...round.mines].sort((a, b) => distance(a) - distance(b)).forEach((mine, rank) => order.set(mine, rank));
  }

  const badge = round.phase === "lost" ? { text: "Boom!", style: "border-rose-200/60 bg-rose-500 text-white" }
    : round.phase === "cashed" || round.phase === "cleared" ? { text: `${fmtX(multiplier)} cashed`, style: "border-emerald-100/60 bg-emerald-400 text-[#071426]" }
      : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <style>{animationCss}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino game</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Minesweeper</h1><p className="mt-2 text-sm text-sky-100/65">Find safe tiles, avoid the mines, and cash out before your luck runs out.</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Settlements are processed through your connected banking account.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="relative mx-auto max-w-[520px]">
                <div key={round.phase === "lost" ? `lost-${round.id}` : "board"} className={`rounded-2xl border border-emerald-300/15 bg-[radial-gradient(circle_at_50%_0%,_rgba(20,184,166,0.22),_transparent_60%),#08302f] p-3 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)] sm:p-5 ${round.phase === "lost" ? "mn-shake" : ""}`}>
                  <div role="grid" aria-label={`${size} by ${size} mine field`} className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, "--mn-icon": `${iconSize[size]}px` } as CSSProperties}>
                    {Array.from({ length: tiles }, (_, index) => {
                      const picked = round.picked.has(index);
                      const isMine = round.mines.has(index);
                      const exploded = round.exploded === index;
                      const showMine = over && isMine;
                      const showGhost = over && !isMine && !picked;
                      const delay = exploded ? 0 : showMine ? Math.min(1500, 320 + (order.get(index) ?? 0) * 55) : 300 + ((index % size) + Math.floor(index / size)) * 35;
                      return (
                        <button
                          key={index}
                          onClick={() => reveal(index)}
                          disabled={!playing || settling || picked}
                          aria-label={picked ? `Tile ${index + 1}, safe` : showMine ? `Tile ${index + 1}, mine` : `Tile ${index + 1}, hidden`}
                          className={`mn-tile ${!playing && !over ? "mn-idle" : ""} ${picked || over ? "mn-open" : ""}`}
                          style={{ "--i": index } as CSSProperties}
                        >
                          {picked && <span className="mn-face mn-safe"><span>💎</span></span>}
                          {showMine && <span className={`mn-face ${exploded ? "mn-boom" : "mn-mine"}`} style={{ animationDelay: `${delay}ms` }}>{exploded ? "💥" : "💣"}</span>}
                          {showGhost && <span className="mn-face mn-ghost" style={{ animationDelay: `${delay}ms` }}>💎</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {badge && <div key={`${round.id}-${round.phase}`} className={`mn-badge pointer-events-none absolute left-1/2 top-1/2 z-10 whitespace-nowrap rounded-full border-2 px-6 py-2 text-xl font-extrabold shadow-2xl ${badge.style}`} style={{ animationDelay: round.phase === "lost" ? "250ms" : "0ms" }}>{badge.text}</div>}
              </div>
              <div className="mx-auto mt-5 max-w-[520px]">
                <div className="h-2 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-300 transition-all duration-300" style={{ width: `${(revealed / safeTotal) * 100}%` }} /></div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-xs uppercase tracking-wider text-sky-100/55">Safe tiles</p><p className="mt-1 text-xl font-bold text-emerald-300">{revealed}/{safeTotal}</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-sky-100/55">Multiplier</p><p className={`mt-1 text-xl font-bold ${round.phase === "lost" ? "text-rose-300" : "text-sky-300"}`}>{multiplier.toFixed(2)}×</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-sky-100/55">{playing ? "Next pick" : "Top prize"}</p><p className="mt-1 text-xl font-bold text-amber-300">{playing ? `${nextChance.toFixed(0)}% · ${fmtX(nextMultiplier)}` : fmtX(topPrize)}</p></div>
                </div>
              </div>
              <p key={message} className="mn-fade mt-6 min-h-6 text-center text-sm font-semibold text-sky-100" aria-live="polite">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><label htmlFor="mines-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet amount</label><div className="mt-2 flex items-center gap-2">              <input id="mines-bet" type="number" min="1" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={playing} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Table limit: {MAX_BET} moose bucks</p><div className="mt-2 grid grid-cols-3 gap-2">{[["½", () => Math.max(1, Math.floor(bet / 2))], ["2×", () => Math.min(MAX_BET, Math.max(1, Math.min(Math.floor(balance), bet * 2)))], ["Max", () => Math.min(MAX_BET, Math.max(1, Math.floor(balance))) ]].map(([label, compute]) => <button key={label as string} onClick={() => setBet((compute as () => number)())} disabled={playing} className="rounded-lg border border-white/15 py-1.5 text-xs font-semibold text-sky-100/80 hover:bg-white/10 disabled:opacity-40">{label as string}</button>)}</div></div>
              <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-100/65">Grid size</p><div className="grid grid-cols-4 gap-2">{gridSizes.map((option) => <button key={option} onClick={() => changeGrid(option, densityIndex)} disabled={playing} aria-pressed={size === option} className={`rounded-xl border px-2 py-2 text-sm font-semibold transition disabled:opacity-40 ${size === option ? "border-sky-300 bg-sky-300/20 text-sky-100" : "border-white/15 text-sky-100/70 hover:bg-white/10"}`}>{option}×{option}</button>)}</div></div>
              <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-100/65">Mines</p><div className="grid grid-cols-5 gap-2">{densities.map((_, option) => { const count = mineCountFor(size, option); return <button key={option} onClick={() => changeGrid(size, option)} disabled={playing} aria-pressed={densityIndex === option} className={`rounded-xl border py-2 text-center transition disabled:opacity-40 ${densityIndex === option ? "border-sky-300 bg-sky-300/20 text-sky-100" : "border-white/15 text-sky-100/70 hover:bg-white/10"}`}><span className="block text-base font-bold">{count}</span><span className="block text-[10px] opacity-60">mines</span></button>; })}</div></div>
              <button onClick={playing ? cashOut : startRound} disabled={playing && revealed === 0} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${playing ? "bg-emerald-400 text-[#071426] hover:bg-emerald-300" : "bg-sky-400 text-[#071426] hover:bg-sky-300"}`}>{playing ? (revealed === 0 ? "Pick a tile to begin" : `Cash out ${potential.toFixed(2)} moose bucks`) : over ? "Play again" : "Start round"}</button>
              {playing && <button onClick={randomTile} className="w-full rounded-xl border border-sky-300/40 px-4 py-2.5 text-sm font-semibold text-sky-100 transition active:scale-95 hover:bg-sky-300/10">Pick a random tile</button>}
              {over && <button onClick={reset} className="w-full text-xs text-sky-100/65 hover:text-white">Clear board</button>}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-100/55">How it works</p><p className="mt-2 text-sm leading-6 text-sky-100/65">Each tile is a fresh chance: reveal one and it is either a gem or a mine. The multiplier is priced to your real odds (97% return), so more mines pay more per pick, and bigger grids have more gems to collect. Best case on this setup is {fmtX(topPrize)}{topPrize >= MAX_MULTIPLIER ? " — wins are capped there and cash out automatically" : ""}.</p></div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
