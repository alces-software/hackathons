"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bankingPayout, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import type { CSSProperties } from "react";

type RoundStatus = "ready" | "running" | "crashed" | "cashed-out";

const MOOSE_FACES_LEFT = true;

const GROWTH = 0.15;
const OFFSET = 0.125 / GROWTH;
const HOUSE_RETURN = 0.97;
const multiplierAt = (seconds: number) => (1 + OFFSET) * Math.exp(GROWTH * seconds) - OFFSET;
const timeToReach = (point: number) => Math.log((point + OFFSET) / (1 + OFFSET)) / GROWTH;

function getCrashPoint() {
  const roll = Math.random();
  return Math.max(1.01, Math.min(20, Number((HOUSE_RETURN / (1 - roll)).toFixed(2))));
}

const LEFT = 56;
const RIGHT = 610;
const TOP = 40;
const GROUND = 330;

const stars = Array.from({ length: 36 }, (_, i) => ({ x: (i * 89 + 13) % 640, y: (i * 47 + 7) % 200, r: 0.7 + (i % 3) * 0.35, delay: (i % 9) * 0.37 }));
const flakes = Array.from({ length: 22 }, (_, i) => ({ x: (i * 29 + 5) % 640, r: 1 + (i % 3) * 0.6, dur: 6 + (i % 5) * 1.6, delay: -(i * 0.9) }));
const sparkDirs = Array.from({ length: 8 }, (_, i) => ({ dx: [44, 31, 0, -31, -44, -31, 0, 31][i], dy: [0, 31, 44, 31, 0, -31, -44, -31][i] }));

function pines(base: number, minHeight: number, maxHeight: number, gap: number) {
  let d = "";
  for (let i = 0; i < 640 / gap; i += 1) {
    const x = i * gap + gap / 2 + ((i * 37) % 11) - 5;
    const h = minHeight + (((i * 53) % 7) / 6) * (maxHeight - minHeight);
    const w = h * 0.55;
    d += `M${x} ${base - h}L${x - w * 0.5} ${base - h * 0.55}L${x + w * 0.5} ${base - h * 0.55}Z`;
    d += `M${x} ${base - h * 0.75}L${x - w * 0.7} ${base - h * 0.28}L${x + w * 0.7} ${base - h * 0.28}Z`;
    d += `M${x} ${base - h * 0.45}L${x - w * 0.9} ${base}L${x + w * 0.9} ${base}Z`;
  }
  return d;
}
const farPines = pines(342, 40, 70, 40);
const nearPines = pines(346, 62, 104, 64);

