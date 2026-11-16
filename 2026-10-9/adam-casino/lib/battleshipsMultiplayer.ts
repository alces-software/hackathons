import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const BATTLESHIP_SIZE = 8;
export const BATTLESHIP_FLEET = [
  { name: "Battleship", length: 4 },
  { name: "Cruiser", length: 3 },
  { name: "Destroyer", length: 3 },
  { name: "Patrol boat", length: 2 },
] as const;
export type BattleshipCell = "water" | "hit" | "miss";
export type BattleshipShip = { name: string; cells: number[]; horizontal: boolean };
export type BattleshipAction =
  | { type: "place"; ships: BattleshipShip[] }
  | { type: "fire"; cell: number }
  | { type: "ready"; stake: number }
  | { type: "settle" };
export type BattleshipMember = { id: string; name: string };
export type BattleshipRoom = {
  code: string;
  hostId: string;
  players: BattleshipMember[];
  spectators: BattleshipMember[];
  ships: Record<string, BattleshipShip[]>;
  shots: Record<string, BattleshipCell[]>;
  readyPlayers: string[];
  settledPlayers: string[];
  stake: number | null;
  turn: string;
  winner: string | null;
  winnerId: string | null;
  round: number;
  message: string;
  updatedAt: number;
};

const rooms = new Map<string, BattleshipRoom>();
const roomsFile = process.env.BATTLESHIPS_ROOMS_FILE ?? join(process.cwd(), ".data/battleships-rooms.json");
const secret = process.env.UNO_SESSION_SECRET ?? "local-development-only-change-me";
let loaded = false;

function nameRequired(value: string) {
  const name = value.trim();
  if (!name) throw new Error("Enter a name before joining a Battleships room.");
  return name.slice(0, 24);
}

function token(code: string, id: string) {
  const signature = createHmac("sha256", secret).update(`${code}:${id}`).digest("base64url");
  return `${id}.${signature}`;
}

export function verifyBattleshipToken(code: string, value: string) {
  const [id, signature] = value.split(".");
  if (!id || !signature) return null;
  const expected = token(code.trim().toUpperCase(), id).split(".")[1];
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

function load() {
  if (loaded) return;
  loaded = true;
  if (!existsSync(/* turbopackIgnore: true */ roomsFile)) return;
  try {
    (JSON.parse(readFileSync(/* turbopackIgnore: true */ roomsFile, "utf8")) as BattleshipRoom[]).forEach((room) => {
      room.spectators ??= [];
      room.readyPlayers ??= [];
      room.settledPlayers ??= [];
      room.stake ??= null;
      room.round ??= 0;
      room.winnerId ??= room.winner ? room.players.find((player) => player.name === room.winner)?.id ?? null : null;
      rooms.set(room.code, room);
    });
  } catch {
    /* ignore corrupt runtime state */
  }
}

function save() {
  mkdirSync(dirname(roomsFile), { recursive: true });
  writeFileSync(roomsFile, JSON.stringify([...rooms.values()]), "utf8");
}

function touch(room: BattleshipRoom) {
  room.updatedAt = Date.now();
  save();
}

function emptyBoard(): BattleshipCell[] {
  return Array.from({ length: BATTLESHIP_SIZE * BATTLESHIP_SIZE }, () => "water");
}

function validShips(ships: BattleshipShip[]) {
  if (!Array.isArray(ships) || ships.length !== BATTLESHIP_FLEET.length) return false;
  const occupied = new Set<number>();
  return BATTLESHIP_FLEET.every((definition) => {
    const ship = ships.find((item) => item.name === definition.name);
    if (!ship || !Array.isArray(ship.cells) || ship.cells.length !== definition.length) return false;
    if (ship.cells.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= 64 || occupied.has(cell))) return false;
    ship.cells.forEach((cell) => occupied.add(cell));
    const rows = ship.cells.map((cell) => Math.floor(cell / 8));
    const cols = ship.cells.map((cell) => cell % 8);
    return ship.horizontal
      ? new Set(rows).size === 1 && Math.max(...cols) - Math.min(...cols) + 1 === definition.length
      : new Set(cols).size === 1 && Math.max(...rows) - Math.min(...rows) + 1 === definition.length;
  });
}

function sunk(ships: BattleshipShip[], shots: BattleshipCell[]) {
  return ships.length > 0 && ships.every((ship) => ship.cells.every((cell) => shots[cell] === "hit"));
}

/** Clears the board and stakes so the same two players can play again. */
function resetRound(room: BattleshipRoom) {
  room.players.forEach((player) => {
    room.ships[player.id] = [];
    room.shots[player.id] = emptyBoard();
  });
  room.readyPlayers = [];
  room.settledPlayers = [];
  room.stake = null;
  room.winner = null;
  room.winnerId = null;
  room.turn = room.players[0].id;
  room.round += 1;
  room.message = "Rematch! Place your fleets, then both players must ready up.";
}

export function createBattleshipRoom(rawName: string) {
  load();
  const id = randomUUID();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const name = nameRequired(rawName);
  const room: BattleshipRoom = {
    code,
    hostId: id,
    players: [{ id, name }],
    spectators: [],
    ships: { [id]: [] },
    shots: { [id]: emptyBoard() },
    readyPlayers: [],
    settledPlayers: [],
    stake: null,
    turn: id,
    winner: null,
    winnerId: null,
    round: 0,
    message: "Waiting for another player to join.",
    updatedAt: Date.now(),
  };
  rooms.set(code, room);
  save();
  return { room, playerId: id, playerToken: token(code, id) };
}

export function getBattleshipRoom(code: string) {
  load();
  return rooms.get(code.trim().toUpperCase());
}

