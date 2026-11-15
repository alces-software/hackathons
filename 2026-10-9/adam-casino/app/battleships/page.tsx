"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import MultiplayerBattleships from "./MultiplayerBattleships";

const SIZE = 8;
const MAX_BET = 250;
const FIRE_MS = 450;
const AI_THINK_MS = 750; 
const CHIPS = [5, 25, 100, 250];
const COLUMNS = "ABCDEFGH";
const FLEET = [
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Destroyer", length: 3 },
  { name: "Patrol boat", length: 2 },
] as const;

type Cell = "water" | "hit" | "miss";
type Ship = { name: string; cells: number[]; horizontal: boolean };
type Phase = "setup" | "playing" | "won" | "lost";
type Turn = "player" | "enemy";
type Tone = "neutral" | "hit" | "sunk" | "win" | "lose";
type LogEntry = { id: number; side: "you" | "enemy"; text: string; tone: Tone };

const TONE_STYLES: Record<Tone, string> = {
  neutral: "border-sky-300/20 bg-sky-300/10 text-sky-100",
  hit: "border-orange-300/40 bg-orange-300/10 text-orange-100",
  sunk: "border-amber-300/50 bg-amber-300/15 text-amber-100",
  win: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  lose: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};

function randomInt(max: number) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max;
    do crypto.getRandomValues(values); while (values[0] >= limit);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Cells a ship would cover when the player points at `cell`, nudged back inside the board. */
function footprint(cell: number, length: number, horizontal: boolean) {
  let row = Math.floor(cell / SIZE);
  let col = cell % SIZE;
  if (horizontal) col = Math.min(col, SIZE - length);
  else row = Math.min(row, SIZE - length);
  return Array.from({ length }, (_, i) => (row + (horizontal ? 0 : i)) * SIZE + col + (horizontal ? i : 0));
}

function buildFleet(): Ship[] {
  const occupied = new Set<number>();
  const ships: Ship[] = [];
  for (const definition of FLEET) {
    let cells: number[] = [];
    let horizontal = true;
    while (cells.length === 0) {
      horizontal = randomInt(2) === 0;
      const row = randomInt(horizontal ? SIZE : SIZE - definition.length + 1);
      const column = randomInt(horizontal ? SIZE - definition.length + 1 : SIZE);
      const candidate = Array.from({ length: definition.length }, (_, index) =>
        (row + (horizontal ? 0 : index)) * SIZE + column + (horizontal ? index : 0)
      );
      if (candidate.every((cell) => !occupied.has(cell))) {
        cells = candidate;
        candidate.forEach((cell) => occupied.add(cell));
      }
    }
    ships.push({ name: definition.name, cells, horizontal });
  }
  return ships;
}

function emptyBoard(): Cell[] {
  return Array.from({ length: SIZE * SIZE }, () => "water");
}

function cellLabel(cell: number) {
  return `${COLUMNS[cell % SIZE]}${Math.floor(cell / SIZE) + 1}`;
}

const isSunk = (ship: Ship, shots: Cell[]) => ship.cells.every((c) => shots[c] === "hit");
const allSunk = (ships: Ship[], shots: Cell[]) => ships.length > 0 && ships.every((s) => isSunk(s, shots));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fmt = (n: number) => n.toFixed(2);

/**
 * Enemy targeting: hunt on a checkerboard pattern, and once it scores a hit it works
 * the neighbouring squares, preferring to continue a line of hits. It never looks at
 * your ship positions. Tweak this function to make the enemy easier or harder.
 */
function pickAiShot(shots: Cell[], ships: Ship[]): number {
  const sunk = new Set<number>();
  ships.forEach((s) => {
    if (isSunk(s, shots)) s.cells.forEach((c) => sunk.add(c));
  });
  const live = shots.map((_, i) => i).filter((i) => shots[i] === "hit" && !sunk.has(i));

  if (live.length > 0) {
    const scores = new Map<number, number>();
    for (const h of live) {
      const row = Math.floor(h / SIZE);
      const col = h % SIZE;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
        const target = r * SIZE + c;
        if (shots[target] !== "water") continue;
        let score = 1;
        const br = row - dr;
        const bc = col - dc;
        if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE && live.includes(br * SIZE + bc)) score += 4;
        scores.set(target, Math.max(scores.get(target) ?? 0, score));
      }
    }
    if (scores.size > 0) {
      const best = Math.max(...scores.values());
      const pool = [...scores.entries()].filter(([, s]) => s === best).map(([cell]) => cell);
      return pool[randomInt(pool.length)];
    }
  }

  const water = shots.map((_, i) => i).filter((i) => shots[i] === "water");
  const parity = water.filter((i) => (Math.floor(i / SIZE) + (i % SIZE)) % 2 === 0);
  const pool = parity.length > 0 ? parity : water;
  return pool[randomInt(pool.length)];
}

