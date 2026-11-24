"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import { HOOPS_BALLS, HOOPS_MAX_BET, HOOPS_ROUND_MS, browserRng, judgeHoopsShot, releaseOffsetFromTap, round2 } from "../../lib/arcade";

type Rim = { x: number; y: number };
type ShotLog = { offset: number; rim: Rim; made: boolean; swish: boolean; prize: number };
type HistoryRow = { id: number; bet: number; returned: number; made: number; swishes: number };
type Shot = { id: number; sx: number; sy: number; mx: number; py: number; ex: number; ey: number; fy: number; miss: boolean; kx?: number };
type Confetti = { id: number; dx: number; dy: number; rot: number; delay: number; color: string };
type ShotMark = { id: number; x: number; y: number; kind: "swish" | "basket" | "brick" };

const HOOP_PX = 66;
const FLIGHT_MS = 900; // ball flight time; the net/ring/sparkle effects are timed off this
const LAND_MS = Math.round(FLIGHT_MS * 0.78); // moment the ball reaches the rim
const CONFETTI_COLORS = ["#f97316", "#fbbf24", "#38bdf8", "#34d399", "#f472b6", "#ffffff"];

const animationCss = `
/* ---------- ball flight: arced path, shrinking with distance, drops through the net ---------- */
@keyframes bh-fly {
  0%   { left: var(--sx); top: var(--sy); transform: translate(-50%, -50%) scale(1.5); animation-timing-function: cubic-bezier(0.2, 0.75, 0.35, 1); }
  55%  { left: var(--mx); top: var(--py); transform: translate(-50%, -50%) scale(0.95); animation-timing-function: cubic-bezier(0.5, 0, 0.85, 0.6); }
  78%  { left: var(--ex); top: var(--ey); transform: translate(-50%, -50%) scale(0.8); animation-timing-function: cubic-bezier(0.4, 0, 1, 1); }
  100% { left: var(--ex); top: var(--fy); transform: translate(-50%, -50%) scale(0.68); opacity: 0; }
}
@keyframes bh-spin { to { transform: rotate(540deg); } }
@keyframes bh-spin-hard { to { transform: rotate(-620deg); } }

/* Bricks stop on the flange at 78% flight, then kick off the side and fall away. */
@keyframes bh-fly-miss {
  0%   { left: var(--sx); top: var(--sy); transform: translate(-50%, -50%) scale(1.5); animation-timing-function: cubic-bezier(0.2, 0.75, 0.35, 1); }
  55%  { left: var(--mx); top: var(--py); transform: translate(-50%, -50%) scale(0.95); animation-timing-function: cubic-bezier(0.5, 0, 0.85, 0.6); }
  78%  { left: var(--ex); top: var(--ey); transform: translate(-50%, -50%) scale(0.8); }
  82%  { left: calc(var(--ex) + var(--kx, 0px) * 0.6); top: var(--ey); transform: translate(-50%, -60%) scale(0.75); }
  100% { left: calc(var(--ex) + var(--kx, 0px)); top: calc(var(--ey) + 16%); transform: translate(-50%, -30%) scale(0.6); opacity: 0; }
}

/* ---------- rim / net reactions ---------- */
@keyframes bh-net { 0% { transform: translateX(-50%) scaleY(1); } 25% { transform: translateX(-50%) scaleY(1.9) scaleX(0.9); } 55% { transform: translateX(-50%) scaleY(0.8) scaleX(1.05); } 80% { transform: translateX(-50%) scaleY(1.15); } 100% { transform: translateX(-50%) scaleY(1); } }
@keyframes bh-rim-hit { 0% { transform: translate(-50%, -50%) scale(1); } 30% { transform: translate(-50%, -46%) scale(1.07); } 60% { transform: translate(-50%, -51%) scale(0.98); } 100% { transform: translate(-50%, -50%) scale(1); } }
@keyframes bh-ring { 0% { opacity: 0.85; transform: translate(-50%, -50%) scale(0.7); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(2.3); } }
@keyframes bh-poof { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(0deg); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -190%) scale(1.5) rotate(40deg); } }
@keyframes bh-mark-pop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); } 60% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes bh-rim-glow { 0%, 100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.12), 0 0 14px rgba(249,115,22,0.35), inset 0 0 12px rgba(0,0,0,0.5); } 50% { box-shadow: 0 0 0 3px rgba(255,255,255,0.18), 0 0 30px rgba(249,115,22,0.7), inset 0 0 12px rgba(0,0,0,0.5); } }

/* ---------- ball in hand ---------- */
@keyframes bh-load { 0% { opacity: 0; transform: translate(-50%, 70%) scale(0.5); } 60% { opacity: 1; transform: translate(-50%, -62%) scale(1.12); } 100% { transform: translate(-50%, -50%) scale(1); } }
@keyframes bh-bob { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-7px) rotate(4deg); } }
@keyframes bh-ball-used { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(0.8); } }

/* ---------- HUD ---------- */
@keyframes bh-clock { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
@keyframes bh-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes bh-bump { 0% { transform: scale(1); } 35% { transform: scale(1.28); } 100% { transform: scale(1); } }
@keyframes bh-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bh-slide { from { opacity: 0; transform: translateX(-14px); max-height: 0; } to { opacity: 1; transform: translateX(0); max-height: 40px; } }
@keyframes bh-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,146,60,0.55); } 70% { box-shadow: 0 0 0 14px rgba(251,146,60,0); } }

/* ---------- results ---------- */
@keyframes bh-confetti {
  0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(0.6); }
  45%  { opacity: 1; transform: translate(calc(var(--dx) * 0.75), var(--dy)) rotate(calc(var(--rot) * 0.5)) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 190px)) rotate(var(--rot)) scale(0.9); }
}
@keyframes bh-float { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); } 20% { opacity: 1; transform: translate(-50%, -14px) scale(1.15); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -70px) scale(1); } }
@keyframes bh-shake { 0%, 100% { transform: translateX(0); } 15% { transform: translateX(-8px); } 30% { transform: translateX(7px); } 45% { transform: translateX(-5px); } 60% { transform: translateX(4px); } 80% { transform: translateX(-2px); } }
@keyframes bh-flash { 0% { opacity: 0.5; } 100% { opacity: 0; } }

.bh-court { background: radial-gradient(ellipse at 50% 112%, rgba(251, 146, 60, 0.15), transparent 55%), radial-gradient(circle at 50% -10%, rgba(56, 189, 248, 0.12), transparent 50%), #061731; }
.bh-shake { animation: bh-shake 0.5s ease-in-out; }

.bh-rim { position: absolute; width: ${HOOP_PX}px; height: ${HOOP_PX}px; border: 5px solid #f97316; border-radius: 9999px; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12), 0 0 20px rgba(249, 115, 22, 0.45), inset 0 0 12px rgba(0, 0, 0, 0.5); transform: translate(-50%, -50%); transition: left 0.95s ease-in-out, top 0.95s ease-in-out; }
.bh-rim-live { animation: bh-rim-glow 1.6s ease-in-out infinite; }
.bh-rim-hit { animation: bh-rim-hit 0.45s ease-out ${LAND_MS - 40}ms; }
.bh-ring { position: absolute; left: 50%; top: 50%; width: 100%; height: 100%; border: 3px solid #fde68a; border-radius: 9999px; pointer-events: none; opacity: 0; animation: bh-ring 0.6s ease-out ${LAND_MS}ms both; }
.bh-net { position: absolute; left: 50%; top: 90%; width: 58%; height: 14px; transform: translateX(-50%); transform-origin: top center; border-radius: 0 0 8px 8px; background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.5) 0 2px, transparent 2px 8px); }
.bh-net-kick { animation: bh-net 0.55s ease-out ${LAND_MS}ms; }

.bh-cue { position: absolute; font-size: 2.4rem; transform: translate(-50%, -50%); pointer-events: none; filter: drop-shadow(0 5px 9px rgba(0, 0, 0, 0.55)); transition: left 0.95s ease-in-out; animation: bh-load 0.45s cubic-bezier(0.3, 1.4, 0.5, 1) both; }
.bh-cue > span { display: block; animation: bh-bob 1.4s ease-in-out infinite; }

.bh-fly { position: absolute; font-size: 1.6rem; line-height: 1; pointer-events: none; z-index: 2; animation: bh-fly ${FLIGHT_MS}ms both; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5)); }
.bh-fly > span { display: block; animation: bh-spin ${FLIGHT_MS}ms linear both; }
.bh-fly-miss { animation-name: bh-fly-miss; }
.bh-fly-miss > span { animation-name: bh-spin-hard; }
.bh-fly-ghost { z-index: 1; opacity: 0.28; filter: blur(1.5px); }
.bh-fly-ghost2 { z-index: 1; opacity: 0.14; filter: blur(3px); }
.bh-poof { position: absolute; pointer-events: none; font-size: 1.7rem; z-index: 3; opacity: 0; animation: bh-poof 0.7s ease-out ${LAND_MS}ms both; }
/* Only makes interact with the net: bricks have their own kick-off cue. */
.bh-miss .bh-ring, .bh-miss .bh-net-kick, .bh-miss .bh-rim-hit, .bh-miss .bh-poof { display: none; }
.bh-ball-pip { display: inline-block; font-size: 1.05rem; transition: opacity 0.3s, filter 0.3s; }
.bh-ball-pip-used { opacity: 0.25; filter: grayscale(1); animation: bh-ball-used 0.4s ease-out both; }

.bh-clock-pill { transition: background 0.3s, color 0.3s; }
.bh-clock-urgent { color: #fecaca; background: rgba(127, 29, 29, 0.8); animation: bh-clock 0.7s ease-in-out infinite; }
.bh-bar { position: absolute; left: 0; top: 0; height: 4px; width: 100%; transform-origin: left center; background: linear-gradient(90deg, #fb923c, #fbbf24); animation: bh-bar linear both; z-index: 4; }
.bh-bar-urgent { background: linear-gradient(90deg, #ef4444, #f97316); }
.bh-bump { animation: bh-bump 0.45s ease-out; }
.bh-fade { animation: bh-fade 0.3s ease-out both; }
.bh-slide { overflow: hidden; animation: bh-slide 0.4s ease-out both; }
.bh-pulse { animation: bh-pulse 1.8s ease-out infinite; }

.bh-confetti { position: absolute; width: 8px; height: 14px; border-radius: 2px; pointer-events: none; z-index: 5; opacity: 0; animation: bh-confetti 1.5s cubic-bezier(0.2, 0.7, 0.4, 1) both; }
.bh-float { position: absolute; left: 50%; top: 52%; pointer-events: none; z-index: 6; font-weight: 800; font-size: 2.2rem; color: #fde68a; text-shadow: 0 3px 14px rgba(249, 115, 22, 0.8), 0 0 2px #000; opacity: 0; animation: bh-float 1.8s ease-out both; }
.bh-flash { position: absolute; inset: 0; pointer-events: none; z-index: 5; opacity: 0; animation: bh-flash 0.7s ease-out both; }

.bh-mark { position: absolute; transform: translate(-50%, -50%); pointer-events: none; font-size: 1.1rem; font-weight: 800; z-index: 6; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7); }
.bh-mark-swish { color: #fde047; }
.bh-mark-basket { color: #86efac; }
.bh-mark-brick { color: #f87171; }
.bh-mark-fresh { animation: bh-mark-pop 0.6s cubic-bezier(0.3, 1.5, 0.5, 1) both; }

@media (prefers-reduced-motion: reduce) {
  .bh-fly, .bh-fly > span, .bh-poof, .bh-ring, .bh-net-kick, .bh-rim-hit, .bh-rim-live, .bh-cue, .bh-cue > span, .bh-fade, .bh-slide,
  .bh-bump, .bh-shake, .bh-confetti, .bh-float, .bh-flash, .bh-pulse, .bh-clock-urgent, .bh-ball-pip-used, .bh-mark-fresh { animation-duration: 0.01s; animation-iteration-count: 1; }
  .bh-rim, .bh-cue { transition-duration: 0.01s; }
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
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / ms);
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

export default function Basketball() {
  const [balance, setBalance] = useBankingBalance();
  const shownBalance = useCountUp(balance);
  const [bet, setBet] = useState(10);
  const [message, setMessage] = useState("Buy in, then tap the rim to launch each of the five balls.");
  const [clock, setClock] = useState(HOOPS_ROUND_MS / 1000);
  const [live, setLive] = useState(false);
  const [round, setRound] = useState(0);
  const [rim, setRim] = useState<Rim>({ x: 50, y: 24 });
  const [ballCount, setBallCount] = useState(HOOPS_BALLS);
  const [baskets, setBaskets] = useState(0);
  const [swishes, setSwishes] = useState(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotMarks, setShotMarks] = useState<ShotMark[]>([]);
  const [lastLand, setLastLand] = useState<{ x: number; y: number; id: number } | null>(null);
  const [lastLandMiss, setLastLandMiss] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [settling, setSettling] = useState(false);
  const [celebrate, setCelebrate] = useState<{ id: number; amount: number; confetti: Confetti[] } | null>(null);
  const [shake, setShake] = useState(0);
  const settledRef = useRef(true);
  const liveRef = useRef(false);
  const stakeRef = useRef(0);
  const roundStartRef = useRef(0);
  const shotLogRef = useRef<ShotLog[]>([]);
  const idRef = useRef(0);
  const courtRef = useRef<HTMLDivElement | null>(null);

  const urgent = live && clock <= 5;

  useEffect(() => {
    if (!live) return;
    const ticker = window.setInterval(() => {
      setClock(Math.max(0, Math.ceil((HOOPS_ROUND_MS - (Date.now() - roundStartRef.current)) / 1000)));
    }, 200);
    return () => window.clearInterval(ticker);
  }, [live]);

  useEffect(() => {
    if (!live) return;
    const drift = window.setInterval(() => {
      setRim((current) => ({
        x: Math.min(90, Math.max(10, current.x + (Math.random() - 0.5) * 8)),
        y: Math.min(38, Math.max(14, current.y + (Math.random() - 0.5) * 5)),
      }));
    }, 950);
    return () => window.clearInterval(drift);
  }, [live]);

  async function startRound() {
    if (live || settling) return;
    if (bet < 1 || bet > HOOPS_MAX_BET || bet > balance) {
      setMessage(`Choose a buy-in between 1 and ${HOOPS_MAX_BET} moose bucks within your available balance.`);
      return;
    }
    try {
      await bankingStake(bet, "basketball");
      await syncBankingBalance(setBalance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not place the stake.");
      return;
    }
    stakeRef.current = bet;
    shotLogRef.current = [];
    liveRef.current = true;
    setShots([]);
    setShotMarks([]);
    setLastLand(null);
    setLastLandMiss(false);
    setCelebrate(null);
    setBaskets(0);
    setSwishes(0);
    setBallCount(HOOPS_BALLS);
    setClock(HOOPS_ROUND_MS / 1000);
    setRim({ x: 50, y: 24 });
    setRound((current) => current + 1);
    // eslint-disable-next-line react-hooks/purity -- the round clock must anchor to the real wall clock
    roundStartRef.current = Date.now();
    settledRef.current = false;
    setLive(true);
    setMessage("Cabinet live — the rim drifts, the clock runs. Tap the rim for each of the five balls.");
    window.setTimeout(() => void finishRound(), HOOPS_ROUND_MS);
  }

  function shoot(event: MouseEvent<HTMLDivElement>) {
    if (!live || settledRef.current || shotLogRef.current.length >= HOOPS_BALLS) return;
    const court = courtRef.current;
    if (!court) return;
    const rect = court.getBoundingClientRect();
    const tapX = event.clientX - rect.left;
    const tapY = event.clientY - rect.top;
    const rimEl = court.querySelector<HTMLElement>(".bh-rim");
    const rimCenterX = rimEl ? rimEl.offsetLeft + rimEl.offsetWidth / 2 : rect.width * (rim.x / 100);
    const rimCenterY = rimEl ? rimEl.offsetTop + rimEl.offsetHeight / 2 : rect.height * (rim.y / 100);
    const offset = releaseOffsetFromTap(tapX, tapY, rimCenterX, rimCenterY, HOOP_PX / 2);
    const rimAtShot: Rim = { x: (rimCenterX / rect.width) * 100, y: (rimCenterY / rect.height) * 100 };

    // Visual only: the ball arcs toward the side of the rim you tapped, then drops through.
    const drift = Math.max(-9, Math.min(9, ((tapX - rimCenterX) / rect.width) * 100));
    const id = ++idRef.current;
    // Judge immediately with the sensor that scores the round, so the live
    // counters and rim marks match the printed ticket.
    const verdict = judgeHoopsShot(offset, browserRng);
    shotLogRef.current = [...shotLogRef.current, { offset, rim: rimAtShot, made: verdict.made, swish: verdict.swish, prize: verdict.prize }];
    setBaskets((current) => current + (verdict.made && !verdict.swish ? 1 : 0));
    setSwishes((current) => current + (verdict.swish ? 1 : 0));
    setShotMarks((current) => [...current, { id, x: rimAtShot.x, y: rimAtShot.y - 9, kind: verdict.swish ? "swish" : verdict.made ? "basket" : "brick" }]);
    const peak = Math.max(3, rimAtShot.y - 16);
    // The arc mirrors the verdict: a make drops through the net, a brick
    // falls onto the flange and kicks out the side instead.
    const missKx = Math.sign(drift || 1) * 7;
    setShots((current) => [
      ...current,
      verdict.made
        ? { id, sx: rimAtShot.x, sy: 94, mx: rimAtShot.x + drift, py: peak, ex: rimAtShot.x, ey: rimAtShot.y + 1, fy: rimAtShot.y + 14, miss: false }
        : { id, sx: rimAtShot.x, sy: 94, mx: rimAtShot.x + drift, py: peak, ex: rimAtShot.x, ey: rimAtShot.y - 5, fy: rimAtShot.y - 6, miss: true, kx: missKx },
    ].slice(-4));
    setLastLand(verdict.made ? { x: rimAtShot.x, y: rimAtShot.y - 3, id } : null);
    setLastLandMiss(!verdict.made);
    setBallCount(HOOPS_BALLS - shotLogRef.current.length);
    if (shotLogRef.current.length >= HOOPS_BALLS) setMessage("Five balls up — ride out the clock or cash the ticket early.");
  }

  async function finishRound() {
    if (settledRef.current || !liveRef.current) return;
    settledRef.current = true;
    liveRef.current = false;
    setSettling(true);
    const stakeUsed = stakeRef.current;
    // Each shot was already judged by the sensor when it was tapped; settling
    // replays those verdicts instead of re-rolling, so the ticket matches
    // what the counters showed live.
    const releases = shotLogRef.current.map((shot) => ({ offset: shot.offset, made: shot.made, swish: shot.swish, prize: shot.prize }));
    const made = releases.filter((result) => result.made).length;
    const swishCount = releases.filter((result) => result.swish).length;
    const settlement = { shots: releases, makes: made, swishes: swishCount, returned: round2(releases.reduce((sum, result) => sum + result.prize, 0) * stakeUsed) };
    try {
      await bankingReturn(stakeUsed);
      if (settlement.returned > stakeUsed) await bankingPayout(round2(settlement.returned - stakeUsed));
      else if (settlement.returned < stakeUsed) await bankingLoss(round2(stakeUsed - settlement.returned));
      await syncBankingBalance(setBalance);
    } catch (error) {
      setSettling(false);
      setLive(false);
      setMessage(error instanceof Error ? error.message : "Payout failed.");
      return;
    }
    setHistory((current) => [{ id: ++idRef.current, bet: stakeUsed, returned: settlement.returned, made, swishes: swishCount }, ...current].slice(0, 10));
    setLive(false);
    setSettling(false);

    if (settlement.returned > 0) {
      const count = swishCount > 0 ? 36 : 22;
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
        ? `Ticket printed: ${made}/${HOOPS_BALLS} balls banked${swishCount ? ` including ${swishCount} swish${swishCount === 1 ? "" : "es"}` : ""}, ${settlement.returned.toFixed(2)} of your ${stakeUsed.toFixed(2)} buy-in printed back.`
        : "Brick after brick — the cabinet keeps this one. Run it back?",
    );
  }

  const ballsUsed = HOOPS_BALLS - ballCount;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <style>{animationCss}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.2),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.14),_transparent_35%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/arcade" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-400 text-2xl text-[#071426]">🏀</span><span className="font-serif text-xl font-bold">Alces Arcade</span></Link>
        <Link href="/arcade" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">← Back to the arcade</Link>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10">
        <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-300">Arcade cabinet</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Basketball Hoops</h1><p className="mt-2 text-sm text-sky-100/65">Buy in for a 30-second window and five balls. Tap the drifting rim to launch each shot — a clean swish prints the biggest ticket.</p></div>
        <section className="rounded-3xl border border-orange-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p><p className="mt-1 text-2xl font-bold text-orange-200"><span key={Math.round(balance * 100)} className="bh-bump inline-block">{shownBalance.toFixed(2)}</span> <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Settlements are processed through your connected banking account.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_300px]">
            <div>
              <div key={shake} className={`bh-court relative h-[420px] overflow-hidden rounded-2xl border border-orange-300/20 shadow-[inset_0_0_60px_rgba(0,0,0,0.45)] ${shake ? "bh-shake" : ""} ${lastLandMiss ? "bh-miss" : ""}`}>
                {live && <div key={round} className={`bh-bar ${urgent ? "bh-bar-urgent" : ""}`} style={{ animationDuration: `${HOOPS_ROUND_MS}ms` }} />}
                <div ref={courtRef} className="absolute inset-0 cursor-crosshair" onClick={shoot} role="button" tabIndex={-1} aria-label="Basketball court — tap the rim to shoot">
                  <div className={`bh-rim ${live ? "bh-rim-live" : ""} ${lastLand ? "bh-rim-hit" : ""}`} key={`rim-${lastLand?.id ?? 0}`} style={{ left: `${rim.x}%`, top: `${rim.y}%` }}>
                    <div className="bh-ring" />
                    <div className={`bh-net ${lastLand ? "bh-net-kick" : ""}`} />
                  </div>
                  <div className="absolute left-1/2 top-5 flex -translate-x-1/2 flex-col items-center gap-1.5">
                    <div className={`bh-clock-pill rounded-full bg-slate-950/75 px-4 py-1 text-base font-bold tabular-nums text-orange-200 ${urgent ? "bh-clock-urgent" : ""}`}>
                      {live ? `${clock}s · ${ballCount} ball${ballCount === 1 ? "" : "s"} up` : `Buy-in screen · ${HOOPS_BALLS} balls`}
                    </div>
                    <div className="flex gap-1" aria-hidden="true">
                      {Array.from({ length: HOOPS_BALLS }, (_, i) => (
                        <span key={i} className={`bh-ball-pip ${live && i < ballsUsed ? "bh-ball-pip-used" : ""}`}>🏀</span>
                      ))}
                    </div>
                  </div>
                  {live && ballCount > 0 && <span key={`cue-${ballCount}`} className="bh-cue" style={{ left: `${rim.x}%`, top: "94%" }}><span>🏀</span></span>}
                  {shots.map((shot) => {
                    const vars = { "--sx": `${shot.sx}%`, "--sy": `${shot.sy}%`, "--mx": `${shot.mx}%`, "--py": `${shot.py}%`, "--ex": `${shot.ex}%`, "--ey": `${shot.ey}%`, "--fy": `${shot.fy}%`, "--kx": `${(shot.kx ?? 0) * 4}px` } as CSSProperties;
                    const flyClass = shot.miss ? "bh-fly bh-fly-miss" : "bh-fly";
                    return (
                      <span key={shot.id}>
                        <span className={`${flyClass} bh-fly-ghost2`} style={{ ...vars, animationDelay: "0.09s" }}><span>🏀</span></span>
                        <span className={`${flyClass} bh-fly-ghost`} style={{ ...vars, animationDelay: "0.045s" }}><span>🏀</span></span>
                        <span className={flyClass} style={vars}><span>🏀</span></span>
                      </span>
                    );
                  })}
                  {lastLand && <span key={`poof-${lastLand.id}`} className="bh-poof" style={{ left: `${lastLand.x}%`, top: `${lastLand.y}%` }}>✨</span>}
                  {shotMarks.map((mark, index) => (
                    <span
                      key={`mark-${mark.id}`}
                      className={`bh-mark bh-mark-${mark.kind} ${index === shotMarks.length - 1 ? "bh-mark-fresh" : ""}`}
                      style={{ left: `${mark.x}%`, top: `${mark.y}%` }}
                      aria-hidden="true"
                    >
                      {mark.kind === "swish" ? "★" : mark.kind === "basket" ? "●" : "✕"}
                    </span>
                  ))}
                </div>
                {celebrate && (
                  <div key={celebrate.id} className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="bh-flash bg-orange-300/40" />
                    {celebrate.confetti.map((piece) => (
                      <span key={piece.id} className="bh-confetti" style={{ left: "50%", top: "45%", background: piece.color, animationDelay: `${piece.delay}s`, "--dx": `${piece.dx}px`, "--dy": `${piece.dy}px`, "--rot": `${piece.rot}deg` } as CSSProperties} />
                    ))}
                    <span className="bh-float">+{celebrate.amount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <p key={message} className="bh-fade mt-6 min-h-6 text-center text-sm font-semibold text-sky-100" aria-live="polite">{message}</p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><label htmlFor="hoops-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Buy-in</label><div className="mt-2 flex items-center gap-2"><input id="hoops-bet" type="number" min="1" max={HOOPS_MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={live} className="w-full rounded-lg border border-orange-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none transition focus:border-orange-400 focus:shadow-[0_0_0_3px_rgba(251,146,60,0.25)] disabled:opacity-60" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Cabinet limit: {HOOPS_MAX_BET} moose bucks</p></div>
              <button onClick={startRound} disabled={live || settling} className={`w-full rounded-xl bg-orange-400 px-4 py-3 text-sm font-bold text-[#071426] transition duration-150 hover:-translate-y-0.5 hover:bg-orange-300 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${!live && !settling ? "bh-pulse" : ""}`}>{settling ? "Printing ticket…" : live ? `Round live — ${ballsUsed}/${HOOPS_BALLS} up` : "Insert coins"}</button>
              <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"><p key={`b${baskets}`} className={`text-2xl font-bold text-orange-200 ${baskets ? "bh-bump" : ""}`}>{baskets}</p><p className="text-xs text-sky-100/55">baskets</p></div><div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"><p key={`s${swishes}`} className={`text-2xl font-bold text-yellow-300 ${swishes ? "bh-bump" : ""}`}>{swishes}</p><p className="text-xs text-sky-100/55">swishes</p></div></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-100/55">How it works</p><p className="mt-2 text-sm leading-6 text-sky-100/65">A rim tap prints 16% of your buy-in as a ticket; a clean swish prints 35%. The rim drifts between shots — judge the arc yourself, the sensor at the rim does the scoring.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wider text-sky-100/55">Last {history.length || 0} rounds</p>{history.length === 0 ? <p className="mt-2 text-sm text-sky-100/45">No rounds played yet.</p> : <ul className="mt-2 space-y-1.5">{history.map((row) => <li key={row.id} className="bh-slide flex items-center justify-between text-sm"><span className="text-sky-100/70">{row.swishes}×swish {row.made - row.swishes}×basket · bet {row.bet.toFixed(2)}</span><span className={row.returned > row.bet ? "font-bold text-emerald-300" : row.returned > 0 ? "text-amber-300" : "text-rose-300"}>{row.returned > 0 ? `+${row.returned.toFixed(2)}` : "no ticket"}</span></li>)}</ul>}</div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}