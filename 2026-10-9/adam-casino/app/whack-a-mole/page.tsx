"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import { MOLE_MAX_BET, MOLE_POPS, browserRng, planMoleRound, round2, settleMoleRound } from "../../lib/arcade";
import type { MoleSpawn, MoleTap } from "../../lib/arcade";

type Phase = "idle" | "playing" | "over";
type HistoryRow = { id: number; bet: number; returned: number; whacks: number };
type Confetti = { id: number; dx: number; dy: number; rot: number; delay: number; color: string };

const RETREAT_MS = 400; // how long a missed mole stays mounted while it sinks back into the hole
const CONFETTI_COLORS = ["#38bdf8", "#fbbf24", "#f97316", "#34d399", "#f472b6", "#ffffff"];

const animationCss = `
/* ---------- mole life cycle: pop, idle bob, retreat, squash ---------- */
@keyframes wm-pop { 0% { transform: translateY(110%) scale(0.85, 1.15); } 55% { transform: translateY(-10%) scale(0.96, 1.08); } 78% { transform: translateY(3%) scale(1.06, 0.94); } 100% { transform: translateY(0) scale(1); } }
@keyframes wm-retreat { 0% { transform: translateY(0) rotate(0deg); } 20% { transform: translateY(-4%) rotate(-5deg); } 100% { transform: translateY(115%) rotate(6deg); } }
@keyframes wm-squash { 0% { transform: translateY(0) scale(1, 1); } 22% { transform: translateY(24%) scale(1.25, 0.55); } 45% { transform: translateY(18%) scale(1.14, 0.7); } 100% { transform: translateY(125%) scale(1, 0.9); } }
@keyframes wm-bob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-4%) rotate(3deg); } }
@keyframes wm-aura { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
@keyframes wm-twinkle { 0%, 100% { opacity: 0; transform: scale(0.3) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(90deg); } }

/* ---------- hole effects ---------- */
@keyframes wm-dust-ring { 0% { opacity: 0.7; transform: scale(0.5); } 100% { opacity: 0; transform: scale(1.5); } }
@keyframes wm-dust { 0% { opacity: 0.9; transform: rotate(var(--a)) translateX(10px) scale(1); } 100% { opacity: 0; transform: rotate(var(--a)) translateX(44px) scale(0.3); } }
@keyframes wm-wave { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); filter: brightness(1.7); } }
@keyframes wm-hole-flash { 0% { box-shadow: inset 0 0 0 0 rgba(255, 255, 255, 0.6); } 100% { box-shadow: inset 0 0 0 0 rgba(255, 255, 255, 0); } }

/* ---------- mallet + hit feedback ---------- */
@keyframes wm-mallet { 0% { opacity: 0; transform: rotate(-75deg) scale(0.9); } 25% { opacity: 1; transform: rotate(-60deg) scale(1); } 50% { opacity: 1; transform: rotate(18deg) scale(1.08); } 75% { opacity: 1; transform: rotate(10deg); } 100% { opacity: 0; transform: rotate(10deg) scale(0.95); } }
@keyframes wm-poof { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0.4); } 35% { opacity: 1; transform: translate(-50%, -80%) scale(1.3); } 100% { opacity: 0; transform: translate(-50%, -125%) scale(0.9); } }
@keyframes wm-burst { 0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.2); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.9); } }
@keyframes wm-label { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.5) rotate(-8deg); } 25% { opacity: 1; transform: translate(-50%, -16px) scale(1.2) rotate(-4deg); } 75% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -48px) scale(1) rotate(-4deg); } }

/* ---------- HUD ---------- */
@keyframes wm-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes wm-pip-live { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }
@keyframes wm-pip-swung { 0% { transform: scale(1); } 40% { transform: scale(1.5); } 100% { transform: scale(1); } }
@keyframes wm-bump { 0% { transform: scale(1); } 35% { transform: scale(1.28); } 100% { transform: scale(1); } }
@keyframes wm-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes wm-slide { from { opacity: 0; transform: translateX(-14px); max-height: 0; } to { opacity: 1; transform: translateX(0); max-height: 40px; } }
@keyframes wm-shimmer { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
@keyframes wm-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.55); } 70% { box-shadow: 0 0 0 14px rgba(56, 189, 248, 0); } }

/* ---------- results ---------- */
@keyframes wm-confetti {
  0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(0.6); }
  45%  { opacity: 1; transform: translate(calc(var(--dx) * 0.75), var(--dy)) rotate(calc(var(--rot) * 0.5)) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 190px)) rotate(var(--rot)) scale(0.9); }
}
@keyframes wm-float { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); } 20% { opacity: 1; transform: translate(-50%, -14px) scale(1.15); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -70px) scale(1); } }
@keyframes wm-shake { 0%, 100% { transform: translateX(0); } 15% { transform: translateX(-8px); } 30% { transform: translateX(7px); } 45% { transform: translateX(-5px); } 60% { transform: translateX(4px); } 80% { transform: translateX(-2px); } }
@keyframes wm-flash { 0% { opacity: 0.5; } 100% { opacity: 0; } }

.wm-hole { border-radius: 9999px; background: radial-gradient(circle at 50% 20%, #06192b 0%, #04101d 65%, #030b14 100%); box-shadow: inset 0 8px 16px rgba(0, 0, 0, 0.75), inset 0 -4px 10px rgba(56, 189, 248, 0.12), 0 2px 0 rgba(255, 255, 255, 0.05); }
.wm-wave { animation: wm-wave 0.5s ease-in-out; animation-delay: calc(var(--i) * 70ms); }
.wm-flash-hole { animation: wm-hole-flash 0.35s ease-out; }
.wm-idle-shimmer { animation: wm-shimmer 4.5s ease-in-out infinite; animation-delay: calc(var(--i) * 220ms); }

/* clip hides the mole below the hole's lower edge but lets it rise above the top */
.wm-clip { position: absolute; inset: 0; clip-path: inset(-55% -12% 0 -12% round 0 0 50% 50%); pointer-events: none; }
.wm-clip > * { pointer-events: auto; }
.wm-mole { position: absolute; inset: 8%; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: clamp(1.4rem, 4vw, 2.1rem); background: radial-gradient(circle at 50% 28%, #7a5c3a 0%, #4b3a26 60%, #2f2418 100%); box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.18), inset 0 -6px 12px rgba(0, 0, 0, 0.45), 0 6px 12px rgba(0, 0, 0, 0.4); animation: wm-pop 0.34s cubic-bezier(0.2, 0.9, 0.3, 1) both; cursor: pointer; }
.wm-mole > .wm-face { display: block; animation: wm-bob 0.7s ease-in-out 0.34s infinite; }
.wm-retreat { animation: wm-retreat ${RETREAT_MS}ms cubic-bezier(0.5, 0, 0.8, 0.4) both; pointer-events: none; }
.wm-retreat > .wm-face, .wm-down > .wm-face { animation: none; }
.wm-down { animation: wm-squash 0.5s cubic-bezier(0.3, 0.7, 0.3, 1) both; pointer-events: none; }
.wm-golden { background: radial-gradient(circle at 50% 28%, #fde68a 0%, #d97706 55%, #92400e 100%); box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.35), inset 0 -6px 12px rgba(0, 0, 0, 0.35), 0 0 18px rgba(251, 191, 36, 0.55), 0 6px 12px rgba(0, 0, 0, 0.4); }
.wm-aura { position: absolute; inset: -8%; border-radius: 9999px; box-shadow: 0 0 22px 6px rgba(251, 191, 36, 0.75); pointer-events: none; animation: wm-aura 0.9s ease-in-out infinite; }
.wm-spark { position: absolute; font-size: 0.9rem; pointer-events: none; opacity: 0; animation: wm-twinkle 1s ease-in-out infinite; }

.wm-dust-ring { position: absolute; inset: 6%; border: 3px solid rgba(186, 154, 110, 0.8); border-radius: 9999px; pointer-events: none; animation: wm-dust-ring 0.5s ease-out both; }
.wm-dust { position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; margin: -4px 0 0 -4px; border-radius: 9999px; background: #b89a6c; pointer-events: none; animation: wm-dust 0.5s ease-out both; }

.wm-mallet { position: absolute; right: -6%; top: -34%; font-size: 2.2rem; transform-origin: 85% 90%; pointer-events: none; z-index: 4; opacity: 0; animation: wm-mallet 0.4s ease-out both; filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.5)); }
.wm-poof { position: absolute; left: 50%; top: 24%; font-size: 1.7rem; pointer-events: none; animation: wm-poof 0.6s ease-out 0.1s both; z-index: 3; opacity: 0; }
.wm-burst { position: absolute; left: 50%; top: 40%; width: 90%; height: 90%; border: 4px solid #fde68a; border-radius: 9999px; pointer-events: none; z-index: 3; opacity: 0; animation: wm-burst 0.5s ease-out 0.1s both; }
.wm-label { position: absolute; left: 50%; top: 4%; font-weight: 900; font-size: 1rem; letter-spacing: 0.04em; color: #fde68a; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8); pointer-events: none; z-index: 5; opacity: 0; animation: wm-label 0.9s ease-out 0.1s both; white-space: nowrap; }

.wm-bar { height: 100%; transform-origin: left center; background: linear-gradient(90deg, #38bdf8, #fbbf24); animation: wm-bar linear both; }
.wm-pip { position: relative; display: inline-block; font-size: 1.5rem; transition: opacity 0.3s, filter 0.3s; opacity: 0.35; filter: grayscale(1); }
.wm-pip-live { opacity: 1; filter: none; animation: wm-pip-live 0.5s ease-in-out infinite; }
.wm-pip-swung { opacity: 1; filter: none; animation: wm-pip-swung 0.4s ease-out; }
.wm-pip-swung::after { content: "✓"; position: absolute; right: -4px; bottom: -4px; font-size: 0.8rem; font-weight: 900; color: #071426; background: #34d399; border-radius: 9999px; width: 1.1em; height: 1.1em; line-height: 1.1em; text-align: center; }
.wm-pip-missed::after { content: "✕"; position: absolute; right: -4px; bottom: -4px; font-size: 0.7rem; font-weight: 900; color: #fff; background: #f43f5e; border-radius: 9999px; width: 1.2em; height: 1.2em; line-height: 1.2em; text-align: center; }

.wm-bump { animation: wm-bump 0.45s ease-out; }
.wm-fade { animation: wm-fade 0.3s ease-out both; }
.wm-slide { overflow: hidden; animation: wm-slide 0.4s ease-out both; }
.wm-pulse { animation: wm-pulse 1.8s ease-out infinite; }
.wm-shake { animation: wm-shake 0.5s ease-in-out; }
.wm-confetti { position: absolute; width: 8px; height: 14px; border-radius: 2px; pointer-events: none; opacity: 0; animation: wm-confetti 1.5s cubic-bezier(0.2, 0.7, 0.4, 1) both; }
.wm-float { position: absolute; left: 50%; top: 48%; pointer-events: none; font-weight: 800; font-size: 2.2rem; color: #fde68a; text-shadow: 0 3px 14px rgba(56, 189, 248, 0.8), 0 0 2px #000; opacity: 0; animation: wm-float 1.8s ease-out both; }
.wm-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; animation: wm-flash 0.7s ease-out both; }

@media (prefers-reduced-motion: reduce) {
  .wm-mole, .wm-mole > .wm-face, .wm-retreat, .wm-down, .wm-aura, .wm-spark, .wm-dust-ring, .wm-dust, .wm-mallet, .wm-poof, .wm-burst, .wm-label,
  .wm-wave, .wm-flash-hole, .wm-pip-live, .wm-pip-swung, .wm-bump, .wm-slide, .wm-shake, .wm-confetti, .wm-float, .wm-flash, .wm-pulse { animation-duration: 0.01s; animation-iteration-count: 1; }
  .wm-fade, .wm-idle-shimmer { animation: none; }
}
`;

