"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import {
  browserRng,
  COIN_VALUE_PENCE,
  createBed,
  GOLD_VALUE_PENCE,
  INJECT_INTERVAL,
  LANE_CAPACITY,
  LANE_COUNT,
  maximumWinPence,
  MIN_DROPS,
  MAX_DROPS,
  simulateSession,
  type Bed,
  type BedCoin,
} from "../../lib/coinPusher";

const STAKE_PENCE = COIN_VALUE_PENCE;
const DROPS = [1, 5, 10, 25] as const;
const PUSHER_MS = 900;
const DROP_MS = 450;

const round2 = (value: number) => Math.round(value * 100) / 100;
const pence = (value: number) => `£${(value / 100).toFixed(2)}`;

function Coin({ coin, size = 34 }: { coin: BedCoin; size?: number }) {
  const gold = coin.kind === "gold";
  return (
    <span
      className={`flex items-center justify-center rounded-full border-2 font-serif font-bold shadow-md ${gold ? "border-amber-200 bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-900" : "border-slate-300 bg-gradient-to-br from-slate-100 to-slate-400 text-slate-700"}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {gold ? "10" : "2p"}
    </span>
  );
}

export default function CoinPusherPage() {
  const [balance, setBalance] = useBankingBalance();
  const [bed, setBed] = useState<Bed>(() => createBed(browserRng));
  const [drops, setDrops] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Feed the machine 2p coins and push the pile over the edge.");
  const [tray, setTray] = useState<{ id: number; coin: BedCoin }[]>([]);
  const [drain, setDrain] = useState<{ id: number; coin: BedCoin }[]>([]);
  const [pusherPhase, setPusherPhase] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  async function play() {
    if (running) return;
    const count = Math.round(drops);
    if (count < MIN_DROPS || count > MAX_DROPS || count * STAKE_PENCE > balance * 100) {
      setMessage(count * STAKE_PENCE > balance * 100 ? "Not enough balance to cover that many coins." : `Choose between ${MIN_DROPS} and ${MAX_DROPS} coins.`);
      return;
    }
    setRunning(true);
    clearTimers();
    const stake = round2((count * STAKE_PENCE) / 100);
    try {
      await bankingStake(stake, "coinpusher", round2(maximumWinPence(count) / 100));
      await syncBankingBalance(setBalance);
    } catch (error) {
      setRunning(false);
      setMessage(error instanceof Error ? error.message : "Could not place the stake.");
      return;
    }

    const session = simulateSession(bed, count, browserRng);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepMs = reduced ? 60 : PUSHER_MS + DROP_MS;

    setMessage("Coins away!");
    session.steps.forEach((step, index) => {
      const at = index * stepMs;
      timers.current.push(setTimeout(() => {
        setBed(step.bed);
        setPusherPhase((phase) => phase + 1);
        if (step.injected) setMessage("The attendant feeds a gold token onto the shelf...");
        for (const fallen of step.fell) {
          const entry = { id: fallen.id, coin: { id: fallen.id, kind: fallen.kind } };
          if (fallen.won) {
            setTray((current) => [...current, entry]);
          } else {
            setDrain((current) => [...current, entry]);
          }
        }
      }, at));
    });

    const finishAt = session.steps.length * stepMs + 250;
    timers.current.push(setTimeout(() => {
      const won = session.winPence;
      const settle = won > 0
        ? bankingReturn(stake).then(() => bankingPayout(round2(won / 100))).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage(`${won}p pushed over the edge — ${pence(won)} credited back plus your ${pence(stake)} stake.`);
        })
        : bankingReturn(stake).then(() => bankingLoss(stake)).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage("Nothing fell. Your coins joined the pile — better luck next time.");
        });
      settle.catch((error) => setMessage(error instanceof Error ? error.message : "Settlement failed.")).finally(() => setRunning(false));
    }, finishAt));
  }

  const pusherOffset = running ? Math.abs(Math.sin(pusherPhase * Math.PI)) * 14 : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino floor</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">2p Machine</h1><p className="mt-2 text-sm text-sky-100/65">The classic coin pusher · 2p a coin · Gold tokens pay 10p · Return to player ~93%</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Every 2p is held when you drop it and settled once the pile stops moving.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_280px]">
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-emerald-300/10 bg-[#0a3a36]/70 p-6">
              <div className="w-full max-w-xl rounded-3xl border-4 border-amber-400/80 bg-gradient-to-b from-[#12335a] to-[#071426] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                <div className="relative overflow-hidden rounded-2xl bg-[#081c33] p-3">
                  <div className="flex justify-between px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-sky-100/40"><span>Back wall</span><span>Edge ↓</span></div>
                  <div className="space-y-1">
                    {bed.map((lane, laneIndex) => (
                      <div key={laneIndex} className="flex items-center gap-1">
                        <div className="flex flex-1 items-center gap-1 overflow-hidden rounded-lg bg-black/30 px-1 py-1" style={{ transform: `translateX(${pusherOffset}px)` }}>
                          {Array.from({ length: LANE_CAPACITY }, (_, row) => lane[row]
                            ? <Coin key={lane[row].id} coin={lane[row]} size={30} />
                            : <span key={`empty-${laneIndex}-${row}`} className="rounded-full border-2 border-dashed border-white/10" style={{ width: 30, height: 30 }} />)}
                        </div>
                        {laneIndex === 0 || laneIndex === LANE_COUNT - 1
                          ? <span className="w-8 text-center text-lg" title="Side drain — coins here are lost">🕳️</span>
                          : <span className="w-8 text-center text-lg" title="Payout tray — coins here are won">🎯</span>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                    <span>Tray: {tray.length > 0 ? tray.map((entry) => (entry.coin.kind === "gold" ? "🟡" : "⚪")).join(" ") : "empty"}</span>
                    <span>Drains: {drain.length > 0 ? drain.map((entry) => (entry.coin.kind === "gold" ? "🟡" : "⚪")).join(" ") : "empty"}</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 min-h-6 text-center text-sm font-semibold text-sky-100">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <label htmlFor="coinpusher-drops" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Coins to drop</label>
                <div className="mt-2 flex items-center gap-2">
                  <input id="coinpusher-drops" type="number" min={MIN_DROPS} max={MAX_DROPS} step="1" value={drops} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDrops(Math.max(MIN_DROPS, Math.min(MAX_DROPS, Number(event.target.value) || MIN_DROPS)))} disabled={running} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" />
                  <span className="text-sm text-sky-100/65">× 2p = {pence(Math.round(drops) * STAKE_PENCE)}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {DROPS.map((amount) => (
                    <button key={amount} onClick={() => setDrops(amount)} disabled={running} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${drops === amount ? "border-sky-300 bg-sky-300/20 text-sky-100" : "border-white/15 text-sky-100/70 hover:bg-white/10"}`}>{amount}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-sky-100/45">Every {INJECT_INTERVAL} coins the attendant feeds a free gold token in.</p>
              </div>
              <button onClick={play} disabled={running} className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">{running ? "Pushing..." : "Drop the coins"}</button>
              <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-100/65">How it pays</p>
                <ul className="mt-2 space-y-1.5 text-sm text-sky-100">
                  <li className="flex items-center justify-between"><span>⚪ 2p coin over the edge</span><span className="font-bold text-sky-300">2p</span></li>
                  <li className="flex items-center justify-between"><span>🟡 Gold token over the edge</span><span className="font-bold text-sky-300">{GOLD_VALUE_PENCE}p</span></li>
                  <li className="flex items-center justify-between"><span>Down a side drain 🕳️</span><span className="font-bold text-sky-300">Lost</span></li>
                  <li className="flex items-center justify-between border-t border-white/10 pt-1.5 text-xs text-sky-100/70"><span>{LANE_COUNT} lanes · {LANE_CAPACITY} deep · teetering chains</span><span className="font-bold text-sky-300">RTP ~93%</span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}