const animationCss = `
@keyframes bm-twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
@keyframes bm-aurora { from { transform: translateX(-34px); opacity: 0.25; } to { transform: translateX(34px); opacity: 0.55; } }
@keyframes bm-scroll { from { transform: translateX(0); } to { transform: translateX(-640px); } }
@keyframes bm-snow { from { transform: translate(0, -12px); } to { transform: translate(22px, 430px); } }
@keyframes bm-bob { 0%, 100% { transform: translateY(-1.5px); } 50% { transform: translateY(2.5px); } }
@keyframes bm-hop { 0% { transform: translateY(0); } 20% { transform: translateY(-28px); } 40% { transform: translateY(0); } 60% { transform: translateY(-15px); } 80%, 100% { transform: translateY(0); } }
@keyframes bm-tumble {
  0% { transform: translate(0, 0) rotate(0deg); }
  35% { transform: translate(14px, -28px) rotate(200deg); }
  100% { transform: translate(34px, var(--drop)) rotate(450deg); }
}
@keyframes bm-ring { from { transform: scale(0.2); opacity: 0.9; } to { transform: scale(1.8); opacity: 0; } }
@keyframes bm-spark { from { transform: translate(0, 0) scale(0.4); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(1.3); opacity: 0; } }
@keyframes bm-fadein { from { opacity: 0; } to { opacity: 1; } }
@keyframes bm-dizzy { 0%, 100% { transform: translateX(-4px); } 50% { transform: translateX(4px); } }
@keyframes bm-shake { 0%, 100% { transform: translate(0, 0); } 15% { transform: translate(-7px, 3px); } 35% { transform: translate(6px, -3px); } 55% { transform: translate(-4px, 2px); } 75% { transform: translate(3px, -1px); } }
@keyframes bm-flash { from { opacity: 0.55; } to { opacity: 0; } }
@keyframes bm-pop { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes bm-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55); } 50% { box-shadow: 0 0 0 10px rgba(52, 211, 153, 0); } }
.bm-twinkle { animation: bm-twinkle 3s ease-in-out infinite; }
.bm-aurora { animation: bm-aurora 9s ease-in-out infinite alternate; }
.bm-scroll { animation: bm-scroll 30s linear infinite; animation-play-state: paused; }
.bm-scroll-near { animation-duration: 12s; }
.bm-run .bm-scroll { animation-play-state: running; }
.bm-snow { animation: bm-snow 8s linear infinite; }
.bm-bob { animation: bm-bob 1.8s ease-in-out infinite; }
.bm-bob-fast { animation-duration: 0.4s; }
.bm-hop { animation: bm-hop 1s ease-out both; }
.bm-tumble, .bm-ring { transform-box: fill-box; transform-origin: center; }
.bm-tumble { animation: bm-tumble 0.95s cubic-bezier(0.4, 0, 0.9, 0.6) both; }
.bm-ring { animation: bm-ring 0.8s ease-out 0.6s both; }
.bm-spark { animation: bm-spark 0.9s ease-out both; }
.bm-dizzy { animation: bm-fadein 0.4s ease-out 1s both, bm-dizzy 1s ease-in-out 1s infinite; }
.bm-shake { animation: bm-shake 0.55s ease-in-out; }
.bm-flash { animation: bm-flash 0.7s ease-out both; }
.bm-pop { animation: bm-pop 0.45s ease-out; }
.bm-btn-glow { animation: bm-glow 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .bm-twinkle, .bm-aurora, .bm-scroll, .bm-snow, .bm-bob, .bm-hop, .bm-ring, .bm-spark, .bm-dizzy, .bm-shake, .bm-flash, .bm-pop, .bm-btn-glow { animation: none; }
  .bm-tumble { animation-duration: 0.01s; }
}
`;

function tierLabel(multiplier: number) {
  if (multiplier < 1.5) return "Out for a stroll";
  if (multiplier < 2.5) return "Trotting through the pines";
  if (multiplier < 5) return "Full gallop";
  if (multiplier < 10) return "Antlers high!";
  return "King of the forest";
}

const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