export function joinBattleshipRoom(code: string, rawName: string) {
  load();
  const room = getBattleshipRoom(code);
  if (!room) throw new Error("Room not found.");
  if (room.players.length >= 2) throw new Error("That room is full.");
  const id = randomUUID();
  room.players.push({ id, name: nameRequired(rawName) });
  room.ships[id] = [];
  room.shots[id] = emptyBoard();
  room.message = "Place your fleets, then both players must ready up.";
  touch(room);
  return { room, playerId: id, playerToken: token(room.code, id) };
}

export function spectateBattleshipRoom(code: string, rawName: string) {
  const room = getBattleshipRoom(code);
  if (!room) throw new Error("Room not found.");
  const id = randomUUID();
  room.spectators.push({ id, name: nameRequired(rawName) });
  touch(room);
  return { room, playerId: id, playerToken: token(room.code, id) };
}

export function applyBattleshipAction(room: BattleshipRoom, id: string, action: BattleshipAction) {
  if (!room.players.some((player) => player.id === id)) throw new Error("Spectators cannot perform game actions.");
  const player = room.players.find((item) => item.id === id)!;
  const other = room.players.find((item) => item.id !== id);

  if (action.type === "place") {
    // Only the player who has already readied up is locked out. The opponent must still be able to place.
    if (room.winner) throw new Error("The round is over.");
    if (room.readyPlayers.includes(id)) throw new Error("Your fleet is locked in.");
    if (!validShips(action.ships)) throw new Error("Fleet placement is invalid.");
    room.ships[id] = action.ships;
    room.message = `${player.name} placed a fleet.`;
    touch(room);
    return;
  }

  if (action.type === "ready") {
    if (room.winner || room.readyPlayers.length === 2) throw new Error("The battle has already started.");
    if (room.readyPlayers.includes(id)) throw new Error("You have already readied up.");
    if (room.players.length < 2 || room.ships[id]?.length !== BATTLESHIP_FLEET.length) throw new Error("Place all four ships first.");
    const stake = Math.round(Number(action.stake) * 100) / 100;
    if (!Number.isFinite(stake) || stake < 1 || stake > 250) throw new Error("Stake must be between 1 and 250 moose bucks.");
    if (room.stake !== null && room.stake !== stake) throw new Error(`Both players must use the ${room.stake.toFixed(2)} moose buck stake.`);
    room.stake = stake;
    room.readyPlayers.push(id);
    if (room.readyPlayers.length === 2) {
      room.turn = room.players[0].id;
      room.message = `Both fleets are ready. ${room.players[0].name} fires first.`;
    } else {
      room.message = `${player.name} is ready with a ${stake.toFixed(2)} moose buck stake. Waiting for the other fleet.`;
    }
    touch(room);
    return;
  }

  if (action.type === "settle") {
    if (!room.winner || room.stake === null) throw new Error("The round is not finished.");
    if (!room.settledPlayers.includes(id)) room.settledPlayers.push(id);
    // Once both players have settled their bank, reset for a rematch.
    if (room.settledPlayers.length === room.players.length) resetRound(room);
    touch(room);
    return;
  }

  if (room.readyPlayers.length !== 2 || room.winner || !other) throw new Error("The battle has not started.");
  if (room.turn !== id) throw new Error("It is not your turn.");
  if (!Number.isInteger(action.cell) || action.cell < 0 || action.cell >= 64 || room.shots[id][action.cell] !== "water") throw new Error("Choose an unplayed cell.");

  const shooterShots = room.shots[id];
  const targetShips = room.ships[other.id];
  const hit = targetShips.some((ship) => ship.cells.includes(action.cell));
  shooterShots[action.cell] = hit ? "hit" : "miss";
  room.message = `${player.name} fired at ${String.fromCharCode(65 + (action.cell % 8))}${Math.floor(action.cell / 8) + 1}: ${hit ? "hit" : "miss"}.`;
  if (sunk(targetShips, shooterShots)) {
    room.winner = player.name;
    room.winnerId = id;
    room.message = `${player.name} destroyed the enemy fleet!`;
  } else {
    room.turn = other.id;
  }
  touch(room);
}

export function viewBattleshipRoom(room: BattleshipRoom, id: string) {
  const player = room.players.some((item) => item.id === id);
  const spectator = room.spectators.some((item) => item.id === id);
  if (!player && !spectator) throw new Error("You are not in this room.");
  const opponent = room.players.find((item) => item.id !== id) ?? null;
  const ownShips = player ? room.ships[id] : [];
  const ownShots = player ? room.shots[id] : emptyBoard();
  return {
    code: room.code,
    role: spectator ? "spectator" : "player",
    playerName: [...room.players, ...room.spectators].find((item) => item.id === id)?.name ?? "Player",
    hostId: room.hostId,
    players: room.players,
    spectators: room.spectators,
    opponent: player ? opponent : null,
    ownShips,
    ownShots,
    opponentShotCount: player && opponent ? room.shots[opponent.id].filter((cell) => cell !== "water").length : 0,
    opponentHitCount: player && opponent ? room.shots[opponent.id].filter((cell) => cell === "hit").length : 0,
    opponentFleetPlaced: player && opponent ? room.ships[opponent.id].length === BATTLESHIP_FLEET.length : false,
    readyCount: room.readyPlayers.length,
    isReady: room.readyPlayers.includes(id),
    isYourTurn: player && room.turn === id,
    winner: room.winner,
    youWon: player && room.winnerId === id,
    hasSettled: room.settledPlayers.includes(id),
    round: room.round,
    stake: room.stake,
    settledCount: room.settledPlayers.length,
    message: room.message,
    updatedAt: room.updatedAt,
  };
}