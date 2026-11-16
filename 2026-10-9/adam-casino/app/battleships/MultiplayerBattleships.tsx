"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import type { BattleshipAction, BattleshipShip } from "../../lib/battleshipsMultiplayer";

type Shot = "water" | "hit" | "miss";
type EnemyShip = { name: string; length: number; sunk: boolean; cells: number[] };
type LastShot = { byYou: boolean; byName: string; cell: number; hit: boolean; sunkShip: string | null; n: number };
type View = {
  code: string;
  role: "player" | "spectator";
  playerName: string;
  players: { id: string; name: string }[];
  spectators: { id: string; name: string }[];
  opponent: { id: string; name: string } | null;
  ownShips: BattleshipShip[];
  ownShots: Shot[];
  opponentShots: Shot[];
  enemyFleet: EnemyShip[];
  revealedEnemyCells: number[];
  turnName: string | null;
  lastShot: LastShot | null;
  watch: { name: string; targetName: string; shots: Shot[] }[];
  opponentShotCount: number;
  opponentHitCount: number;
  opponentFleetPlaced: boolean;
  readyCount: number;
  isReady: boolean;
  isYourTurn: boolean;
  winner: string | null;
  youWon: boolean;
  hasSettled: boolean;
  round: number;
  stake: number | null;
  settledCount: number;
  message: string;
};
type LogEntry = { id: number; text: string; side: "you" | "enemy" | "watch"; kind: "hit" | "miss" | "sunk" };

const SIZE = 8;
const COLUMNS = "ABCDEFGH";
const BATTLESHIP_FLEET = [
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Destroyer", length: 3 },
  { name: "Patrol boat", length: 2 },
] as const;

const cellLabel = (cell: number) => `${COLUMNS[cell % SIZE]}${Math.floor(cell / SIZE) + 1}`;
const rowOf = (cell: number) => Math.floor(cell / SIZE);
const colOf = (cell: number) => cell % SIZE;
const shots = (board: Shot[]) => ({ fired: board.filter((c) => c !== "water").length, hits: board.filter((c) => c === "hit").length });

/** Cells a ship would cover when pointing at `cell`, nudged back inside the board. */
const footprint = (cell: number, length: number, horizontal: boolean) => {
  let row = Math.floor(cell / SIZE);
  let col = cell % SIZE;
  if (horizontal) col = Math.min(col, SIZE - length);
  else row = Math.min(row, SIZE - length);
  return Array.from({ length }, (_, i) => (row + (horizontal ? 0 : i)) * SIZE + col + (horizontal ? i : 0));
};

const nextUnplaced = (placed: BattleshipShip[]) =>
  BATTLESHIP_FLEET.find((f) => !placed.some((s) => s.name === f.name))?.name ?? "";

function randomFleet(): BattleshipShip[] {
  const occupied = new Set<number>();
  const ships: BattleshipShip[] = [];
  for (const def of BATTLESHIP_FLEET) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * (horizontal ? SIZE : SIZE - def.length + 1));
      const col = Math.floor(Math.random() * (horizontal ? SIZE - def.length + 1 : SIZE));
      const cells = Array.from({ length: def.length }, (_, i) => (row + (horizontal ? 0 : i)) * SIZE + col + (horizontal ? i : 0));
      if (cells.every((c) => !occupied.has(c))) {
        cells.forEach((c) => occupied.add(c));
        ships.push({ name: def.name, cells, horizontal });
        placed = true;
      }
    }
  }
  return ships;
}

/* ---------- Small presentational pieces ---------- */