// Eases a displayed number toward its target (used for the banking balance).
function useCountUp(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (frame: number) => {
      const progress = Math.min(1, (frame - start) / ms);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setValue(next);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export default function WhackAMole() {
  const [balance, setBalance] = useBankingBalance();
  const shownBalance = useCountUp(balance);
  const [bet, setBet] = useState(10);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [spawns, setSpawns] = useState<MoleSpawn[]>([]);
  const [message, setMessage] = useState("Choose a bet and start the cabinet.");
  const [settling, setSettling] = useState(false);
  const [squashed, setSquashed] = useState<Set<number>>(new Set());
  const [poofAt, setPoofAt] = useState<{ hole: number; key: number; golden: boolean } | null>(null);
  const [swing, setSwing] = useState<{ hole: number; key: number } | null>(null);
  const [now, setNow] = useState(0);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [celebrate, setCelebrate] = useState<{ id: number; amount: number; confetti: Confetti[] } | null>(null);
  const [shake, setShake] = useState(0);
  const roundStartRef = useRef(0);
  const tapsRef = useRef<MoleTap[]>([]);
  const settledRef = useRef(true);
  const stakeRef = useRef(0);
  const idRef = useRef(0);

  const playing = phase === "playing";
  const lastDown = spawns.length ? spawns[spawns.length - 1].downAtMs : 0;
  const popsUpcoming = spawns.filter((candidate) => now < candidate.upAtMs).length;
  const roundMs = lastDown + 700;

  useEffect(() => {
    if (!playing) return;
    const ticker = window.setInterval(() => setNow(Math.max(0, performance.now() - roundStartRef.current)), 60);
    return () => window.clearInterval(ticker);
  }, [playing]);

  async function finishRound() {
    if (settledRef.current || !playing) return;
    settledRef.current = true;
    setSettling(true);
    const stakeUsed = stakeRef.current;
    const settlement = settleMoleRound(spawns, tapsRef.current, stakeUsed, browserRng);
    try {
      await bankingReturn(stakeUsed);
      if (settlement.returned > stakeUsed) await bankingPayout(round2(settlement.returned - stakeUsed));
      else if (settlement.returned < stakeUsed) await bankingLoss(round2(stakeUsed - settlement.returned));
      await syncBankingBalance(setBalance);
    } catch (error) {
      setSettling(false);
      setMessage(error instanceof Error ? error.message : "Payout failed.");
      return;
    }
    setHistory((current) => [{ id: ++idRef.current, bet: stakeUsed, returned: settlement.returned, whacks: settlement.whacks }, ...current].slice(0, 10));
    setPhase("over");
    setSettling(false);

    if (settlement.returned > 0) {
      const count = settlement.returned > stakeUsed ? 36 : 22;
      const confetti: Confetti[] = Array.from({ length: count }, (_, i) => ({
        id: i,
        dx: (Math.random() - 0.5) * 460,
        dy: -(60 + Math.random() * 190),
        rot: (Math.random() - 0.5) * 900,
        delay: Math.random() * 0.15,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      }));
      setCelebrate({ id: ++idRef.current, amount: settlement.returned, confetti });
    } else {
      setShake((current) => current + 1);
    }

    setMessage(
      settlement.returned > 0
        ? `Ticket printed: ${settlement.whacks}/${MOLE_POPS} whacked, ${settlement.returned.toFixed(2)} of your ${stakeUsed.toFixed(2)} stake printed back.`
        : `The pad scored none of your ${MOLE_POPS} swings — nothing printed. Play again?`,
    );
  }

  useEffect(() => {
    if (!playing) return;
    const endTimer = window.setTimeout(() => void finishRound(), lastDown + 700);
    return () => window.clearTimeout(endTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle inputs refresh per round; timer only needs the deadline
  }, [playing, lastDown]);

  async function startRound() {
    if (playing || settling) return;
    if (bet < 1 || bet > MOLE_MAX_BET || bet > balance) {
      setMessage(`Choose a bet between 1 and ${MOLE_MAX_BET} moose bucks within your available balance.`);
      return;
    }
    try {
      await bankingStake(bet, "whackamole");
      await syncBankingBalance(setBalance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not place the stake.");
      return;
    }
    stakeRef.current = bet;
    tapsRef.current = [];
    setSquashed(new Set());
    setPoofAt(null);
    setSwing(null);
    setCelebrate(null);
    setSpawns(planMoleRound(browserRng).spawns);
    setRound((current) => current + 1);
    roundStartRef.current = performance.now();
    settledRef.current = false;
    setNow(0);
    setPhase("playing");
    setMessage("Cabinet live — three pops coming up.");
  }

  function tap(hole: number) {
    if (!playing) return;
    const spawn = spawns.find((candidate) => candidate.hole === hole && now >= candidate.upAtMs && now <= candidate.downAtMs);
    if (!spawn || squashed.has(spawn.id)) return;
    // eslint-disable-next-line react-hooks/purity -- tap timing must read the live clock
    const tappedAt = Math.round(performance.now() - roundStartRef.current);
    tapsRef.current.push({ moleId: spawn.id, atMs: tappedAt });
    setSquashed((current) => new Set([...current, spawn.id]));
    setPoofAt({ hole, key: ++idRef.current, golden: spawn.kind === "golden" });
  }

  // Any swing at the board plays the mallet, whether or not a mole was up. Scoring is unchanged.
  function swingAt(hole: number) {
    if (!playing) return;
    setSwing({ hole, key: ++idRef.current });
  }

  function moleFor(hole: number) {
    const spawn = spawns.find((candidate) => candidate.hole === hole);
    if (!spawn || !playing || now < spawn.upAtMs || now > spawn.downAtMs + RETREAT_MS) return null;
    return { spawn, hit: squashed.has(spawn.id), retreating: now > spawn.downAtMs };
  }

  function pipState(spawn: MoleSpawn | undefined) {
    if (!spawn) return "";
    if (squashed.has(spawn.id)) return "wm-pip-swung";
    if (now > spawn.downAtMs) return "wm-pip-missed";
    if (now >= spawn.upAtMs) return "wm-pip-live";
    return "";
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <style>{animationCss}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/arcade" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Arcade</span></Link>
        <Link href="/arcade" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">← Back to the arcade</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Arcade cabinet</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Whack-a-Mole</h1><p className="mt-2 text-sm text-sky-100/65">Three pops on a steady rhythm. Time your mallet while they are up and the cabinet prints a slice of your stake back as a ticket.</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200"><span key={Math.round(balance * 100)} className="wm-bump inline-block">{shownBalance.toFixed(2)}</span> <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Settlements are processed through your connected banking account.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_300px]">
            <div>
              <div key={shake} className={`relative rounded-2xl border border-amber-300/15 bg-[radial-gradient(circle_at_50%_0%,_rgba(251,191,36,0.14),_transparent_55%),#08304f] p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)] sm:p-6 ${shake ? "wm-shake" : ""}`}>
                <div className="mx-auto mb-4 flex max-w-[420px] items-center gap-4">
                  <div className="flex gap-2.5" aria-hidden="true">
                    {Array.from({ length: spawns.length || MOLE_POPS }, (_, i) => (
                      <span key={`${round}-${i}`} className={`wm-pip ${pipState(spawns[i])}`}>🐹</span>
                    ))}
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    {playing && <div key={round} className="wm-bar" style={{ animationDuration: `${roundMs}ms` }} />}
                  </div>
                </div>
                <div className="mx-auto grid max-w-[420px] grid-cols-3 gap-3 sm:gap-4">
                  {Array.from({ length: 9 }, (_, hole) => {
                    const mole = moleFor(hole);
                    const poof = poofAt?.hole === hole ? poofAt : null;
                    const mallet = swing?.hole === hole ? swing : null;
                    const golden = mole?.spawn.kind === "golden";
                    const moleClass = mole ? (mole.hit ? "wm-down" : mole.retreating ? "wm-retreat" : "") : "";
                    return (
                      <div key={hole} style={{ "--i": hole } as CSSProperties} className="relative aspect-square" onClick={() => swingAt(hole)}>
                        <div key={`hole-${round}`} className={`wm-hole absolute inset-0 ${!playing && phase === "idle" ? "wm-idle-shimmer" : ""} ${playing && now < 700 ? "wm-wave" : ""}`}></div>
                        {mole && (
                          <>
                            <span key={`ring-${mole.spawn.id}`} className="wm-dust-ring" />
                            {[0, 72, 144, 216, 288].map((angle) => (
                              <span key={`${mole.spawn.id}-${angle}`} className="wm-dust" style={{ "--a": `${angle}deg` } as CSSProperties} />
                            ))}
                            <div className="wm-clip">
                              <button
                                type="button"
                                aria-label={golden ? "Golden moose up" : "Mole up"}
                                onClick={() => tap(hole)}
                                className={`wm-mole ${moleClass} ${golden ? "wm-golden" : ""}`}
                              >
                                {golden && <span className="wm-aura" />}
                                <span className="wm-face">{golden ? "🫎" : "🐹"}</span>
                                {golden && !mole.hit && !mole.retreating && (
                                  <>
                                    <span className="wm-spark" style={{ left: "6%", top: "10%" }}>✨</span>
                                    <span className="wm-spark" style={{ right: "4%", top: "30%", animationDelay: "0.35s" }}>✨</span>
                                    <span className="wm-spark" style={{ left: "20%", bottom: "6%", animationDelay: "0.7s" }}>✨</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                        {mallet && <span key={`mallet-${mallet.key}`} className="wm-mallet">🔨</span>}
                        {poof && (
                          <span key={poof.key}>
                            <span className="wm-burst" />
                            <span className="wm-poof">💥</span>
                            <span className="wm-label">{poof.golden ? "GOLD!" : "BONK!"}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-center text-xs font-bold uppercase tracking-wider text-amber-200/80">{playing ? `${popsUpcoming} pop${popsUpcoming === 1 ? "" : "s"} still to come` : phase === "over" ? "Last ticket printed" : "Cabinet ready"}</p>
                {celebrate && (
                  <div key={celebrate.id} className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="wm-flash bg-sky-300/40" />
                    {celebrate.confetti.map((piece) => (
                      <span key={piece.id} className="wm-confetti" style={{ left: "50%", top: "45%", background: piece.color, animationDelay: `${piece.delay}s`, "--dx": `${piece.dx}px`, "--dy": `${piece.dy}px`, "--rot": `${piece.rot}deg` } as CSSProperties} />
                    ))}
                    <span className="wm-float">+{celebrate.amount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <p key={message} className="wm-fade mt-6 min-h-6 text-center text-sm font-semibold text-sky-100" aria-live="polite">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><label htmlFor="mole-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet amount</label><div className="mt-2 flex items-center gap-2"><input id="mole-bet" type="number" min="1" max={MOLE_MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={playing} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none transition focus:border-sky-400 focus:shadow-[0_0_0_3px_rgba(56,189,248,0.25)] disabled:opacity-60" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Cabinet limit: {MOLE_MAX_BET} moose bucks</p></div>
              <button onClick={startRound} disabled={playing || settling} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${playing ? "bg-amber-400 text-[#071426]" : "bg-sky-400 text-[#071426] hover:bg-sky-300 wm-pulse"}`}>{playing ? (settling ? "Printing ticket…" : "Round running…") : phase === "over" ? "Play again" : "Insert coins"}</button>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-100/55">How it works</p><p className="mt-2 text-sm leading-6 text-sky-100/65">One stake buys three pops on a steady rhythm. A plastic mole prints 21% of your stake as a ticket, a golden moose prints 80%. Swing while a pop is solidly up — the pad scores the mallet&apos;s landing, not your click.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-100/55">Last {history.length || 0} rounds</p>{history.length === 0 ? <p className="mt-2 text-sm text-sky-100/45">No rounds played yet.</p> : <ul className="mt-2 space-y-1.5">{history.map((row) => <li key={row.id} className="wm-slide flex items-center justify-between text-sm"><span className="text-sky-100/70">{row.whacks}/{MOLE_POPS} · bet {row.bet.toFixed(2)}</span><span className={row.returned > row.bet ? "font-bold text-emerald-300" : row.returned > 0 ? "text-amber-300" : "text-rose-300"}>{row.returned > 0 ? `+${row.returned.toFixed(2)}` : "no ticket"}</span></li>)}</ul>}</div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}