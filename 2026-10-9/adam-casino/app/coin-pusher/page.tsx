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

// Playfield geometry. Lanes run top (back wall) -> bottom (edge).
const CELL = 38;
const COIN = 32;
const SHELF_W = LANE_COUNT * CELL;
const SHELF_H = LANE_CAPACITY * CELL;
const CATCH_H = 104;
const PUSH_TRAVEL = 20;

const round2 = (value: number) => Math.round(value * 100) / 100;
const pence = (value: number) => `£${(value / 100).toFixed(2)}`;

type Entry = { id: number | string; coin: BedCoin; lane: number };
type Falling = Entry & { won: boolean; key: string };

function Coin({ kind, size = COIN }: { kind: BedCoin["kind"]; size?: number }) {
  const gold = kind === "gold";
  return (
    <span
      className={`relative flex items-center justify-center rounded-full font-serif font-bold ${gold ? "cp-shine text-amber-950" : "text-slate-700"}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: gold
          ? "radial-gradient(circle at 32% 28%, #fff3b0 0%, #fbbf24 45%, #b45309 100%)"
          : "radial-gradient(circle at 32% 28%, #ffffff 0%, #cbd5e1 50%, #64748b 100%)",
        boxShadow: gold
          ? "inset 0 0 0 2px rgba(120,53,15,.45), inset 0 0 0 4px rgba(254,243,199,.55), 0 3px 4px rgba(0,0,0,.55)"
          : "inset 0 0 0 2px rgba(51,65,85,.4), inset 0 0 0 4px rgba(255,255,255,.5), 0 3px 4px rgba(0,0,0,.55)",
      }}
    >
      {gold ? "10" : "2p"}
    </span>
  );
}

const STYLES = `
.cp-drop { animation: cp-drop .6s cubic-bezier(.3,.7,.35,1.15) both; }
@keyframes cp-drop {
  0%   { transform: translateY(-120px) scale(1.2); opacity: 0; }
  25%  { opacity: 1; }
  100% { transform: none; opacity: 1; }
}
.cp-fall-won { animation: cp-fall-won .62s cubic-bezier(.45,0,.85,.55) forwards; }
@keyframes cp-fall-won {
  0%   { transform: translateY(-10px) rotate(0) scale(1); opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(var(--drop)) rotate(260deg) scale(.9); opacity: 0; }
}
.cp-fall-lost { animation: cp-fall-lost .62s cubic-bezier(.45,0,.85,.55) forwards; }
@keyframes cp-fall-lost {
  0%   { transform: translateY(-6px) rotate(0) scale(1); opacity: 1; }
  100% { transform: translateY(var(--drop)) rotate(-200deg) scale(.25); opacity: 0; }
}
.cp-pop { animation: cp-pop .28s ease-out both; }
@keyframes cp-pop { 0% { transform: scale(1.6); } 100% { transform: scale(1); } }
.cp-shine { animation: cp-shine 2.2s ease-in-out infinite; }
@keyframes cp-shine { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
.cp-slot { animation: cp-slot .5s ease-out; }
@keyframes cp-slot { 0% { box-shadow: 0 0 0 0 rgba(125,211,252,.9); } 100% { box-shadow: 0 0 22px 10px rgba(125,211,252,0); } }
.cp-pusher { transition: transform ${Math.round(PUSHER_MS * 0.55)}ms cubic-bezier(.4,0,.2,1); }
.cp-slide { transition: transform 560ms cubic-bezier(.22,.9,.3,1); }
@media (prefers-reduced-motion: reduce) {
  .cp-drop, .cp-fall-won, .cp-fall-lost, .cp-pop, .cp-shine, .cp-slot { animation: none !important; }
  .cp-pusher, .cp-slide { transition: none !important; }
}
`;

export default function CoinPusherPage() {
  const [balance, setBalance] = useBankingBalance();
  const [bed, setBed] = useState<Bed>(() => createBed(() => 0.5));
  const [drops, setDrops] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Feed the machine 2p coins and push the pile over the edge.");
  const [tray, setTray] = useState<Entry[]>([]);
  const [drain, setDrain] = useState<Entry[]>([]);
  const [falling, setFalling] = useState<Falling[]>([]);
  const [pushing, setPushing] = useState(false);
  const [slotTick, setSlotTick] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bedRef = useRef<Bed>(bed);
  const order = useRef<Map<number | string, number>>(new Map());

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // crypto.getRandomValues is unstable during prerender, so seed the random bed after mount.
  useEffect(() => {
    const fresh = createBed(browserRng);
    bedRef.current = fresh;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deterministic prerender bed must be replaced once on the client
    setBed(fresh);
  }, []);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function laneOf(id: number | string, won: boolean) {
    const found = bedRef.current.findIndex((lane) => lane.some((coin) => coin && coin.id === id));
    if (found >= 0) return found;
    return won ? Math.floor(LANE_COUNT / 2) : 0;
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

    setTray([]);
    setDrain([]);
    setFalling([]);

    const session = simulateSession(bed, count, browserRng);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stepMs = reduced ? 60 : PUSHER_MS + DROP_MS;

    setMessage("Coins away!");
    session.steps.forEach((step, index) => {
      const at = index * stepMs;
      later(() => {
        // Work out where each fallen coin was *before* the bed updates.
        const leaving: Falling[] = step.fell.map((fallen) => {
          const lane = laneOf(fallen.id, fallen.won);
          return {
            id: fallen.id,
            coin: { id: fallen.id, kind: fallen.kind },
            lane,
            won: fallen.won,
            key: `${fallen.id}-${index}`,
          };
        });

        bedRef.current = step.bed;
        setBed(step.bed);
        setSlotTick((tick) => tick + 1);
        setPushing(true);
        later(() => setPushing(false), PUSHER_MS * 0.55);

        if (step.injected) setMessage("The attendant feeds a gold token onto the shelf...");

        if (leaving.length > 0) {
          // Let the push land, then the coins tip over the lip.
          later(() => {
            setFalling((current) => [...current, ...leaving]);
            leaving.forEach((item) => {
              later(() => {
                setFalling((current) => current.filter((f) => f.key !== item.key));
                const entry: Entry = { id: item.id, coin: item.coin, lane: item.lane };
                if (item.won) setTray((current) => [...current, entry]);
                else setDrain((current) => [...current, entry]);
              }, reduced ? 20 : 620);
            });
          }, reduced ? 10 : PUSHER_MS * 0.45);
        }
      }, at);
    });

    const finishAt = session.steps.length * stepMs + 900;
    later(() => {
      const won = session.winPence;
      const settle = won > 0
        ? bankingReturn(stake).then(() => bankingPayout(round2(won / 100))).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage(`You pushed ${pence(won)} over the edge — winnings credited plus your £${stake.toFixed(2)} stake returned.`);
        })
        : bankingReturn(stake).then(() => bankingLoss(stake)).then(() => syncBankingBalance(setBalance)).then(() => {
          setMessage("Nothing fell. Your coins joined the pile — better luck next time.");
        });
      settle.catch((error) => setMessage(error instanceof Error ? error.message : "Settlement failed.")).finally(() => setRunning(false));
    }, finishAt);
  }

  // Flatten the bed into absolutely-positioned coins. A stable DOM order keeps
  // CSS transitions alive when coins slide from one cell to another.
  const placed = bed
    .flatMap((lane, l) => lane.map((coin, r) => (coin ? { coin, l, r } : null)))
    .filter((item): item is { coin: BedCoin; l: number; r: number } => item !== null);
  for (const { coin } of placed) {
    if (!order.current.has(coin.id)) order.current.set(coin.id, order.current.size);
  }
  placed.sort((a, b) => (order.current.get(a.coin.id) ?? 0) - (order.current.get(b.coin.id) ?? 0));

  const trayValue = tray.reduce((sum, e) => sum + (e.coin.kind === "gold" ? GOLD_VALUE_PENCE : COIN_VALUE_PENCE), 0);
  const leftDrain = drain.filter((e) => e.lane < LANE_COUNT / 2);
  const rightDrain = drain.filter((e) => e.lane >= LANE_COUNT / 2);
  const mini = (entries: Entry[], size: number) => entries.slice(-30).map((e) => (
    <span key={e.id} className="cp-pop"><Coin kind={e.coin.kind} size={size} /></span>
  ));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <style>{STYLES}</style>
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
              <div className="max-w-full overflow-x-auto pb-2" style={{ perspective: 1100 }}>
                <div
                  className="mx-auto rounded-3xl border-4 border-amber-400/80 bg-gradient-to-b from-[#12335a] to-[#071426] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
                  style={{ width: SHELF_W + 32 + 8, transform: "rotateX(8deg)", transformOrigin: "50% 100%" }}
                >
                  {/* Coin slot */}
                  <div className="mb-2 flex justify-center">
                    <div key={slotTick} className={`h-2.5 w-24 rounded-full bg-black/70 ring-2 ring-sky-300/40 ${slotTick > 0 ? "cp-slot" : ""}`} />
                  </div>

                  {/* Shelf */}
                  <div className="relative overflow-hidden rounded-t-xl bg-[#081c33]" style={{ width: SHELF_W, height: SHELF_H + 14, margin: "0 auto" }}>
                    {/* lane guides */}
                    {Array.from({ length: LANE_COUNT }, (_, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 ${i === 0 || i === LANE_COUNT - 1 ? "bg-red-950/40" : i % 2 ? "bg-white/[0.025]" : "bg-transparent"}`}
                        style={{ left: i * CELL, width: CELL }}
                      />
                    ))}
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-sky-100/20" />

                    {/* Coins */}
                    <div className="absolute left-0 top-2" style={{ width: SHELF_W, height: SHELF_H }}>
                      {placed.map(({ coin, l, r }) => (
                        <div
                          key={coin.id}
                          className="cp-slide absolute left-0 top-0"
                          style={{ width: CELL, height: CELL, transform: `translate3d(${l * CELL}px, ${r * CELL}px, 0)` }}
                        >
                          <div className="cp-drop flex h-full w-full items-center justify-center">
                            <Coin kind={coin.kind} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pusher plate */}
                    <div
                      className="cp-pusher absolute left-0 right-0 top-0 z-10 flex h-3 items-center rounded-b-md border-b-2 border-amber-300/70 shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
                      style={{
                        transform: `translateY(${pushing ? PUSH_TRAVEL : 0}px)`,
                        background: "repeating-linear-gradient(135deg, #f59e0b 0 10px, #1e293b 10px 20px)",
                      }}
                    />
                  </div>

                  {/* Edge lip */}
                  <div className="mx-auto flex items-center justify-between rounded-b-lg bg-amber-400/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-950" style={{ width: SHELF_W }}>
                    <span>Drain</span><span>Edge</span><span>Drain</span>
                  </div>

                  {/* Catch zone */}
                  <div className="relative mx-auto mt-1 flex overflow-visible rounded-b-xl bg-black/40" style={{ width: SHELF_W, height: CATCH_H }}>
                    <div className="flex flex-col-reverse items-center justify-start gap-0.5 overflow-hidden rounded-bl-xl bg-red-950/50 py-1" style={{ width: CELL }} title="Side drain — coins here are lost">
                      <span className="text-base leading-none">🕳️</span>
                      <div className="flex flex-col-reverse items-center gap-px opacity-70">{mini(leftDrain, 14)}</div>
                    </div>
                    <div className="relative flex flex-1 flex-col items-center justify-end overflow-hidden bg-gradient-to-b from-emerald-900/10 to-emerald-700/25 pb-1" title="Payout tray — coins here are won">
                      <div className="flex flex-wrap-reverse content-start items-end justify-center gap-0.5 px-1">{mini(tray, 20)}</div>
                      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-200/70">
                        {tray.length > 0 ? `Won ${trayValue}p` : "Payout tray"}
                      </span>
                    </div>
                    <div className="flex flex-col-reverse items-center justify-start gap-0.5 overflow-hidden rounded-br-xl bg-red-950/50 py-1" style={{ width: CELL }} title="Side drain — coins here are lost">
                      <span className="text-base leading-none">🕳️</span>
                      <div className="flex flex-col-reverse items-center gap-px opacity-70">{mini(rightDrain, 14)}</div>
                    </div>

                    {/* Coins in mid-air over the edge */}
                    <div className="pointer-events-none absolute left-0 top-0" style={{ width: SHELF_W, height: CATCH_H }}>
                      {falling.map((item) => (
                        <div
                          key={item.key}
                          className="absolute top-0 flex items-center justify-center"
                          style={{ left: item.lane * CELL, width: CELL, height: CELL }}
                        >
                          <div
                            className={item.won ? "cp-fall-won" : "cp-fall-lost"}
                            style={{ ["--drop" as string]: `${CATCH_H - 30}px` }}
                          >
                            <Coin kind={item.coin.kind} />
                          </div>
                        </div>
                      ))}
                    </div>
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