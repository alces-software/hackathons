"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance, getStoredBankingCredentials } from "../../lib/banking";
import { findCosmetic, type CosmeticDiceStyles } from "../../lib/cosmeticsCatalog";

type Phase = "come-out" | "point";

const DEFAULT_DIE: CosmeticDiceStyles = { pip: "bg-slate-900", acePip: "bg-rose-600" };
type Tone = "neutral" | "point" | "win" | "lose";
type HistoryKind = "roll" | "point" | "win" | "lose";
type HistoryEntry = { id: number; total: number; kind: HistoryKind };

const MAX_BET = 250;
const CHIPS = [5, 25, 100, 250];
const ROLL_MS = 1000;
// The dice show the real result once, partway through the tumble.
const SWAP_AT_MS = 650;

function rollDie() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    // Rejection sampling avoids modulo bias (4294967296 isn't divisible by 6).
    const values = new Uint32Array(1);
    const limit = 4294967296 - (4294967296 % 6);
    do {
      crypto.getRandomValues(values);
    } while (values[0] >= limit);
    return (values[0] % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- Dice ---------- */

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

type DieMotion = "idle" | "tumble-a" | "tumble-b" | "land";

function Die({ value, motion, pipClass, acePipClass }: { value: number; motion: DieMotion; pipClass: string; acePipClass: string }) {
  const pips = PIPS[value] ?? PIPS[1];
  return (
    <div className="relative h-24 w-24 sm:h-28 sm:w-28">
      {/* Contact shadow that shrinks as the die lifts off the felt */}
      <div
        aria-hidden
        className={`craps-shadow absolute -bottom-3 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-black/50 blur-md ${
          motion === "tumble-a" || motion === "tumble-b" ? "craps-shadow-roll" : ""
        }`}
      />
      <div
        role="img"
        aria-label={`Die showing ${value}`}
        className={`craps-die grid h-full w-full grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-4 border-sky-200/80 bg-gradient-to-br from-white to-slate-200 p-3 shadow-[0_12px_24px_rgba(0,0,0,0.35),inset_0_-4px_8px_rgba(15,23,42,0.12)] sm:p-4 ${
          motion === "tumble-a" ? "craps-tumble-a" : motion === "tumble-b" ? "craps-tumble-b" : motion === "land" ? "craps-land" : ""
        }`}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="flex items-center justify-center">
            {pips.includes(i) && (
              <span
                className={`block h-[78%] w-[78%] rounded-full shadow-[inset_0_2px_3px_rgba(0,0,0,0.45)] ${
                  value === 1 ? acePipClass : pipClass
                }`}
              />
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Small pieces ---------- */

const TONE_STYLES: Record<Tone, string> = {
  neutral: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  point: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  win: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  lose: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};

const HISTORY_STYLES: Record<HistoryKind, string> = {
  roll: "bg-white/10 text-sky-100",
  point: "bg-amber-400 text-slate-950",
  win: "bg-emerald-400 text-slate-950",
  lose: "bg-rose-500 text-white",
};

const fmt = (n: number) => n.toFixed(2);

/* ---------- Page ---------- */

export default function Craps() {
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [dice, setDice] = useState<[number, number]>([1, 1]);
  const [phase, setPhase] = useState<Phase>("come-out");
  const [point, setPoint] = useState<number | null>(null);
  const [stake, setStake] = useState<number | null>(null);
  const [message, setMessage] = useState("Place a pass line bet and roll the dice.");
  const [tone, setTone] = useState<Tone>("neutral");
  const [rolling, setRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [net, setNet] = useState(0);
  const [diceStyles, setDiceStyles] = useState<CosmeticDiceStyles | null>(null);

  const rollingRef = useRef(false);
  const mounted = useRef(true);
  const historyId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load the equipped dice skin; pass-based, so a cookie wipe cannot steal ownership.
  useEffect(() => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) return;
    let cancelled = false;
    fetch(`/api/cosmetics/pass?username=${encodeURIComponent(credentials.username)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { passes?: Record<string, string> } | null) => {
        if (!body?.passes || cancelled) return;
        const item = findCosmetic(body.passes["craps-dice"] ?? "");
        if (item?.diceStyles) setDiceStyles(item.diceStyles);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const maxAllowed = Math.max(0, Math.min(MAX_BET, Math.floor(balance)));
  const betLocked = stake !== null || rolling;
  const roundActive = stake !== null;

  function say(text: string, nextTone: Tone) {
    setMessage(text);
    setTone(nextTone);
  }

  function pushHistory(total: number, kind: HistoryKind) {
    historyId.current += 1;
    const entry = { id: historyId.current, total, kind };
    setHistory((prev) => [entry, ...prev].slice(0, 14));
  }

  function updateBet(next: number) {
    const safe = Number.isFinite(next) ? Math.round(next) : 1;
    setBet(Math.min(Math.max(safe, 1), MAX_BET));
  }

  async function settle(roundStake: number, won: boolean) {
    try {
      await bankingReturn(roundStake);
      if (won) await bankingPayout(roundStake);
      else await bankingLoss(roundStake);
      await syncBankingBalance(setBalance);
      if (!mounted.current) return;
      setNet((n) => n + (won ? roundStake : -roundStake));
      if (won) {
        say(`You won ${fmt(roundStake)} moose bucks profit — ${fmt(roundStake)} stake returned.`, "win");
      } else {
        say(`The pass line lost. Your ${fmt(roundStake)} moose bucks stake was lost.`, "lose");
      }
    } catch (error) {
      if (!mounted.current) return;
      say(error instanceof Error ? error.message : "Settlement failed.", "lose");
    }
  }

  async function roll() {
    if (rollingRef.current) return;
    rollingRef.current = true;
    setRolling(true);

    try {
      let roundStake = stake;

      // Hold the stake before the come-out roll.
      if (roundStake === null) {
        if (bet < 1 || bet > MAX_BET || bet > balance) {
          say(`Choose a bet between 1 and ${MAX_BET} moose bucks within your available balance.`, "lose");
          return;
        }
        try {
          await bankingStake(bet, "craps", bet * 2);
          await syncBankingBalance(setBalance);
        } catch (error) {
          say(error instanceof Error ? error.message : "Could not place the stake.", "lose");
          return;
        }
        roundStake = bet;
        setStake(bet);
      }

      // Decide the result up front, then let the animation play out.
      const first = rollDie();
      const second = rollDie();
      const total = first + second;

      setHasRolled(true);
      say(phase === "come-out" ? "Dice are in the air…" : `Rolling for the ${point}…`, "neutral");

      // One roll: tumble, show the real faces once, then land.
      await sleep(SWAP_AT_MS);
      if (!mounted.current) return;
      setDice([first, second]);
      await sleep(ROLL_MS - SWAP_AT_MS);
      if (!mounted.current) return;

      setRolling(false);

      const finishRound = async (won: boolean, text: string) => {
        pushHistory(total, won ? "win" : "lose");
        say(text, won ? "win" : "lose");
        setStake(null);
        setPhase("come-out");
        setPoint(null);
        await settle(roundStake as number, won);
      };

      if (phase === "come-out") {
        if (total === 7 || total === 11) {
          await finishRound(true, `${total} — natural! Pass line wins.`);
        } else if (total === 2 || total === 3 || total === 12) {
          await finishRound(false, `${total} — craps! Pass line loses.`);
        } else {
          pushHistory(total, "point");
          setPoint(total);
          setPhase("point");
          say(`${total} is the point. Roll it again before a 7.`, "point");
        }
        return;
      }

      if (total === point) {
        await finishRound(true, `${total} — point made! Pass line wins.`);
      } else if (total === 7) {
        await finishRound(false, "Seven-out. Pass line loses.");
      } else {
        pushHistory(total, "roll");
        say(`${total} — keep rolling for the ${point}.`, "point");
      }
    } finally {
      rollingRef.current = false;
      if (mounted.current) setRolling(false);
    }
  }

  const shown = dice;
  const motionA: DieMotion = rolling ? "tumble-a" : hasRolled ? "land" : "idle";
  const motionB: DieMotion = rolling ? "tumble-b" : hasRolled ? "land" : "idle";
  const total = dice[0] + dice[1];

  const buttonLabel = rolling
    ? "Rolling…"
    : roundActive
      ? `Roll for the ${point}`
      : "Place bet & roll";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <style>{`
        @keyframes craps-tumble-a {
          0%   { transform: translate(-130px, -90px) rotate(0deg) scale(0.75); }
          20%  { transform: translate(-60px, 14px) rotate(260deg) scale(1.08); }
          38%  { transform: translate(-20px, -48px) rotate(430deg) scale(1.02); }
          56%  { transform: translate(14px, 10px) rotate(590deg) scale(1.04); }
          72%  { transform: translate(-8px, -18px) rotate(680deg) scale(1); }
          86%  { transform: translate(5px, 4px) rotate(715deg) scale(1); }
          100% { transform: translate(0, 0) rotate(720deg) scale(1); }
        }
        @keyframes craps-tumble-b {
          0%   { transform: translate(130px, -100px) rotate(0deg) scale(0.75); }
          20%  { transform: translate(64px, 18px) rotate(-240deg) scale(1.08); }
          38%  { transform: translate(24px, -56px) rotate(-420deg) scale(1.02); }
          56%  { transform: translate(-12px, 12px) rotate(-610deg) scale(1.04); }
          72%  { transform: translate(10px, -14px) rotate(-690deg) scale(1); }
          86%  { transform: translate(-4px, 5px) rotate(-715deg) scale(1); }
          100% { transform: translate(0, 0) rotate(-720deg) scale(1); }
        }
        @keyframes craps-land {
          0%   { transform: translateY(-10px) scale(1.07); }
          55%  { transform: translateY(2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes craps-shadow-roll {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.5; }
          20%, 56% { transform: translateX(-50%) scale(0.5); opacity: 0.2; }
          38%      { transform: translateX(-50%) scale(0.35); opacity: 0.12; }
        }
        @keyframes craps-pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        .craps-tumble-a { animation: craps-tumble-a ${ROLL_MS}ms cubic-bezier(0.3, 0.7, 0.4, 1) both; }
        .craps-tumble-b { animation: craps-tumble-b ${ROLL_MS}ms cubic-bezier(0.3, 0.7, 0.4, 1) both; }
        .craps-land { animation: craps-land 320ms ease-out both; }
        .craps-shadow-roll { animation: craps-shadow-roll ${ROLL_MS}ms ease-in-out both; }
        .craps-pop { animation: craps-pop 280ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .craps-tumble-a, .craps-tumble-b, .craps-land, .craps-shadow-roll, .craps-pop { animation: none; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />

      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span>
          <span className="font-serif text-xl font-bold">Alces Casino</span>
        </Link>
        <Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
          Exit to lodge
        </Link>
      </nav>

      <section className="relative mx-auto max-w-5xl px-6 pb-16 pt-6 lg:px-10">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino table</p>
          <h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Craps</h1>
          <p className="mt-2 text-sm text-sky-100/65">Pass line betting — make the point before the seven-out.</p>
        </div>

        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          {/* Header: balance + session */}
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start">
            <div className="flex gap-8">
              <div>
                <p className="text-xs uppercase tracking-wider text-sky-100/65">Banking balance</p>
                <p className="mt-1 text-2xl font-bold text-sky-200">
                  {fmt(balance)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-sky-100/65">This session</p>
                <p className={`mt-1 text-2xl font-bold ${net > 0 ? "text-emerald-300" : net < 0 ? "text-rose-300" : "text-sky-200"}`}>
                  {net > 0 ? "+" : ""}
                  {fmt(net)}
                </p>
              </div>
            </div>
            <p className="max-w-sm text-sm text-sky-100/55">
              Your stake is held before the come-out roll and settled when the pass line resolves.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
            {/* Table */}
            <div className="rounded-2xl border border-sky-300/10 bg-[#071426]/70 p-6">
              <div className="relative flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_center,_rgba(14,116,144,0.28),_rgba(7,20,38,0.6)_70%)] px-4 py-8 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]">
                {/* Point puck */}
                <div className="absolute right-4 top-4 flex flex-col items-center gap-1">
                  <div
                    key={point ?? "off"}
                    className={`craps-pop flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-extrabold ${
                      point !== null
                        ? "border-slate-950 bg-white text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.55)]"
                        : "border-white/20 bg-slate-900 text-white/60"
                    }`}
                  >
                    {point !== null ? point : "OFF"}
                  </div>
                  <span className="text-[10px] font-bold tracking-wider text-sky-100/55">{point !== null ? "ON" : "COME-OUT"}</span>
                </div>

                <div className="mb-8 flex gap-6 pt-6">
                  <Die value={shown[0]} motion={motionA} pipClass={(diceStyles ?? DEFAULT_DIE).pip} acePipClass={(diceStyles ?? DEFAULT_DIE).acePip} />
                  <Die value={shown[1]} motion={motionB} pipClass={(diceStyles ?? DEFAULT_DIE).pip} acePipClass={(diceStyles ?? DEFAULT_DIE).acePip} />
                </div>

                <div className="flex h-8 items-center gap-3 text-sm text-sky-100/70">
                  {hasRolled && !rolling ? (
                    <span key={`${dice[0]}-${dice[1]}-${history.length}`} className="craps-pop rounded-full bg-white/10 px-3 py-1 font-bold text-white">
                      Total {total}
                    </span>
                  ) : (
                    <span>{phase === "come-out" ? "Come-out roll" : `Shooting for ${point}`}</span>
                  )}
                </div>

                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-4 min-h-12 w-full max-w-md rounded-lg border px-4 py-3 text-center text-sm font-semibold transition-colors ${TONE_STYLES[tone]}`}
                >
                  {message}
                </p>
              </div>

              {/* Roll history */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-100/65">Recent rolls</p>
                <div className="flex min-h-9 flex-wrap gap-2">
                  {history.length === 0 && <span className="text-xs text-sky-100/40">No rolls yet.</span>}
                  {history.map((entry) => (
                    <span
                      key={entry.id}
                      title={
                        entry.kind === "win" ? "Pass line win" : entry.kind === "lose" ? "Pass line loss" : entry.kind === "point" ? "Point set" : "No decision"
                      }
                      className={`craps-pop flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${HISTORY_STYLES[entry.kind]}`}
                    >
                      {entry.total}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-sky-100/45">
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />Win</span>
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Loss</span>
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />Point set</span>
                  <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-white/30" />No decision</span>
                </div>
              </div>

              {/* Rules */}
              <div className="mt-6 grid gap-2 text-xs text-sky-100/65 sm:grid-cols-3">
                <div className="rounded-lg bg-white/[0.05] p-3"><b className="text-white">Win:</b> 7 or 11 on come-out, or make the point.</div>
                <div className="rounded-lg bg-white/[0.05] p-3"><b className="text-white">Lose:</b> 2, 3, 12 on come-out, or seven-out.</div>
                <div className="rounded-lg bg-white/[0.05] p-3"><b className="text-white">Point:</b> 4, 5, 6, 8, 9, or 10 must repeat.</div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <label htmlFor="craps-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">
                  Pass line stake
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="craps-bet"
                    type="number"
                    min={1}
                    max={MAX_BET}
                    step={1}
                    value={bet}
                    onChange={(event) => updateBet(Number(event.target.value))}
                    disabled={betLocked}
                    className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400 disabled:opacity-60"
                  />
                  <span className="text-sm text-sky-100/65">moose bucks</span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => updateBet(chip)}
                      disabled={betLocked || chip > balance}
                      aria-pressed={bet === chip}
                      className={`rounded-lg border py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-30 ${
                        bet === chip ? "border-sky-300 bg-sky-400 text-[#071426]" : "border-white/15 bg-white/[0.05] text-sky-100 hover:bg-white/10"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-semibold">
                  <button type="button" onClick={() => updateBet(bet / 2)} disabled={betLocked} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
                    Half
                  </button>
                  <button type="button" onClick={() => updateBet(Math.min(bet * 2, maxAllowed || 1))} disabled={betLocked} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
                    Double
                  </button>
                  <button type="button" onClick={() => updateBet(maxAllowed || 1)} disabled={betLocked || maxAllowed < 1} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
                    Max
                  </button>
                </div>

                {roundActive && <p className="mt-3 text-xs text-amber-200/80">{fmt(stake as number)} moose bucks is riding on this round.</p>}
                {!roundActive && balance < 1 && <p className="mt-3 text-xs text-rose-300">You need at least 1 moose buck to play.</p>}
              </div>

              <button
                onClick={roll}
                disabled={rolling || (!roundActive && balance < 1)}
                className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] transition hover:bg-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {buttonLabel}
              </button>

              <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Pass line payout</p>
                <p className="mt-2 text-sm text-sky-100">
                  Even money — a winning {fmt(stake ?? bet)} stake returns your stake plus {fmt(stake ?? bet)} profit.
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}