export default function Crash() {
  const MAX_BET = 250;
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [status, setStatus] = useState<RoundStatus>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [cashMultiplier, setCashMultiplier] = useState<number | null>(null);
  const [message, setMessage] = useState("Place a bet and send the moose out.");
  const [roundId, setRoundId] = useState(0);
  const [history, setHistory] = useState<{ id: number; point: number; cashed: boolean }[]>([]);
  const round = useRef<{ id: number; start: number; point: number; crashTime: number; stake: number } | null>(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function tick(now: number) {
    const current = round.current;
    if (!current) return;
    const seconds = Math.max(0, (now - current.start) / 1000);
    if (seconds >= current.crashTime) {
      round.current = null;
      raf.current = 0;
      setElapsed(current.crashTime);
      setStatus("crashed");
      setHistory((list) => [{ id: current.id, point: current.point, cashed: false }, ...list].slice(0, 10));
      setMessage(`Crashed at ${current.point.toFixed(2)}× — the moose took a tumble and ${current.stake.toFixed(2)} stake was lost.`);
      return;
    }
    setElapsed(seconds);
    raf.current = requestAnimationFrame(tick);
  }

  async function startRound() {
    if (status === "running") return;
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
    const point = getCrashPoint();
    cancelAnimationFrame(raf.current);
    round.current = { id: roundId + 1, start: performance.now(), point, crashTime: timeToReach(point), stake: bet };
    setCrashPoint(point);
    setCashMultiplier(null);
    setElapsed(0);
    setStatus("running");
    setMessage("The moose is off — hop off before it crashes.");
    setRoundId((current) => current + 1);
    raf.current = requestAnimationFrame(tick);
  }

  async function cashOut() {
    const current = round.current;
    if (status !== "running" || !current) return;
    const seconds = (performance.now() - current.start) / 1000;
    if (seconds >= current.crashTime) return; 
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    const multiplier = Math.floor(multiplierAt(seconds) * 100) / 100;
    const returned = current.stake * multiplier;
    const profit = returned - current.stake;
    try {
      await bankingPayout(returned);
      await syncBankingBalance(setBalance);
    } catch (error) {
      raf.current = requestAnimationFrame(tick);
      setMessage(error instanceof Error ? error.message : "Payout failed.");
      return;
    }
    round.current = null;
    setElapsed(seconds);
    setCashMultiplier(multiplier);
    setStatus("cashed-out");
    setHistory((list) => [{ id: current.id, point: current.point, cashed: true }, ...list].slice(0, 10));
    setMessage(`Cashed out at ${multiplier.toFixed(2)}× — ${profit.toFixed(2)} profit + ${current.stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.`);
  }

  function resetRound() {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    round.current = null;
    setStatus("ready");
    setElapsed(0);
    setCrashPoint(null);
    setCashMultiplier(null);
    setMessage("Place a bet and send the moose out.");
  }

  const multiplier = status === "running" ? Math.max(1, Math.floor(multiplierAt(elapsed) * 100) / 100) : status === "crashed" ? crashPoint ?? 1 : status === "cashed-out" ? cashMultiplier ?? 1 : 1;
  const tip = multiplierAt(elapsed);
  const tMax = Math.max(7, elapsed * 1.08);
  const mMax = Math.max(2, tip * 1.12);
  const px = (t: number) => LEFT + (t / tMax) * (RIGHT - LEFT);
  const py = (value: number) => GROUND - ((value - 1) / (mMax - 1)) * (GROUND - TOP);

  const curve = elapsed > 0 ? Array.from({ length: 61 }, (_, i) => { const t = (elapsed * i) / 60; return `${px(t).toFixed(1)} ${py(multiplierAt(t)).toFixed(1)}`; }) : [];
  const linePath = curve.length ? `M${curve.join("L")}` : "";
  const areaPath = curve.length ? `${linePath}L${px(elapsed).toFixed(1)} ${GROUND}L${LEFT} ${GROUND}Z` : "";
  const mooseX = px(elapsed);
  const mooseY = py(tip) - 16;
  const slope = ((GROWTH * (tip + OFFSET)) / (mMax - 1)) * (GROUND - TOP) / ((RIGHT - LEFT) / tMax);
  const angle = status === "ready" ? 0 : Math.round(-Math.min(40, (Math.atan(slope) * 180) / Math.PI) * 10) / 10;

  const range = mMax - 1;
  const step = [0.25, 0.5, 1, 2, 5, 10, 20].find((candidate) => range / candidate <= 5) ?? 20;
  const ticks: number[] = [];
  for (let v = Math.ceil(1.0001 / step) * step; v < mMax; v += step) if (v > 1.0001) ticks.push(v);

  const stroke = status === "crashed" ? "#fb7185" : status === "cashed-out" ? "#34d399" : "#38bdf8";
  const areaFill = status === "crashed" ? "url(#bm-area-lose)" : status === "cashed-out" ? "url(#bm-area-win)" : "url(#bm-area-run)";
  const dropPx = GROUND + 6 - mooseY;
  const ended = status === "crashed" || status === "cashed-out";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <style>{animationCss}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Moose Crash</h1><p className="mt-2 text-sm text-sky-100/65">Ride the moose as the multiplier climbs, then hop off before it hits the ground.</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55"></p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_280px]">
            <div>
              <div key={status === "crashed" ? `crash-${roundId}` : "scene"} className={`relative overflow-hidden rounded-2xl border border-sky-300/15 bg-[#040f1f] ${status === "crashed" ? "bm-shake" : ""}`}>
                <svg viewBox="0 0 640 400" role="img" aria-label="Moose riding the rising multiplier curve" className={`bm-scene block h-auto w-full ${status === "running" ? "bm-run" : ""}`}>
                  <defs>
                    <linearGradient id="bm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#040f1f" /><stop offset="100%" stopColor="#0b3550" /></linearGradient>
                    <linearGradient id="bm-snow-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cfe8f7" stopOpacity="0.85" /><stop offset="100%" stopColor="#5f8fb0" stopOpacity="0.9" /></linearGradient>
                    <linearGradient id="bm-area-run" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" /><stop offset="100%" stopColor="#38bdf8" stopOpacity="0" /></linearGradient>
                    <linearGradient id="bm-area-win" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity="0.4" /><stop offset="100%" stopColor="#34d399" stopOpacity="0" /></linearGradient>
                    <linearGradient id="bm-area-lose" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity="0.4" /><stop offset="100%" stopColor="#fb7185" stopOpacity="0" /></linearGradient>
                    <filter id="bm-blur" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="14" /></filter>
                    <filter id="bm-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4" /></filter>
                  </defs>
                  <rect width="640" height="400" fill="url(#bm-sky)" />
                  {stars.map((star, i) => <circle key={i} className="bm-twinkle" cx={star.x} cy={star.y} r={star.r} fill="#e0f2fe" style={{ animationDelay: `${star.delay}s` }} />)}
                  <g className="bm-aurora" filter="url(#bm-blur)"><ellipse cx="200" cy="72" rx="170" ry="22" fill="#34d399" opacity="0.5" /><ellipse cx="430" cy="98" rx="190" ry="18" fill="#38bdf8" opacity="0.45" /></g>
                  <path d="M0 340L0 250L70 205L120 245L190 170L260 240L330 195L400 250L470 180L540 235L600 200L640 230L640 340Z" fill="#12455c" opacity="0.85" />
                  <g className="bm-scroll" style={{ animationDuration: "46s" }}><path d={farPines} fill="#0c3a4d" /><path d={farPines} fill="#0c3a4d" transform="translate(640 0)" /></g>
                  <g className="bm-scroll bm-scroll-near"><path d={nearPines} fill="#072b3f" /><path d={nearPines} fill="#072b3f" transform="translate(640 0)" /></g>
                  <rect x="0" y="338" width="640" height="62" fill="url(#bm-snow-ground)" />
                  <line x1={LEFT} y1={GROUND} x2={RIGHT} y2={GROUND} stroke="#e0f2fe" strokeOpacity="0.35" />
                  {ticks.map((value) => (
                    <g key={value}>
                      <line x1={LEFT} y1={py(value)} x2={RIGHT} y2={py(value)} stroke="#bae6fd" strokeOpacity="0.14" strokeDasharray="4 6" />
                      <text x={LEFT - 8} y={py(value) + 3} textAnchor="end" fontSize="10" fill="#bae6fd" opacity="0.6">{fmt(value)}×</text>
                    </g>
                  ))}
                  {linePath && (
                    <g>
                      <path d={areaPath} fill={areaFill} />
                      <path d={linePath} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" filter="url(#bm-glow)" />
                      <path d={linePath} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
                  {flakes.map((flake, i) => <circle key={i} className="bm-snow" cx={flake.x} cy="0" r={flake.r} fill="#ffffff" opacity="0.7" style={{ animationDuration: `${flake.dur}s`, animationDelay: `${flake.delay}s` }} />)}

                  {status === "crashed" && <ellipse className="bm-ring" key={`ring-${roundId}`} cx={mooseX + 34} cy={GROUND + 8} rx="26" ry="7" fill="none" stroke="#fb7185" strokeWidth="2" />}
                  <g transform={`translate(${mooseX.toFixed(1)} ${mooseY.toFixed(1)})`}>
                    <g key={`${roundId}-${status}`} className={status === "crashed" ? "bm-tumble" : status === "cashed-out" ? "bm-hop" : ""} style={{ "--drop": `${dropPx.toFixed(1)}px` } as CSSProperties}>
                      <g transform={`rotate(${angle})`}>
                        <g className={status === "running" ? "bm-bob bm-bob-fast" : status === "ready" ? "bm-bob" : ""}>
                          <text textAnchor="middle" dominantBaseline="central" fontSize="40" transform={MOOSE_FACES_LEFT ? "scale(-1 1)" : undefined}>🫎</text>
                        </g>
                      </g>
                    </g>
                  </g>
                  {status === "crashed" && (
                    <g transform={`translate(${(mooseX + 34).toFixed(1)} ${(mooseY + dropPx).toFixed(1)})`} key={`dizzy-${roundId}`}>
                      <text className="bm-dizzy" x="0" y="-30" textAnchor="middle" dominantBaseline="central" fontSize="20">💫</text>
                    </g>
                  )}
                  {status === "cashed-out" && (
                    <g transform={`translate(${mooseX.toFixed(1)} ${mooseY.toFixed(1)})`} key={`sparks-${roundId}`}>
                      {sparkDirs.map((dir, i) => <text key={i} className="bm-spark" textAnchor="middle" dominantBaseline="central" fontSize="14" fill="#fde68a" style={{ "--dx": `${dir.dx}px`, "--dy": `${dir.dy - 10}px` } as CSSProperties}>✦</text>)}
                    </g>
                  )}
                </svg>
                <div className="pointer-events-none absolute left-5 top-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-100/70 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">{status === "ready" ? "Moose is waiting at the treeline" : status === "running" ? tierLabel(multiplier) : status === "crashed" ? "Moose took a tumble" : "Safe landing"}</p>
                  <p key={ended ? `end-${roundId}` : "live"} className={`mt-1 text-6xl font-black tracking-tight [text-shadow:0_2px_14px_rgba(0,0,0,0.7)] sm:text-7xl ${ended ? "bm-pop" : ""} ${status === "crashed" ? "text-rose-400" : status === "cashed-out" ? "text-emerald-300" : "text-sky-200"}`}>{multiplier.toFixed(2)}×</p>
                  {crashPoint && ended && <p className="mt-1 text-sm text-sky-100/70 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">{status === "cashed-out" ? "It would have crashed at" : "Crash point"}: {crashPoint.toFixed(2)}×</p>}
                </div>
                {status === "crashed" && <div key={`flash-${roundId}`} className="bm-flash pointer-events-none absolute inset-0 bg-rose-500/40" />}
              </div>
              {history.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Recent rounds">
                  <span className="mr-1 text-xs text-sky-100/55">Recent</span>
                  {history.map((entry, index) => <span key={entry.id} className={`rounded-md px-2 py-1 text-xs font-black ${entry.point >= 5 ? "bg-amber-500 text-slate-950" : entry.point >= 2 ? "bg-sky-600 text-white" : "bg-rose-600/80 text-white"} ${entry.cashed ? "ring-2 ring-emerald-300" : ""} ${index === 0 ? "" : "opacity-80"}`} title={entry.cashed ? "You cashed out this round" : "Crashed"}>{entry.point.toFixed(2)}×</span>)}
                </div>
              )}
              <p className="mt-5 min-h-6 text-center text-sm font-semibold text-sky-100" aria-live="polite">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><label htmlFor="crash-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet amount</label><div className="mt-2 flex items-center gap-2">              <input id="crash-bet" type="number" min="1" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={status === "running"} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Table limit: {MAX_BET} moose bucks</p></div>
              <button onClick={status === "running" ? cashOut : startRound} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition active:scale-95 ${status === "running" ? "bm-btn-glow bg-emerald-400 text-[#071426] hover:bg-emerald-300" : "bg-sky-400 text-[#071426] hover:bg-sky-300"}`}>{status === "running" ? `Hop off at ${multiplier.toFixed(2)}×` : status === "crashed" || status === "cashed-out" ? "Another run" : "Send the moose"}</button>
              {status !== "ready" && status !== "running" && <button onClick={resetRound} className="w-full text-xs text-sky-100/65 hover:text-white">Reset round</button>}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-100/55">How payouts work</p><p className="mt-2 text-sm leading-6 text-sky-100/65">Your stake is deducted when the moose sets off. Hopping off returns your stake multiplied by the current multiplier. If it crashes first, the stake is lost. The crash curve targets a 97% return to player.</p></div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