function Crosshair({ className = "text-white" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`bs-lock h-3/4 w-3/4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
    </svg>
  );
}


export default function Battleships() {
  const [gameTab, setGameTab] = useState<"local" | "multiplayer">("multiplayer");
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [phase, setPhase] = useState<Phase>("setup");
  const [turn, setTurn] = useState<Turn>("player");
  const [stake, setStake] = useState<number | null>(null);

  // Placement
  const [playerShips, setPlayerShips] = useState<Ship[]>([]);
  const [selected, setSelected] = useState<string | null>(FLEET[0].name);
  const [horizontal, setHorizontal] = useState(true);
  const [hover, setHover] = useState<number | null>(null);

  // Battle
  const [enemyFleet, setEnemyFleet] = useState<Ship[]>([]);
  const [myShots, setMyShots] = useState<Cell[]>(emptyBoard); // my shots at the enemy
  const [enemyShots, setEnemyShots] = useState<Cell[]>(emptyBoard); // enemy shots at me
  const [pendingEnemy, setPendingEnemy] = useState<number | null>(null);
  const [pendingMine, setPendingMine] = useState<number | null>(null);
  const [lastEnemy, setLastEnemy] = useState<number | null>(null);
  const [lastMine, setLastMine] = useState<number | null>(null);
  const [shakeEnemy, setShakeEnemy] = useState(0);
  const [shakeMine, setShakeMine] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);

  const [message, setMessage] = useState("Place your fleet, then start the battle.");
  const [tone, setTone] = useState<Tone>("neutral");
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [net, setNet] = useState(0);

  const busyRef = useRef(false);
  const mounted = useRef(true);
  const logId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "setup") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === "r" || event.key === "R") && !(event.target instanceof HTMLInputElement)) {
        setHorizontal((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const playing = phase === "playing";
  const setup = phase === "setup";
  const maxAllowed = Math.max(0, Math.min(MAX_BET, Math.floor(balance)));
  const allPlaced = playerShips.length === FLEET.length;

  const shipAt = useMemo(() => {
    const map = new Map<number, Ship>();
    playerShips.forEach((s) => s.cells.forEach((c) => map.set(c, s)));
    return map;
  }, [playerShips]);

  const enemyShipCells = useMemo(() => new Set(enemyFleet.flatMap((s) => s.cells)), [enemyFleet]);
  const enemySunk = useMemo(() => {
    const set = new Set<number>();
    enemyFleet.forEach((s) => isSunk(s, myShots) && s.cells.forEach((c) => set.add(c)));
    return set;
  }, [enemyFleet, myShots]);
  const mySunk = useMemo(() => {
    const set = new Set<number>();
    playerShips.forEach((s) => isSunk(s, enemyShots) && s.cells.forEach((c) => set.add(c)));
    return set;
  }, [playerShips, enemyShots]);

  const selectedDef = FLEET.find((f) => f.name === selected);
  const previewCells = setup && hover !== null && selectedDef ? footprint(hover, selectedDef.length, horizontal) : [];
  const previewValid = previewCells.length > 0 && previewCells.every((c) => !shipAt.has(c));
  const previewSet = new Set(previewCells);

  const myStats = useMemo(() => {
    const shots = myShots.filter((c) => c !== "water").length;
    const hits = myShots.filter((c) => c === "hit").length;
    return { shots, hits };
  }, [myShots]);
  const enemyStats = useMemo(() => {
    const shots = enemyShots.filter((c) => c !== "water").length;
    const hits = enemyShots.filter((c) => c === "hit").length;
    return { shots, hits };
  }, [enemyShots]);

  function say(text: string, nextTone: Tone) {
    setMessage(text);
    setTone(nextTone);
  }

  function addLog(side: "you" | "enemy", text: string, entryTone: Tone) {
    logId.current += 1;
    const entry = { id: logId.current, side, text, tone: entryTone };
    setLog((prev) => [entry, ...prev].slice(0, 6));
  }

  function updateBet(next: number) {
    const safe = Number.isFinite(next) ? Math.round(next) : 1;
    setBet(Math.min(Math.max(safe, 1), MAX_BET));
  }

  /* ----- Placement ----- */

  function nextUnplaced(ships: Ship[]) {
    return FLEET.find((f) => !ships.some((s) => s.name === f.name))?.name ?? null;
  }

  function pickUp(ship: Ship) {
    setPlayerShips((prev) => prev.filter((s) => s.name !== ship.name));
    setSelected(ship.name);
    setHorizontal(ship.horizontal);
    say(`Move the ${ship.name} — click a square to place it.`, "neutral");
  }

  function placeAt(cell: number) {
    if (!setup || busy) return;
    const occupant = shipAt.get(cell);
    if (occupant) {
      pickUp(occupant);
      return;
    }
    if (!selectedDef) {
      say("Select a ship to place, or click a placed ship to move it.", "neutral");
      return;
    }
    const cells = footprint(cell, selectedDef.length, horizontal);
    if (cells.some((c) => shipAt.has(c))) {
      say("Ships can't overlap. Try another square or rotate the ship.", "lose");
      return;
    }
    const placed = [...playerShips, { name: selectedDef.name, cells, horizontal }];
    setPlayerShips(placed);
    const next = nextUnplaced(placed);
    setSelected(next);
    say(next ? `${selectedDef.name} placed. Now the ${next}.` : "Fleet ready. Start the battle when you are.", "neutral");
  }

  function chooseShip(name: string) {
    const placed = playerShips.find((s) => s.name === name);
    if (placed) pickUp(placed);
    else setSelected(name);
  }

  function randomise() {
    setPlayerShips(buildFleet());
    setSelected(null);
    setRound((r) => r + 1);
    say("Fleet placed at random. Click a ship to move it, or start the battle.", "neutral");
  }

  function clearFleet() {
    setPlayerShips([]);
    setSelected(FLEET[0].name);
    say("Fleet cleared. Place the Battleship first.", "neutral");
  }

  async function settle(roundStake: number, won: boolean) {
    try {
      await bankingReturn(roundStake);
      if (won) await bankingPayout(roundStake);
      else await bankingLoss(roundStake);
      await syncBankingBalance(setBalance);
      if (!mounted.current) return;
      setNet((n) => n + (won ? roundStake : -roundStake));
      if (won) say(`Victory — ${fmt(roundStake)} profit plus your stake returned.`, "win");
      else say(`Your fleet went down. Your ${fmt(roundStake)} moose bucks stake was lost.`, "lose");
    } catch (error) {
      if (!mounted.current) return;
      say(error instanceof Error ? error.message : "Settlement failed.", "lose");
    }
  }

  async function startBattle() {
    if (busyRef.current || !allPlaced) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (bet < 1 || bet > MAX_BET || bet > balance) {
        say(`Choose a stake between 1 and ${MAX_BET} moose bucks within your available balance.`, "lose");
        return;
      }
      try {
        await bankingStake(bet, "battleships", bet * 2);
        await syncBankingBalance(setBalance);
      } catch (error) {
        say(error instanceof Error ? error.message : "Could not place the stake.", "lose");
        return;
      }
      if (!mounted.current) return;
      setEnemyFleet(buildFleet());
      setMyShots(emptyBoard());
      setEnemyShots(emptyBoard());
      setPendingEnemy(null);
      setPendingMine(null);
      setLastEnemy(null);
      setLastMine(null);
      setShakeEnemy(0);
      setShakeMine(0);
      setLog([]);
      setHover(null);
      setRound((r) => r + 1);
      setTurn("player");
      setStake(bet);
      setPhase("playing");
      say("Battle stations! Fire on the enemy waters.", "neutral");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function backToSetup() {
    if (busyRef.current) return;
    setPhase("setup");
    setMyShots(emptyBoard());
    setEnemyShots(emptyBoard());
    setEnemyFleet([]);
    setLog([]);
    setLastEnemy(null);
    setLastMine(null);
    setShakeEnemy(0);
    setShakeMine(0);
    setSelected(null);
    setRound((r) => r + 1);
    say("Your fleet is kept as it was. Rearrange it or start the next battle.", "neutral");
  }

  async function finish(won: boolean, roundStake: number) {
    setPhase(won ? "won" : "lost");
    setTurn("player");
    setStake(null);
    say(won ? "The enemy fleet is destroyed." : "Your fleet is destroyed.", won ? "win" : "lose");
    await settle(roundStake, won);
  }

  async function fire(cell: number) {
    if (phase !== "playing" || turn !== "player" || busyRef.current || myShots[cell] !== "water" || stake === null) return;
    const roundStake = stake;
    busyRef.current = true;
    setBusy(true);
    setPendingEnemy(cell);

    try {
      await sleep(FIRE_MS);
      if (!mounted.current) return;
      setPendingEnemy(null);

      const hit = enemyShipCells.has(cell);
      const nextMy = [...myShots];
      nextMy[cell] = hit ? "hit" : "miss";
      const sunkShip = hit ? enemyFleet.find((s) => s.cells.includes(cell) && isSunk(s, nextMy)) : undefined;
      setMyShots(nextMy);
      setLastEnemy(cell);
      if (hit) setShakeEnemy((n) => n + 1);

      const yourText = sunkShip
        ? `You fire at ${cellLabel(cell)} — you sank their ${sunkShip.name}!`
        : hit
          ? `You fire at ${cellLabel(cell)} — hit!`
          : `You fire at ${cellLabel(cell)} — miss.`;
      const yourTone: Tone = sunkShip ? "sunk" : hit ? "hit" : "neutral";
      addLog("you", yourText, yourTone);
      say(yourText, yourTone);

      if (allSunk(enemyFleet, nextMy)) {
        await finish(true, roundStake);
        return;
      }

      setTurn("enemy");
      await sleep(AI_THINK_MS);
      if (!mounted.current) return;
      say("Enemy is taking aim…", "neutral");
      const target = pickAiShot(enemyShots, playerShips);
      setPendingMine(target);
      await sleep(FIRE_MS);
      if (!mounted.current) return;
      setPendingMine(null);

      const aiHit = shipAt.has(target);
      const nextEnemy = [...enemyShots];
      nextEnemy[target] = aiHit ? "hit" : "miss";
      const lostShip = aiHit ? playerShips.find((s) => s.cells.includes(target) && isSunk(s, nextEnemy)) : undefined;
      setEnemyShots(nextEnemy);
      setLastMine(target);
      if (aiHit) setShakeMine((n) => n + 1);

      const enemyText = lostShip
        ? `Enemy fires at ${cellLabel(target)} — your ${lostShip.name} is sunk!`
        : aiHit
          ? `Enemy fires at ${cellLabel(target)} — they hit your ${shipAt.get(target)?.name}!`
          : `Enemy fires at ${cellLabel(target)} — miss.`;
      const enemyTone: Tone = lostShip ? "lose" : aiHit ? "hit" : "neutral";
      addLog("enemy", enemyText, enemyTone);

      if (allSunk(playerShips, nextEnemy)) {
        say(enemyText, "lose");
        await sleep(600);
        if (!mounted.current) return;
        await finish(false, roundStake);
        return;
      }

      setTurn("player");
      say(`${enemyText} Your turn.`, enemyTone);
    } finally {
      busyRef.current = false;
      if (mounted.current) {
        setBusy(false);
        setPendingEnemy(null);
        setPendingMine(null);
      }
    }
  }


  const shakeClass = (step: number) => (step === 0 ? "" : step % 2 ? "bs-shake-a" : "bs-shake-b");
  const canFire = playing && turn === "player" && !busy;

  function renderCell(side: "enemy" | "mine", index: number) {
    const key = `${round}-${side}-${index}`;
    let tint: string;
    let anim = "";
    let delay = 0;
    let content: React.ReactNode = null;
    let label: string;

    if (side === "enemy") {
      const state = myShots[index];
      const sunk = enemySunk.has(index);
      const revealed = phase === "lost" && state === "water" && enemyShipCells.has(index);
      const isPending = pendingEnemy === index;
      const isLast = lastEnemy === index && !isPending;
      label = `Fire at ${cellLabel(index)}`;

      if (state === "hit") {
        tint = sunk ? "border-amber-200 bg-amber-600 text-white" : "border-rose-300 bg-rose-500 text-white";
        if (phase === "won") {
          anim = "bs-victory";
          delay = index * 22;
        } else anim = sunk ? "bs-sunk" : "bs-flash";
        content = (
          <>
            <span aria-hidden className="bs-burst pointer-events-none absolute inset-0 rounded-full bg-orange-300" />
            <span className="relative">✕</span>
          </>
        );
      } else if (state === "miss") {
        tint = "border-sky-200/15 bg-sky-950 text-sky-100/45";
        content = (
          <>
            <span aria-hidden className="bs-ripple pointer-events-none absolute inset-1 rounded-full border-2 border-sky-200/70" />
            <span aria-hidden className="bs-ripple pointer-events-none absolute inset-1 rounded-full border-2 border-sky-200/50" style={{ animationDelay: "160ms" }} />
            <span className="relative">•</span>
          </>
        );
      } else if (revealed) {
        tint = "border-slate-300/40 bg-slate-400/40 text-slate-100/70";
        anim = "bs-reveal";
        delay = index * 18;
        content = <span className="relative">■</span>;
      } else {
        tint = !playing
          ? "border-sky-300/15 bg-sky-500/10"
          : isPending
            ? "border-white bg-sky-400/40"
            : "border-sky-300/25 bg-sky-500/20 enabled:cursor-crosshair enabled:hover:border-sky-200 enabled:hover:bg-sky-400/40";
        anim = "bs-deploy";
        delay = (index % SIZE) * 25 + Math.floor(index / SIZE) * 25;
        content = (
          <>
            {playing && !isPending && (
              <span
                aria-hidden
                className="bs-shimmer pointer-events-none absolute inset-0 bg-sky-200/20"
                style={{ animationDelay: `${((index % SIZE) + Math.floor(index / SIZE)) * 240}ms` }}
              />
            )}
            {isPending && <Crosshair />}
          </>
        );
      }

      return (
        <button
          key={key}
          aria-label={label}
          onClick={() => void fire(index)}
          disabled={!canFire || state !== "water"}
          style={delay ? { animationDelay: `${delay}ms` } : undefined}
          className={`${anim} relative flex aspect-square items-center justify-center overflow-hidden rounded-md border text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 sm:text-sm ${tint} ${
            isLast ? "ring-2 ring-white/70" : ""
          }`}
        >
          {content}
        </button>
      );
    }

    const state = enemyShots[index];
    const ship = shipAt.get(index);
    const isPending = pendingMine === index;
    const isLast = lastMine === index && !isPending;
    label = ship ? `${cellLabel(index)}, ${ship.name}` : cellLabel(index);

    if (state === "hit") {
      tint = mySunk.has(index) ? "border-amber-200 bg-amber-600 text-white" : "border-rose-300 bg-rose-500 text-white";
      anim = mySunk.has(index) ? "bs-sunk" : "bs-flash";
      content = (
        <>
          <span aria-hidden className="bs-burst pointer-events-none absolute inset-0 rounded-full bg-orange-300" />
          <span className="relative">✕</span>
        </>
      );
    } else if (state === "miss") {
      tint = "border-sky-200/15 bg-sky-950 text-sky-100/45";
      content = (
        <>
          <span aria-hidden className="bs-ripple pointer-events-none absolute inset-1 rounded-full border-2 border-sky-200/70" />
          <span aria-hidden className="bs-ripple pointer-events-none absolute inset-1 rounded-full border-2 border-sky-200/50" style={{ animationDelay: "160ms" }} />
          <span className="relative">•</span>
        </>
      );
    } else if (previewSet.has(index)) {
      tint = previewValid ? "border-emerald-300 bg-emerald-400/40" : "border-rose-300 bg-rose-500/40";
      if (ship) content = <span className="relative text-slate-900/60">{ship.name[0]}</span>;
    } else if (isPending) {
      tint = "border-rose-300 bg-rose-500/20";
      content = <Crosshair className="text-rose-300" />;
    } else if (ship) {
      tint = "border-slate-200/60 bg-gradient-to-br from-slate-200/80 to-slate-400/70 text-slate-900/60";
      anim = "bs-deploy";
      delay = (index % SIZE) * 25 + Math.floor(index / SIZE) * 25;
      if (ship.cells[0] === index) content = <span className="relative">{ship.name[0]}</span>;
    } else {
      tint = "border-sky-300/20 bg-sky-500/10";
      anim = "bs-deploy";
      delay = (index % SIZE) * 25 + Math.floor(index / SIZE) * 25;
    }

    const className = `${anim} relative flex aspect-square items-center justify-center overflow-hidden rounded-md border text-xs font-bold transition-colors sm:text-sm ${tint} ${
      isLast ? "ring-2 ring-white/70" : ""
    }`;
    const style = delay ? { animationDelay: `${delay}ms` } : undefined;

    if (setup) {
      return (
        <button
          key={key}
          aria-label={ship ? `Move ${ship.name} (${cellLabel(index)})` : `Place ship at ${cellLabel(index)}`}
          onClick={() => placeAt(index)}
          onMouseEnter={() => setHover(index)}
          onFocus={() => setHover(index)}
          style={style}
          className={`${className} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200`}
        >
          {content}
        </button>
      );
    }
    return (
      <div key={key} role="img" aria-label={label} style={style} className={className}>
        {content}
      </div>
    );
  }

  function renderBoard(side: "enemy" | "mine") {
    const stats = side === "enemy" ? myStats : enemyStats;
    const isEnemy = side === "enemy";
    return (
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-bold">{isEnemy ? "Enemy waters" : "Your fleet"}</h2>
          <span className="text-xs text-sky-100/55">
            {stats.shots > 0 ? `${stats.shots} ${stats.shots === 1 ? "shot" : "shots"} · ${stats.hits} hit${stats.hits === 1 ? "" : "s"}` : "No shots yet"}
          </span>
        </div>
        <div className="relative">
          <div
            onMouseLeave={!isEnemy && setup ? () => setHover(null) : undefined}
            className={`grid grid-cols-[1rem_repeat(8,minmax(0,1fr))] gap-1 ${shakeClass(isEnemy ? shakeEnemy : shakeMine)}`}
          >
            <span />
            {COLUMNS.split("").map((letter) => (
              <span key={letter} className="pb-0.5 text-center text-[10px] font-bold text-sky-100/50">{letter}</span>
            ))}
            {Array.from({ length: SIZE }, (_, row) => (
              <div key={row} className="contents">
                <span className="flex items-center justify-center text-[10px] font-bold text-sky-100/50">{row + 1}</span>
                {Array.from({ length: SIZE }, (_, col) => renderCell(side, row * SIZE + col))}
              </div>
            ))}
          </div>
          {isEnemy && setup && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-[#071426]/55 px-6 text-center text-sm font-semibold text-sky-100/80">
              The enemy hides its fleet until you start the battle.
            </div>
          )}
        </div>
      </div>
    );
  }

  const turnChip = setup
    ? { text: "Placing fleet", style: "bg-white/10 text-sky-100" }
    : phase === "won"
      ? { text: "Victory", style: "bg-emerald-400 text-slate-950" }
      : phase === "lost"
        ? { text: "Defeat", style: "bg-rose-500 text-white" }
        : turn === "player"
          ? { text: "Your turn", style: "bg-sky-400 text-[#071426]" }
          : { text: "Enemy turn", style: "bg-rose-500 text-white animate-pulse" };

  const enemyRows = FLEET.map((def) => {
    const ship = enemyFleet.find((s) => s.name === def.name);
    return { ...def, sunk: !!ship && isSunk(ship, myShots) };
  });
  const myRows = FLEET.map((def) => {
    const ship = playerShips.find((s) => s.name === def.name);
    const hitCount = ship ? ship.cells.filter((c) => enemyShots[c] === "hit").length : 0;
    return { ...def, hitCount, sunk: !!ship && hitCount === ship.cells.length };
  });

  const startLabel = busy ? "Working…" : allPlaced ? "Start battle" : `Place ${FLEET.length - playerShips.length} more ${FLEET.length - playerShips.length === 1 ? "ship" : "ships"}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <style>{`
        @keyframes bs-deploy { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes bs-lock {
          0%   { opacity: 0; transform: scale(2.6) rotate(-120deg); }
          55%  { opacity: 1; transform: scale(0.9) rotate(0deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes bs-burst { 0% { opacity: 0.95; transform: scale(0.2); } 100% { opacity: 0; transform: scale(2.8); } }
        @keyframes bs-flash { 0% { filter: brightness(2.4); transform: scale(1.3); } 100% { filter: brightness(1); transform: scale(1); } }
        @keyframes bs-ripple { 0% { opacity: 0.9; transform: scale(0.2); } 100% { opacity: 0; transform: scale(1.9); } }
        @keyframes bs-sunk {
          0%   { box-shadow: 0 0 0 0 rgba(251,191,36,0.95); transform: scale(1.25); }
          60%  { box-shadow: 0 0 18px 6px rgba(251,191,36,0.7); transform: scale(1); }
          100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); transform: scale(1); }
        }
        @keyframes bs-victory {
          0%   { transform: translateY(0) scale(1); box-shadow: 0 0 0 0 rgba(52,211,153,0); }
          40%  { transform: translateY(-7px) scale(1.14); box-shadow: 0 0 18px 4px rgba(52,211,153,0.75); }
          100% { transform: translateY(0) scale(1); box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
        @keyframes bs-reveal { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes bs-shimmer { 0%, 100% { opacity: 0; } 50% { opacity: 0.45; } }
        @keyframes bs-shake-a { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-4px, 2px); } 40% { transform: translate(4px, -2px); } 60% { transform: translate(-3px, -1px); } 80% { transform: translate(2px, 2px); } }
        @keyframes bs-shake-b { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-4px, 2px); } 40% { transform: translate(4px, -2px); } 60% { transform: translate(-3px, -1px); } 80% { transform: translate(2px, 2px); } }
        @keyframes bs-pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
        .bs-deploy { animation: bs-deploy 380ms ease-out both; }
        .bs-lock { animation: bs-lock ${FIRE_MS}ms ease-out both; }
        .bs-burst { animation: bs-burst 650ms ease-out both; }
        .bs-flash { animation: bs-flash 420ms ease-out both; }
        .bs-ripple { animation: bs-ripple 900ms ease-out both; }
        .bs-sunk { animation: bs-sunk 1000ms ease-out both; }
        .bs-victory { animation: bs-victory 900ms ease-in-out both; }
        .bs-reveal { animation: bs-reveal 450ms ease-out both; }
        .bs-shimmer { animation: bs-shimmer 4.5s ease-in-out infinite; }
        .bs-shake-a { animation: bs-shake-a 360ms ease-out; }
        .bs-shake-b { animation: bs-shake-b 360ms ease-out; }
        .bs-pop { animation: bs-pop 300ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .bs-deploy, .bs-lock, .bs-burst, .bs-flash, .bs-ripple, .bs-sunk, .bs-victory, .bs-reveal,
          .bs-shimmer, .bs-shake-a, .bs-shake-b, .bs-pop { animation: none; }
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

      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-6 lg:px-10">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino game</p>
          <h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Battleships</h1>
          <p className="mt-2 text-sm text-sky-100/65">Hide your fleet, then out-hunt the enemy — the first to sink every ship wins.</p>
        </div>

        <div className="mb-8 flex max-w-md rounded-xl border border-white/10 bg-slate-950/40 p-1" role="tablist" aria-label="Battleships game mode">
          <button role="tab" aria-selected={gameTab === "multiplayer"} onClick={() => setGameTab("multiplayer")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${gameTab === "multiplayer" ? "bg-emerald-300 text-[#092f2b]" : "text-sky-100/65 hover:bg-white/10"}`}>Multiplayer</button>
          <button role="tab" aria-selected={gameTab === "local"} onClick={() => setGameTab("local")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${gameTab === "local" ? "bg-sky-400 text-[#071426]" : "text-sky-100/65 hover:bg-white/10"}`}>Local vs AI</button>
        </div>

        {gameTab === "multiplayer" && <MultiplayerBattleships />}

        {gameTab === "local" && <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
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
              Your stake is held when you start the battle and settled when one fleet is sunk. You fire first, then the enemy fires back.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
            <div className="rounded-2xl border border-sky-300/10 bg-[#071426]/70 p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${turnChip.style}`}>{turnChip.text}</span>
                {setup && (
                  <span className="text-xs text-sky-100/55">
                    {selectedDef ? `Placing: ${selectedDef.name} (${selectedDef.length}) · ${horizontal ? "horizontal" : "vertical"}` : allPlaced ? "All ships placed" : "Select a ship"}
                  </span>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {renderBoard("enemy")}
                {renderBoard("mine")}
              </div>

              <p
                role="status"
                aria-live="polite"
                className={`mt-6 min-h-12 rounded-lg border px-4 py-3 text-center text-sm font-semibold transition-colors ${TONE_STYLES[tone]}`}
              >
                {message}
              </p>

              {log.length > 0 && (
                <ul className="mt-4 space-y-1.5" aria-label="Battle log">
                  {log.map((entry, i) => (
                    <li key={entry.id} className={`flex items-center gap-2 text-xs ${i === 0 ? "text-sky-100" : "text-sky-100/50"}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${entry.side === "you" ? "bg-sky-400" : "bg-rose-400"}`} />
                      {entry.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <label htmlFor="battleships-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Stake</label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="battleships-bet"
                    type="number"
                    min={1}
                    max={MAX_BET}
                    step={1}
                    value={bet}
                    onChange={(event) => updateBet(Number(event.target.value))}
                    disabled={!setup || busy}
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
                      disabled={!setup || busy || chip > balance}
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
                  <button type="button" onClick={() => updateBet(bet / 2)} disabled={!setup || busy} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">Half</button>
                  <button type="button" onClick={() => updateBet(Math.min(bet * 2, maxAllowed || 1))} disabled={!setup || busy} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">Double</button>
                  <button type="button" onClick={() => updateBet(maxAllowed || 1)} disabled={!setup || busy || maxAllowed < 1} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">Max</button>
                </div>

                {stake !== null && <p className="mt-3 text-xs text-amber-200/80">{fmt(stake)} moose bucks is riding on this battle.</p>}
                {setup && balance < 1 && <p className="mt-3 text-xs text-rose-300">You need at least 1 moose buck to play.</p>}
              </div>

              {setup ? (
                <button
                  onClick={() => void startBattle()}
                  disabled={!allPlaced || busy || balance < 1}
                  className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] transition hover:bg-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {startLabel}
                </button>
              ) : playing ? (
                <button disabled className="w-full cursor-not-allowed rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] opacity-40">
                  Battle in progress…
                </button>
              ) : (
                <button
                  onClick={backToSetup}
                  disabled={busy}
                  className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] transition hover:bg-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "Settling…" : "Set up rematch"}
                </button>
              )}

              {setup ? (
                <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Place your fleet</p>
                  <ul className="mt-3 space-y-2">
                    {FLEET.map((def) => {
                      const placed = playerShips.some((s) => s.name === def.name);
                      const active = selected === def.name;
                      return (
                        <li key={def.name}>
                          <button
                            type="button"
                            onClick={() => chooseShip(def.name)}
                            aria-pressed={active}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              active ? "border-sky-300 bg-sky-400/20 text-white" : "border-white/10 bg-white/[0.04] text-sky-100/80 hover:bg-white/10"
                            }`}
                          >
                            <span>{def.name}</span>
                            <span className="flex items-center gap-2 text-xs">
                              <span className="flex gap-0.5">
                                {Array.from({ length: def.length }, (_, i) => (
                                  <span key={i} className={`h-2 w-2 rounded-sm ${placed ? "bg-emerald-400" : "bg-white/30"}`} />
                                ))}
                              </span>
                              {placed ? "Placed" : ""}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
                    <button type="button" onClick={() => setHorizontal((h) => !h)} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10">Rotate (R)</button>
                    <button type="button" onClick={randomise} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10">Random</button>
                    <button type="button" onClick={clearFleet} className="rounded-lg border border-white/15 bg-white/[0.05] py-2 text-sky-100 hover:bg-white/10">Clear</button>
                  </div>
                  <p className="mt-3 border-t border-white/10 pt-2 text-xs text-sky-100/55">
                    Pick a ship, then click your board to place it. Click a placed ship to pick it up again.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Enemy fleet</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {enemyRows.map((ship) => (
                      <li key={ship.name} className={`flex justify-between ${ship.sunk ? "text-amber-200" : "text-sky-100/75"}`}>
                        <span className={ship.sunk ? "line-through decoration-amber-300/70" : ""}>{ship.name}</span>
                        <span className="text-xs">{ship.sunk ? "Sunk" : "Afloat"}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-sky-100/65">Your fleet</p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {myRows.map((ship) => (
                      <li key={ship.name} className={ship.sunk ? "text-rose-300" : "text-sky-100/75"}>
                        <div className="flex justify-between">
                          <span className={ship.sunk ? "line-through decoration-rose-300/70" : ""}>{ship.name}</span>
                          <span className="text-xs">{ship.sunk ? "Sunk" : `${ship.length - ship.hitCount}/${ship.length} intact`}</span>
                        </div>
                        <div className="mt-1 flex gap-1">
                          {Array.from({ length: ship.length }, (_, i) => (
                            <span
                              key={`${ship.name}-${i}-${i < ship.hitCount}`}
                              className={`h-2 flex-1 rounded-sm ${i < ship.hitCount ? "bs-pop bg-rose-500" : "bg-emerald-400/70"}`}
                            />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-white/10 pt-2 text-xs text-sky-100/55">
                    Win payout: even money — a winning {fmt(stake ?? bet)} stake returns your stake plus {fmt(stake ?? bet)} profit.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>}
      </section>
    </main>
  );
}