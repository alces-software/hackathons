"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import type { BattleshipAction, BattleshipShip } from "../../lib/battleshipsMultiplayer";

type View = {
  code: string;
  role: "player" | "spectator";
  playerName: string;
  players: { id: string; name: string }[];
  spectators: { id: string; name: string }[];
  opponent: { id: string; name: string } | null;
  ownShips: BattleshipShip[];
  ownShots: Array<"water" | "hit" | "miss">;
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

const SIZE = 8;
const emptyBoard = () => Array.from({ length: SIZE * SIZE }, () => "water" as const);
const BATTLESHIP_FLEET = [
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Destroyer", length: 3 },
  { name: "Patrol boat", length: 2 },
] as const;

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
  const settledRef = useRef<string | null>(null);

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

  // Press R to rotate the ship being placed.
  const canPlace = !!view && view.role === "player" && !view.isReady;
  useEffect(() => {
    if (!canPlace) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "r" || event.key === "R") setHorizontal((h) => !h);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlace]);

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
    setMessage("");
    settledRef.current = null;
    sessionStorage.removeItem("bs-code");
    sessionStorage.removeItem("bs-token");
  }

  if (!view)
    return (
      <section className="rounded-3xl border border-emerald-300/20 bg-[#092f2b]/90 p-5 shadow-2xl sm:p-8">
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

  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-[#092f2b]/90 p-5 shadow-2xl sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-emerald-200/65">Room {view.code} · {view.players.length}/2 players · {view.spectators.length} watching</p>
          <h2 className="mt-1 text-2xl font-bold">
            {isSpectator ? "Spectator view" : view.winner ? `${view.winner} wins` : view.isReady && view.readyCount < 2 ? "Waiting for opponent" : view.isYourTurn ? "Your turn" : view.readyCount === 2 ? "Opponent's turn" : "Place your fleet"}
          </h2>
        </div>
        <button onClick={leave} className="rounded-lg border border-red-300/40 px-3 py-2 text-sm text-red-200">Leave room</button>
      </div>
      <p className="mt-3 text-sm text-emerald-100/70">{view.message}</p>
      {message && <p className="mt-2 text-sm text-rose-200">{message}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-bold">{isSpectator ? "Public battle" : "Opponent waters"}</h3>
          <div className="grid grid-cols-8 gap-1">
            {emptyBoard().map((_, cell) => {
              const shot = view.ownShots[cell];
              const clickable = !isSpectator && view.isYourTurn && !view.winner && shot === "water" && view.opponentFleetPlaced && view.readyCount === 2;
              return (
                <button
                  key={cell}
                  onClick={() => clickable && void send({ type: "fire", cell })}
                  disabled={!clickable}
                  className={`aspect-square rounded border text-xs ${shot === "hit" ? "border-rose-300 bg-rose-500" : shot === "miss" ? "border-sky-200/20 bg-slate-900" : "border-emerald-200/20 bg-emerald-400/10"}`}
                >
                  {shot === "hit" ? "X" : shot === "miss" ? "•" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-bold">Your fleet</h3>
          <div className="grid grid-cols-8 gap-1" onMouseLeave={() => setHover(null)}>
            {emptyBoard().map((_, cell) => {
              // Once readied, the server's copy of the fleet is the source of truth.
              const serverShip = view.ownShips.find((s) => s.cells.includes(cell));
              const ship = placing ? ownCells.get(cell) : serverShip ?? ownCells.get(cell);
              const previewing = placing && previewSet.has(cell);
              const tint = previewing
                ? previewValid ? "border-emerald-300 bg-emerald-400/40" : "border-rose-300 bg-rose-500/40"
                : ship ? "border-slate-200/60 bg-slate-300/70 text-slate-900" : "border-emerald-200/20 bg-emerald-400/10";
              const className = `flex aspect-square items-center justify-center rounded border text-xs ${tint}`;
              if (!placing) return <div key={cell} className={className}>{ship ? ship.name[0] : ""}</div>;
              return (
                <button
                  key={cell}
                  type="button"
                  aria-label={ship ? `Move ${ship.name}` : `Place ship at cell ${cell}`}
                  onClick={() => placeAt(cell)}
                  onMouseEnter={() => setHover(cell)}
                  onFocus={() => setHover(cell)}
                  className={`${className} cursor-pointer`}
                >
                  {ship ? ship.name[0] : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {placing && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
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

      {!isSpectator && <p className="mt-3 text-xs text-emerald-100/65">Your balance: {balance.toFixed(2)} moose bucks</p>}
    </section>
  );
}