function Crosshair({ className = "text-white", spin = false }: { className?: string; spin?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`${spin ? "mp-lock" : "mp-aim"} h-3/4 w-3/4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
    </svg>
  );
}

const HitMark = () => (
  <>
    <span aria-hidden className="mp-burst pointer-events-none absolute inset-0 rounded-full bg-orange-300" />
    <span className="relative">✕</span>
  </>
);

const MissMark = () => (
  <>
    <span aria-hidden className="mp-ripple pointer-events-none absolute inset-1 rounded-full border-2 border-sky-200/70" />
    <span aria-hidden className="mp-ripple pointer-events-none absolute inset-1 rounded-full border-2 border-sky-200/50" style={{ animationDelay: "160ms" }} />
    <span className="relative">•</span>
  </>
);

function Grid({ renderCell, shake = "", onLeave, aimRow = null, aimCol = null }: { renderCell: (cell: number) => ReactNode; shake?: string; onLeave?: () => void; aimRow?: number | null; aimCol?: number | null }) {
  return (
    <div onMouseLeave={onLeave} className={`grid grid-cols-[1rem_repeat(8,minmax(0,1fr))] gap-1 ${shake}`}>
      <span />
      {COLUMNS.split("").map((letter, col) => (
        <span key={letter} className={`pb-0.5 text-center text-[10px] font-bold transition-colors ${aimCol === col ? "text-white" : "text-sky-100/50"}`}>{letter}</span>
      ))}
      {Array.from({ length: SIZE }, (_, row) => (
        <div key={row} className="contents">
          <span className={`flex items-center justify-center text-[10px] font-bold transition-colors ${aimRow === row ? "text-white" : "text-sky-100/50"}`}>{row + 1}</span>
          {Array.from({ length: SIZE }, (_, col) => renderCell(row * SIZE + col))}
        </div>
      ))}
    </div>
  );
}

type FleetRow = { name: string; length: number; hits: number; sunk: boolean };

function FleetList({ title, rows, accent }: { title: string; rows: FleetRow[]; accent: "sky" | "rose" }) {
  const afloat = rows.filter((row) => !row.sunk).length;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-100/65">{title}</p>
        <span className="text-xs text-emerald-100/55">{afloat}/{rows.length} afloat</span>
      </div>
      <ul className="mt-2 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.name} className={row.sunk ? (accent === "sky" ? "text-amber-200" : "text-rose-300") : "text-emerald-100/80"}>
            <div className="flex justify-between">
              <span className={row.sunk ? "line-through" : ""}>{row.name}</span>
              <span className="text-xs">{row.sunk ? "Sunk" : row.hits > 0 ? `${row.length - row.hits}/${row.length} intact` : "Afloat"}</span>
            </div>
            <div className="mt-1 flex gap-1">
              {Array.from({ length: row.length }, (_, i) => (
                <span
                  key={`${row.name}-${i}-${row.sunk}-${i < row.hits}`}
                  className={`h-2 flex-1 rounded-sm ${row.sunk ? "mp-pop bg-amber-500" : i < row.hits ? "mp-pop bg-rose-500" : "bg-emerald-400/60"}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LEGEND = [
  { swatch: "bg-slate-300/70 border-slate-200/60", label: "Your ship" },
  { swatch: "bg-rose-500 border-rose-300", label: "Hit" },
  { swatch: "bg-amber-600 border-amber-200", label: "Sunk" },
  { swatch: "bg-sky-950 border-sky-200/20", label: "Miss" },
];

/* ---------- Main component ---------- */

export default function MultiplayerBattleships() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [message, setMessage] = useState("");
  const [ships, setShips] = useState<BattleshipShip[]>([]);
  const [selected, setSelected] = useState<string>(BATTLESHIP_FLEET[0].name);
  const [horizontal, setHorizontal] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [stake, setStake] = useState(25);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useBankingBalance();

  // Battle targeting
  const [aim, setAim] = useState<number | null>(null); // square under the pointer
  const [target, setTarget] = useState<number | null>(null); // square you've selected to fire at
  const [firing, setFiring] = useState<number | null>(null); // shot sent, waiting for the server
  const [log, setLog] = useState<LogEntry[]>([]);
  const [shakeEnemy, setShakeEnemy] = useState(0);
  const [shakeMine, setShakeMine] = useState(0);

  const settledRef = useRef<string | null>(null);
  const seenRef = useRef("");
  const logId = useRef(0);

  useEffect(() => {
    if (!code || !token) return;
    const source = new EventSource(`/api/battleships/room?events=1&code=${encodeURIComponent(code)}&playerToken=${encodeURIComponent(token)}`);
    source.onmessage = (event) => setView(JSON.parse(event.data) as View);
    return () => source.close();
  }, [code, token]);

  // Once the opponent has set a stake, match it automatically.
  useEffect(() => {
    if (view?.stake != null && !view.isReady) setStake(view.stake);
  }, [view?.stake, view?.isReady]);

  const isPlayer = view?.role === "player";
  const battleOn = !!view && view.readyCount === 2 && !view.winner;
  const myTurn = isPlayer && battleOn && !!view?.isYourTurn;
  const canPlace = !!view && view.role === "player" && !view.isReady;

  // Press R to rotate the ship being placed.
  useEffect(() => {
    if (!canPlace) return;
    const onKey = (event: KeyboardEvent) => {
      const el = event.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (event.key === "r" || event.key === "R") setHorizontal((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlace]);

  // Drop the selected target as soon as it stops being your turn.
  useEffect(() => {
    if (!myTurn) {
      setTarget(null);
      setAim(null);
    }
  }, [myTurn]);

  // Clear the "shot sent" lock-on once the server has recorded the shot.
  useEffect(() => {
    if (firing !== null && view && view.ownShots[firing] !== "water") setFiring(null);
  }, [view, firing]);

  // Build the battle log and trigger screen shakes whenever a new shot lands.
  useEffect(() => {
    if (!view) {
      seenRef.current = "";
      setLog([]);
      return;
    }
    const shot = view.lastShot;
    const roundKey = `${view.code}:${view.round}`;
    const key = `${roundKey}:${shot ? shot.n : "none"}`;
    if (seenRef.current === key) return;
    const previousRound = seenRef.current.split(":").slice(0, 2).join(":");
    seenRef.current = key;
    if (previousRound !== roundKey) setLog([]);
    if (!shot) return;
    const label = cellLabel(shot.cell);
    const kind: LogEntry["kind"] = shot.sunkShip ? "sunk" : shot.hit ? "hit" : "miss";
    let text: string;
    let side: LogEntry["side"];
    if (view.role === "spectator") {
      side = "watch";
      text = `${shot.byName} fired at ${label} — ${shot.sunkShip ? `sank the ${shot.sunkShip}!` : shot.hit ? "hit!" : "miss."}`;
    } else if (shot.byYou) {
      side = "you";
      text = `You fired at ${label} — ${shot.sunkShip ? `you sank their ${shot.sunkShip}!` : shot.hit ? "direct hit!" : "miss."}`;
    } else {
      side = "enemy";
      text = `${shot.byName} fired at ${label} — ${shot.sunkShip ? `your ${shot.sunkShip} is sunk!` : shot.hit ? "your ship was hit!" : "miss."}`;
    }
    logId.current += 1;
    const entry: LogEntry = { id: logId.current, text, side, kind };
    setLog((prev) => [entry, ...prev].slice(0, 6));
    if (shot.hit) {
      if (shot.byYou) setShakeEnemy((n) => n + 1);
      else if (view.role === "player") setShakeMine((n) => n + 1);
    }
  }, [view]);

  // Settle the bank exactly once per finished round on this client.
  // The server decides who won (youWon) and whether this player has already settled,
  // so identical names or a page refresh can't cause a wrong or double settlement.
  useEffect(() => {
    if (!view?.winner || view.role !== "player" || view.hasSettled || view.stake === null) return;
    const key = `${view.code}:${view.round}`;
    if (settledRef.current === key) return;
    settledRef.current = key;
    const won = view.youWon;
    const roundStake = view.stake;
    bankingReturn(roundStake)
      .then(() => (won ? bankingPayout(roundStake) : bankingLoss(roundStake)))
      .then(() => syncBankingBalance(setBalance))
      .then(() => send({ type: "settle" }))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Settlement failed."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, setBalance]);

  const ownCells = useMemo(() => new Map(ships.flatMap((ship) => ship.cells.map((cell) => [cell, ship] as const))), [ships]);
  const ownSunkCells = useMemo(() => {
    const set = new Set<number>();
    if (!view) return set;
    view.ownShips.forEach((ship) => {
      if (ship.cells.every((c) => view.opponentShots[c] === "hit")) ship.cells.forEach((c) => set.add(c));
    });
    return set;
  }, [view]);
  const enemySunkCells = useMemo(() => new Set(view?.enemyFleet.flatMap((ship) => ship.cells) ?? []), [view]);
  const revealedCells = useMemo(() => new Set(view?.revealedEnemyCells ?? []), [view]);

  const selectedDef = BATTLESHIP_FLEET.find((f) => f.name === selected);
  const previewCells = hover !== null && selectedDef ? footprint(hover, selectedDef.length, horizontal) : [];
  const previewValid = previewCells.length > 0 && previewCells.every((c) => !ownCells.has(c));
  const previewSet = new Set(previewCells);

  async function request(body: { action: "create" | "join" | "spectate" | "move"; code?: string; playerToken?: string; name?: string; move?: BattleshipAction }) {
    const response = await fetch("/api/battleships/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = (await response.json()) as { error?: string; playerId?: string; playerToken?: string; room?: View };
    if (!response.ok) throw new Error(result.error || "Request failed.");
    if (result.playerToken) setToken(result.playerToken);
    if (result.room) {
      setCode(result.room.code);
      setView(result.room);
      if (result.playerToken) {
        sessionStorage.setItem("bs-token", result.playerToken);
        sessionStorage.setItem("bs-code", result.room.code);
      }
    }
  }

  async function send(move: BattleshipAction) {
    if (!view) return;
    try {
      await request({ action: "move", code: view.code, playerToken: token, move });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That action failed.");
    }
  }

  async function create() {
    try { await request({ action: "create", name }); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create room."); }
  }
  async function join() {
    try { await request({ action: "join", code, playerToken: token, name }); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not join room."); }
  }
  async function spectate() {
    try { await request({ action: "spectate", code, name }); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not spectate room."); }
  }

  /* ----- Firing ----- */

  async function fire(cell: number) {
    if (!view || !myTurn || firing !== null || view.ownShots[cell] !== "water") return;
    setFiring(cell);
    setTarget(null);
    setMessage("");
    try {
      await request({ action: "move", code: view.code, playerToken: token, move: { type: "fire", cell } });
    } catch (error) {
      setFiring(null);
      setMessage(error instanceof Error ? error.message : "That shot failed.");
    }
  }

  // First click selects a square, clicking it again (or pressing Fire) launches the shot.
  function clickEnemyCell(cell: number) {
    if (!myTurn || firing !== null) return;
    if (target === cell) void fire(cell);
    else setTarget(cell);
  }

  /* ----- Placement ----- */

  function pickUp(ship: BattleshipShip) {
    setShips((prev) => prev.filter((s) => s.name !== ship.name));
    setSelected(ship.name);
    setHorizontal(ship.horizontal);
    setMessage(`Move the ${ship.name} - click a square to place it.`);
  }

  function chooseShip(shipName: string) {
    const placed = ships.find((s) => s.name === shipName);
    if (placed) pickUp(placed);
    else setSelected(shipName);
  }

  function placeAt(cell: number) {
    if (!view || view.isReady || view.role === "spectator") return;
    const occupant = ownCells.get(cell);
    if (occupant) {
      pickUp(occupant);
      return;
    }
    if (!selectedDef) {
      setMessage("Select a ship to place, or click a placed ship to move it.");
      return;
    }
    const cells = footprint(cell, selectedDef.length, horizontal);
    if (cells.some((c) => ownCells.has(c))) {
      setMessage("Ships can't overlap. Try another square or rotate the ship.");
      return;
    }
    const placed = [...ships, { name: selectedDef.name, cells, horizontal }];
    setShips(placed);
    const next = nextUnplaced(placed);
    setSelected(next);
    setMessage(next ? `${selectedDef.name} placed. Now the ${next}.` : "Fleet ready. Set your stake and ready up.");
  }

  function randomise() {
    setShips(randomFleet());
    setSelected("");
    setMessage("Fleet placed at random. Click a ship to move it, or ready up.");
  }

  function clearFleet() {
    setShips([]);
    setSelected(BATTLESHIP_FLEET[0].name);
    setMessage("Fleet cleared. Place the Battleship first.");
  }

  async function ready() {
    if (!view || busy || ships.length !== BATTLESHIP_FLEET.length) return;
    // The server rounds stakes to cents, so do the same here to keep both sides identical.
    const roundStake = Math.round(stake * 100) / 100;
    if (!Number.isFinite(roundStake) || roundStake < 1 || roundStake > 250) {
      setMessage("Stake must be between 1 and 250 moose bucks.");
      return;
    }
    if (view.stake !== null && view.stake !== roundStake) {
      setMessage(`Match the room stake of ${view.stake.toFixed(2)}.`);
      return;
    }
    if (roundStake > balance) {
      setMessage("You don't have enough moose bucks for that stake.");
      return;
    }
    setBusy(true);
    let staked = false;
    try {
      await request({ action: "move", code: view.code, playerToken: token, move: { type: "place", ships } });
      await bankingStake(roundStake, "battleships", roundStake * 2);
      staked = true;
      await syncBankingBalance(setBalance);
      await request({ action: "move", code: view.code, playerToken: token, move: { type: "ready", stake: roundStake } });
      staked = false; // the server accepted the stake, so it stays in play
      setMessage("");
    } catch (error) {
      // If the stake was taken but the server rejected the ready-up, give it back.
      if (staked) {
        try {
          await bankingReturn(roundStake);
          await syncBankingBalance(setBalance);
        } catch {
          /* the original error below is more useful to show */
        }
      }
      setMessage(error instanceof Error ? error.message : "Could not place stake.");
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    setView(null);
    setCode("");
    setToken("");
    setShips([]);
    setSelected(BATTLESHIP_FLEET[0].name);
    setHorizontal(true);
    setHover(null);
    setAim(null);
    setTarget(null);
    setFiring(null);
    setLog([]);
    setMessage("");
    settledRef.current = null;
    seenRef.current = "";
    sessionStorage.removeItem("bs-code");
    sessionStorage.removeItem("bs-token");
  }

  const styles = (
    <style>{`
      @keyframes mp-deploy { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes mp-lock { 0% { opacity: 0; transform: scale(2.6) rotate(-120deg); } 55% { opacity: 1; transform: scale(0.9) rotate(0); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
      @keyframes mp-aim { 0% { opacity: 0; transform: scale(1.5); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes mp-target { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.65); } 50% { box-shadow: 0 0 0 6px rgba(255,255,255,0); } }
      @keyframes mp-burst { 0% { opacity: 0.95; transform: scale(0.2); } 100% { opacity: 0; transform: scale(2.8); } }
      @keyframes mp-flash { 0% { filter: brightness(2.4); transform: scale(1.3); } 100% { filter: brightness(1); transform: scale(1); } }
      @keyframes mp-ripple { 0% { opacity: 0.9; transform: scale(0.2); } 100% { opacity: 0; transform: scale(1.9); } }
      @keyframes mp-sunk { 0% { box-shadow: 0 0 0 0 rgba(251,191,36,0.95); transform: scale(1.25); } 60% { box-shadow: 0 0 18px 6px rgba(251,191,36,0.7); transform: scale(1); } 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); transform: scale(1); } }
      @keyframes mp-incoming { 0% { opacity: 0; transform: translateY(-26px) scale(1.5); } 60% { opacity: 1; transform: translateY(2px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes mp-victory { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-7px) scale(1.14); box-shadow: 0 0 18px 4px rgba(52,211,153,0.75); } 100% { transform: translateY(0) scale(1); } }
      @keyframes mp-reveal { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes mp-shimmer { 0%, 100% { opacity: 0; } 50% { opacity: 0.4; } }
      @keyframes mp-shake-a { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-4px, 2px); } 40% { transform: translate(4px, -2px); } 60% { transform: translate(-3px, -1px); } 80% { transform: translate(2px, 2px); } }
      @keyframes mp-shake-b { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-4px, 2px); } 40% { transform: translate(4px, -2px); } 60% { transform: translate(-3px, -1px); } 80% { transform: translate(2px, 2px); } }
      @keyframes mp-pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
      @keyframes mp-slide { 0% { opacity: 0; transform: translateY(-10px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes mp-glow { 0%, 100% { box-shadow: 0 0 0 1px rgba(56,189,248,0.4), 0 0 14px 0 rgba(56,189,248,0.25); } 50% { box-shadow: 0 0 0 1px rgba(56,189,248,0.9), 0 0 26px 4px rgba(56,189,248,0.45); } }
      @keyframes mp-glow-rose { 0%, 100% { box-shadow: 0 0 0 1px rgba(244,63,94,0.35), 0 0 12px 0 rgba(244,63,94,0.2); } 50% { box-shadow: 0 0 0 1px rgba(244,63,94,0.8), 0 0 22px 3px rgba(244,63,94,0.4); } }
      @keyframes mp-log { 0% { opacity: 0; transform: translateX(-10px); } 100% { opacity: 1; transform: translateX(0); } }
      .mp-deploy { animation: mp-deploy 380ms ease-out both; }
      .mp-lock { animation: mp-lock 450ms ease-out both; }
      .mp-aim { animation: mp-aim 160ms ease-out both; }
      .mp-target { animation: mp-target 1.1s ease-out infinite; }
      .mp-burst { animation: mp-burst 650ms ease-out both; }
      .mp-flash { animation: mp-flash 420ms ease-out both; }
      .mp-ripple { animation: mp-ripple 900ms ease-out both; }
      .mp-sunk { animation: mp-sunk 1000ms ease-out both; }
      .mp-incoming { animation: mp-incoming 520ms ease-out both; }
      .mp-victory { animation: mp-victory 900ms ease-in-out both; }
      .mp-reveal { animation: mp-reveal 450ms ease-out both; }
      .mp-shimmer { animation: mp-shimmer 4.5s ease-in-out infinite; }
      .mp-shake-a { animation: mp-shake-a 360ms ease-out; }
      .mp-shake-b { animation: mp-shake-b 360ms ease-out; }
      .mp-pop { animation: mp-pop 300ms ease-out both; }
      .mp-slide { animation: mp-slide 320ms ease-out both; }
      .mp-glow { animation: mp-glow 1.8s ease-in-out infinite; }
      .mp-glow-rose { animation: mp-glow-rose 1.8s ease-in-out infinite; }
      .mp-log { animation: mp-log 280ms ease-out both; }
      @media (prefers-reduced-motion: reduce) {
        .mp-deploy, .mp-lock, .mp-aim, .mp-target, .mp-burst, .mp-flash, .mp-ripple, .mp-sunk, .mp-incoming, .mp-victory,
        .mp-reveal, .mp-shimmer, .mp-shake-a, .mp-shake-b, .mp-pop, .mp-slide, .mp-glow, .mp-glow-rose, .mp-log { animation: none; }
      }
    `}</style>
  );

  if (!view)
    return (
      <section className="rounded-3xl border border-emerald-300/20 bg-[#092f2b]/90 p-5 shadow-2xl sm:p-8">
        {styles}
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Self-hosted multiplayer</p>
        <h2 className="mt-2 font-serif text-2xl font-bold">Battle a friend</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="rounded-lg bg-slate-950/60 px-3 py-2 text-sm" />
          <button onClick={() => void create()} disabled={!name.trim()} className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-[#092f2b] disabled:opacity-40">Create room</button>
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} className="rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-sm uppercase" />
          <button onClick={() => void join()} disabled={!name.trim() || !code} className="rounded-lg border border-emerald-300/50 px-4 py-2 text-sm disabled:opacity-40">Join</button>
          <button onClick={() => void spectate()} disabled={!name.trim() || !code} className="rounded-lg border border-emerald-300/50 px-4 py-2 text-sm disabled:opacity-40">Spectate</button>
        </div>
        {message && <p className="mt-3 text-sm text-rose-200">{message}</p>}
      </section>
    );

  const isSpectator = view.role === "spectator";
  const placing = !isSpectator && !view.isReady;
  const waitingForOpponent = !isSpectator && view.isReady && view.readyCount < 2;
  const theirTurn = isPlayer && battleOn && !view.isYourTurn;
  const focus = target ?? aim;
  const aimRow = myTurn && focus !== null ? rowOf(focus) : null;
  const aimCol = myTurn && focus !== null ? colOf(focus) : null;
  const opponentName = view.opponent?.name ?? "Opponent";
  const myStats = shots(view.ownShots);
  const theirStats = shots(view.opponentShots);
  const stakeText = view.stake !== null ? view.stake.toFixed(2) : "";

  /* ----- Turn banner ----- */
  type Status = { key: string; icon: string; title: string; sub: string; style: string };
  let status: Status;
  if (view.winner) {
    status = isSpectator
      ? { key: "over", icon: "🏆", title: `${view.winner} wins!`, sub: "The enemy fleet has been destroyed.", style: "border-amber-300/50 bg-amber-300/15 text-amber-100" }
      : view.youWon
        ? { key: "won", icon: "🏆", title: "Victory!", sub: `${opponentName}'s fleet is destroyed. You win ${stakeText} moose bucks profit plus your stake back.`, style: "border-emerald-300/60 bg-emerald-400/15 text-emerald-100" }
        : { key: "lost", icon: "💥", title: "Defeat", sub: `Your fleet is destroyed. Your ${stakeText} moose buck stake is lost.`, style: "border-rose-300/60 bg-rose-500/15 text-rose-100" };
  } else if (placing) {
    status = { key: "placing", icon: "⚓", title: "Place your fleet", sub: view.players.length < 2 ? "Waiting for an opponent to join the room." : "Position all four ships, set your stake and ready up.", style: "border-white/20 bg-white/10 text-emerald-50" };
  } else if (waitingForOpponent) {
    status = { key: "waiting", icon: "⏳", title: "Fleet locked in", sub: `Waiting for ${opponentName} to place their fleet and match the ${stakeText} stake.`, style: "border-amber-300/40 bg-amber-300/10 text-amber-100" };
  } else if (isSpectator) {
    status = view.readyCount === 2
      ? { key: `spec-${view.turnName}`, icon: "👁", title: `${view.turnName ?? "A player"} is aiming`, sub: "You're watching this battle live.", style: "border-sky-300/30 bg-sky-300/10 text-sky-100" }
      : { key: "spec-wait", icon: "👁", title: "Waiting for the battle", sub: "Both players are still setting up.", style: "border-white/20 bg-white/10 text-emerald-50" };
  } else if (myTurn) {
    status = { key: "my-turn", icon: "🎯", title: "Your turn — fire!", sub: target !== null ? `Target ${cellLabel(target)} selected. Click it again or press Fire.` : "Select a square on the enemy waters.", style: "mp-glow border-sky-300 bg-sky-400/20 text-sky-50" };
  } else {
    status = { key: "their-turn", icon: "🛡", title: `${opponentName} is aiming…`, sub: "Brace for incoming fire.", style: "mp-glow-rose border-rose-300/70 bg-rose-500/15 text-rose-50" };
  }

  /* ----- Cell renderers ----- */

  function renderEnemyCell(cell: number) {
    const v = view!;
    const shot = v.ownShots[cell];
    const sunk = enemySunkCells.has(cell);
    const revealed = shot === "water" && revealedCells.has(cell);
    const isLast = !!v.lastShot?.byYou && v.lastShot.cell === cell;
    const isFiring = firing === cell;
    const isTarget = myTurn && target === cell && !isFiring;
    const isAim = myTurn && aim === cell && !isTarget && !isFiring && shot === "water";
    const inLine = myTurn && aimRow !== null && shot === "water" && (rowOf(cell) === aimRow || colOf(cell) === aimCol);
    const wonRound = !!v.winner && v.youWon;
    let tint: string;
    let anim = "mp-deploy";
    let content: ReactNode = null;
    let delay = (colOf(cell) + rowOf(cell)) * 22;

    if (shot === "hit") {
      tint = sunk ? "border-amber-200 bg-amber-600 text-white" : "border-rose-300 bg-rose-500 text-white";
      anim = wonRound ? "mp-victory" : sunk ? "mp-sunk" : "mp-flash";
      delay = wonRound ? cell * 22 : 0;
      content = <HitMark />;
    } else if (shot === "miss") {
      tint = "border-sky-200/15 bg-sky-950 text-sky-100/45";
      anim = "";
      delay = 0;
      content = <MissMark />;
    } else if (revealed) {
      tint = "border-slate-300/40 bg-slate-400/40 text-slate-100/70";
      anim = "mp-reveal";
      delay = cell * 18;
      content = <span className="relative">■</span>;
    } else if (isFiring) {
      tint = "border-white bg-sky-400/50";
      anim = "";
      delay = 0;
      content = <Crosshair spin />;
    } else if (isTarget) {
      tint = "mp-target border-white bg-sky-300/50";
      anim = "";
      delay = 0;
      content = <Crosshair />;
    } else if (isAim) {
      tint = "border-sky-100 bg-sky-400/40";
      anim = "";
      delay = 0;
      content = <Crosshair className="text-sky-100/80" />;
    } else {
      tint = inLine ? "border-sky-300/35 bg-sky-400/25" : battleOn ? "border-sky-300/25 bg-sky-500/20" : "border-sky-300/15 bg-sky-500/10";
      if (inLine) {
        anim = "";
        delay = 0;
      }
      content = battleOn && !inLine ? (
        <span aria-hidden className="mp-shimmer pointer-events-none absolute inset-0 bg-sky-200/20" style={{ animationDelay: `${(colOf(cell) + rowOf(cell)) * 240}ms` }} />
      ) : null;
    }

    const clickable = myTurn && firing === null && shot === "water";
    return (
      <button
        key={`${v.round}-e-${cell}`}
        type="button"
        aria-label={`${shot === "water" ? "Target" : shot === "hit" ? "Hit at" : "Miss at"} ${cellLabel(cell)}`}
        aria-pressed={isTarget}
        onClick={() => clickEnemyCell(cell)}
        onMouseEnter={() => myTurn && setAim(cell)}
        onFocus={() => myTurn && setAim(cell)}
        disabled={!clickable}
        style={delay ? { animationDelay: `${delay}ms` } : undefined}
        className={`${anim} relative flex aspect-square items-center justify-center overflow-hidden rounded-md border text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 sm:text-sm ${tint} ${clickable ? "cursor-crosshair" : ""} ${isLast ? "ring-2 ring-white/80" : ""}`}
      >
        {content}
      </button>
    );
  }

  function renderOwnCell(cell: number) {
    const v = view!;
    // Before the battle the local layout is shown. Once readied, the server's fleet is authoritative.
    const ship = placing ? ownCells.get(cell) : v.ownShips.find((s) => s.cells.includes(cell)) ?? ownCells.get(cell);
    const shot = v.opponentShots[cell];
    const sunk = ownSunkCells.has(cell);
    const isLast = !!v.lastShot && !v.lastShot.byYou && v.lastShot.cell === cell;
    let tint: string;
    let anim = "";
    let content: ReactNode = null;

    if (!placing && shot === "hit") {
      tint = sunk ? "border-amber-200 bg-amber-600 text-white" : "border-rose-300 bg-rose-500 text-white";
      anim = isLast ? "mp-incoming" : sunk ? "mp-sunk" : "";
      content = <HitMark />;
    } else if (!placing && shot === "miss") {
      tint = "border-sky-200/15 bg-sky-950 text-sky-100/45";
      anim = isLast ? "mp-incoming" : "";
      content = <MissMark />;
    } else if (placing && previewSet.has(cell)) {
      tint = previewValid ? "border-emerald-300 bg-emerald-400/40" : "border-rose-300 bg-rose-500/40";
      if (ship) content = <span className="relative text-slate-900/60">{ship.name[0]}</span>;
    } else if (ship) {
      tint = "border-slate-200/60 bg-gradient-to-br from-slate-200/80 to-slate-400/70 text-slate-900/70";
      anim = "mp-deploy";
      content = <span className="relative">{ship.cells[0] === cell ? ship.name[0] : ""}</span>;
    } else {
      tint = "border-emerald-200/20 bg-emerald-400/10";
    }
    const className = `${anim} relative flex aspect-square items-center justify-center overflow-hidden rounded-md border text-xs font-bold transition-colors sm:text-sm ${tint} ${isLast ? "ring-2 ring-white/80" : ""}`;
    const key = `${v.round}-o-${cell}`;
    if (!placing) {
      return (
        <div key={key} role="img" aria-label={`${cellLabel(cell)}${ship ? `, ${ship.name}` : ""}${shot === "hit" ? ", hit" : shot === "miss" ? ", missed" : ""}`} className={className}>
          {content}
        </div>
      );
    }
    return (
      <button
        key={key}
        type="button"
        aria-label={ship ? `Move ${ship.name} (${cellLabel(cell)})` : `Place ship at ${cellLabel(cell)}`}
        onClick={() => placeAt(cell)}
        onMouseEnter={() => setHover(cell)}
        onFocus={() => setHover(cell)}
        className={`${className} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200`}
      >
        {content}
      </button>
    );
  }

  function watchRenderer(board: View["watch"][number], index: number) {
    const v = view!;
    const lastHere = !!v.lastShot && v.lastShot.byName === board.name;
    return (cell: number) => {
      const shot = board.shots[cell];
      const isLast = lastHere && v.lastShot!.cell === cell;
      const tint = shot === "hit" ? "border-rose-300 bg-rose-500 text-white" : shot === "miss" ? "border-sky-200/15 bg-sky-950 text-sky-100/45" : "border-emerald-200/20 bg-emerald-400/10";
      return (
        <div key={`${v.round}-w${index}-${cell}`} role="img" aria-label={`${cellLabel(cell)} ${shot}`} className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-md border text-xs font-bold ${tint} ${shot === "hit" && isLast ? "mp-flash" : ""} ${isLast ? "ring-2 ring-white/80" : ""}`}>
          {shot === "hit" ? <HitMark /> : shot === "miss" ? <MissMark /> : null}
        </div>
      );
    };
  }

  /* ----- Fleet status rows ----- */
  const ownRows: FleetRow[] = BATTLESHIP_FLEET.map((def) => {
    const ship = (placing ? ships : view.ownShips).find((s) => s.name === def.name);
    const hits = ship && !placing ? ship.cells.filter((c) => view.opponentShots[c] === "hit").length : 0;
    return { name: def.name, length: def.length, hits, sunk: !!ship && !placing && hits === ship.cells.length };
  });
  const enemyRows: FleetRow[] = BATTLESHIP_FLEET.map((def) => {
    const info = view.enemyFleet.find((s) => s.name === def.name);
    return { name: def.name, length: def.length, hits: 0, sunk: !!info?.sunk };
  });

  const boardFrame = (active: boolean, tone: "sky" | "rose") =>
    `rounded-2xl border p-3 transition-all duration-300 sm:p-4 ${active ? (tone === "sky" ? "border-sky-300/70 bg-sky-400/[0.07]" : "border-rose-300/60 bg-rose-500/[0.07]") : "border-white/10 bg-slate-950/30"} ${battleOn && !active ? "opacity-80" : ""}`;

  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-[#092f2b]/90 p-5 shadow-2xl sm:p-8">
      {styles}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-emerald-200/65">
          Room <span className="font-mono tracking-widest text-emerald-100">{view.code}</span> · {view.players.length}/2 players · {view.spectators.length} watching
          {view.stake !== null && <> · Stake {stakeText}</>}
        </p>
        <button onClick={leave} className="rounded-lg border border-red-300/40 px-3 py-2 text-sm text-red-200 hover:bg-red-300/10">Leave room</button>
      </div>

      {/* Turn banner: remounts (and re-animates) whenever the status changes */}
      <div key={status.key} role="status" aria-live="polite" className={`mp-slide mt-4 flex items-center gap-4 rounded-2xl border px-5 py-4 ${status.style}`}>
        <span className="text-3xl" aria-hidden>{status.icon}</span>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight sm:text-2xl">{status.title}</p>
          <p className="mt-0.5 text-sm opacity-80">{status.sub}</p>
        </div>
        {myTurn && target !== null && (
          <button onClick={() => void fire(target)} disabled={firing !== null} className="ml-auto shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-black text-[#071426] shadow-lg transition hover:bg-sky-100 active:scale-95 disabled:opacity-50">
            Fire at {cellLabel(target)}
          </button>
        )}
      </div>

      <p className="mt-3 text-sm text-emerald-100/70">{view.message}</p>
      {message && <p className="mt-2 text-sm text-rose-200">{message}</p>}

      {/* Boards */}
      {isSpectator ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {view.watch.map((board, index) => {
            const s = shots(board.shots);
            const active = battleOn && view.turnName === board.name;
            return (
              <div key={board.name + index} className={boardFrame(active, "sky")}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold">{board.name} <span className="text-xs font-normal text-emerald-100/55">firing at {board.targetName}</span></h3>
                  <span className="text-xs text-emerald-100/55">{s.fired > 0 ? `${s.fired} shots · ${s.hits} hits` : "No shots yet"}</span>
                </div>
                <Grid renderCell={watchRenderer(board, index)} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Enemy waters */}
          <div className={boardFrame(myTurn, "sky")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-bold">
                Enemy waters
                {myTurn && <span className="mp-pop rounded-full bg-sky-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#071426]">Your turn</span>}
              </h3>
              <span className="text-xs text-emerald-100/55">{myStats.fired > 0 ? `${myStats.fired} shots · ${myStats.hits} hits · ${myStats.fired - myStats.hits} misses` : "No shots yet"}</span>
            </div>
            <div className="relative">
              <Grid renderCell={renderEnemyCell} shake={shakeEnemy === 0 ? "" : shakeEnemy % 2 ? "mp-shake-a" : "mp-shake-b"} onLeave={() => setAim(null)} aimRow={aimRow} aimCol={aimCol} />
              {!battleOn && !view.winner && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-[#071426]/55 px-6 text-center text-sm font-semibold text-sky-100/80">
                  {placing ? "The enemy hides its fleet until the battle starts." : "Waiting for both fleets to be ready…"}
                </div>
              )}
            </div>
            <p className="mt-2 min-h-5 text-xs text-sky-100/70">
              {myTurn
                ? firing !== null ? `Shot away at ${cellLabel(firing)}…` : target !== null ? `Target locked: ${cellLabel(target)}` : aim !== null ? `Aiming at ${cellLabel(aim)}` : "Move over the grid to aim."
                : ""}
            </p>
            {battleOn || view.winner ? <div className="mt-2"><FleetList title="Enemy fleet" rows={enemyRows} accent="sky" /></div> : null}
          </div>

          {/* Own fleet */}
          <div className={boardFrame(theirTurn, "rose")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-bold">
                Your fleet
                {theirTurn && <span className="mp-pop rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">Incoming</span>}
              </h3>
              <span className="text-xs text-emerald-100/55">{theirStats.fired > 0 ? `${theirStats.fired} shots taken · ${theirStats.hits} hits` : "Untouched"}</span>
            </div>
            <Grid renderCell={renderOwnCell} shake={shakeMine === 0 ? "" : shakeMine % 2 ? "mp-shake-a" : "mp-shake-b"} onLeave={() => setHover(null)} />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-emerald-100/60">
              {LEGEND.map((item) => (
                <span key={item.label} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm border ${item.swatch}`} />{item.label}</span>
              ))}
            </div>
            {!placing && <div className="mt-2"><FleetList title="Your fleet" rows={ownRows} accent="rose" /></div>}
          </div>
        </div>
      )}

      {/* Battle log */}
      {log.length > 0 && (
        <ul className="mt-5 space-y-1.5" aria-label="Battle log">
          {log.map((entry, i) => (
            <li key={entry.id} className={`mp-log flex items-center gap-2 text-xs ${i === 0 ? "text-emerald-50" : "text-emerald-100/50"}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${entry.side === "you" ? "bg-sky-400" : entry.side === "enemy" ? "bg-rose-400" : "bg-slate-300"}`} />
              <span className={entry.kind === "sunk" ? "font-bold text-amber-200" : entry.kind === "hit" ? "text-orange-200" : ""}>{entry.text}</span>
            </li>
          ))}
        </ul>
      )}

      {placing && (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {BATTLESHIP_FLEET.map((ship) => {
              const placed = ships.some((s) => s.name === ship.name);
              return (
                <button
                  key={ship.name}
                  onClick={() => chooseShip(ship.name)}
                  aria-pressed={selected === ship.name}
                  className={`rounded border px-3 py-2 text-xs ${selected === ship.name ? "border-emerald-300 bg-emerald-300/20" : "border-white/20"}`}
                >
                  {ship.name} ({ship.length}){placed ? " ✓" : ""}
                </button>
              );
            })}
            <p className="w-full text-xs text-emerald-100/65">
              {selectedDef
                ? `Click your fleet board to place the ${selectedDef.name} (${horizontal ? "horizontal" : "vertical"}). Click a placed ship to move it.`
                : ships.length === BATTLESHIP_FLEET.length ? "All ships placed." : "Select a ship to place."}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs uppercase text-emerald-100/65">Stake</label>
              <input
                type="number"
                min="1"
                max="250"
                value={stake}
                onChange={(event) => setStake(Number(event.target.value) || 0)}
                disabled={view.stake !== null}
                className="mt-1 block w-28 rounded bg-slate-950/60 px-3 py-2 disabled:opacity-60"
              />
              {view.stake !== null && <span className="ml-2 text-xs">Room: {view.stake.toFixed(2)}</span>}
            </div>
            <button onClick={() => setHorizontal((value) => !value)} className="rounded border border-white/20 px-3 py-2 text-sm">Rotate (R)</button>
            <button onClick={randomise} className="rounded border border-white/20 px-3 py-2 text-sm">Random</button>
            <button onClick={clearFleet} className="rounded border border-white/20 px-3 py-2 text-sm">Clear</button>
            <button
              onClick={() => void ready()}
              disabled={busy || ships.length !== BATTLESHIP_FLEET.length || view.players.length < 2}
              className="rounded bg-emerald-300 px-4 py-2 text-sm font-bold text-[#092f2b] disabled:opacity-40"
            >
              {busy ? "Placing stake…" : "Place fleet & ready"}
            </button>
          </div>
          {view.players.length < 2 && <p className="mt-2 text-xs text-emerald-100/65">Waiting for an opponent to join before you can ready up.</p>}
        </>
      )}

      {!isSpectator && <p className="mt-4 text-xs text-emerald-100/65">Your balance: {balance.toFixed(2)} moose bucks</p>}
    </section>
  );
}