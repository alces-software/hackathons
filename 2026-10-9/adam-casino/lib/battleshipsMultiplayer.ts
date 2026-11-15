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
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
function load() {
  if (loaded) return; loaded = true;
  if (!existsSync(/* turbopackIgnore: true */ roomsFile)) return;
  try { (JSON.parse(readFileSync(/* turbopackIgnore: true */ roomsFile, "utf8")) as BattleshipRoom[]).forEach((room) => rooms.set(room.code, room)); } catch { /* ignore corrupt runtime state */ }
}
function save() { mkdirSync(dirname(roomsFile), { recursive: true }); writeFileSync(roomsFile, JSON.stringify([...rooms.values()]), "utf8"); }
function touch(room: BattleshipRoom) { room.updatedAt = Date.now(); save(); }
function emptyBoard(): BattleshipCell[] { return Array.from({ length: BATTLESHIP_SIZE * BATTLESHIP_SIZE }, () => "water"); }
function validShips(ships: BattleshipShip[]) {
  if (ships.length !== BATTLESHIP_FLEET.length) return false;
  const occupied = new Set<number>();
  return BATTLESHIP_FLEET.every((definition) => {
    const ship = ships.find((item) => item.name === definition.name);
    if (!ship || ship.cells.length !== definition.length || ship.cells.some((cell) => cell < 0 || cell >= 64 || occupied.has(cell))) return false;
    ship.cells.forEach((cell) => occupied.add(cell));
    const rows = ship.cells.map((cell) => Math.floor(cell / 8)); const cols = ship.cells.map((cell) => cell % 8);
    return ship.horizontal ? new Set(rows).size === 1 && Math.max(...cols) - Math.min(...cols) + 1 === definition.length : new Set(cols).size === 1 && Math.max(...rows) - Math.min(...rows) + 1 === definition.length;
  });
}
function sunk(ships: BattleshipShip[], shots: BattleshipCell[]) { return ships.length > 0 && ships.every((ship) => ship.cells.every((cell) => shots[cell] === "hit")); }

export function createBattleshipRoom(rawName: string) {
  load(); const id = randomUUID(); const code = Math.random().toString(36).slice(2, 8).toUpperCase(); const name = nameRequired(rawName);
  const room: BattleshipRoom = { code, hostId: id, players: [{ id, name }], spectators: [], ships: { [id]: [] }, shots: { [id]: emptyBoard() }, readyPlayers: [], settledPlayers: [], stake: null, turn: id, winner: null, message: "Waiting for another player to join.", updatedAt: Date.now() };
  rooms.set(code, room); save(); return { room, playerId: id, playerToken: token(code, id) };
}
export function getBattleshipRoom(code: string) { load(); return rooms.get(code.trim().toUpperCase()); }
export function joinBattleshipRoom(code: string, rawName: string) {
  load(); const room = getBattleshipRoom(code); if (!room) throw new Error("Room not found."); if (room.players.length >= 2) throw new Error("That room is full.");
  const id = randomUUID(); room.players.push({ id, name: nameRequired(rawName) }); room.ships[id] = []; room.shots[id] = emptyBoard(); room.message = "Place your fleets, then both players must ready up."; touch(room); return { room, playerId: id, playerToken: token(room.code, id) };
}
export function spectateBattleshipRoom(code: string, rawName: string) {
  const room = getBattleshipRoom(code); if (!room) throw new Error("Room not found."); const id = randomUUID(); room.spectators.push({ id, name: nameRequired(rawName) }); touch(room); return { room, playerId: id, playerToken: token(room.code, id) };
}
export function applyBattleshipAction(room: BattleshipRoom, id: string, action: BattleshipAction) {
  if (!room.players.some((player) => player.id === id)) throw new Error("Spectators cannot perform game actions.");
  const player = room.players.find((item) => item.id === id)!; const other = room.players.find((item) => item.id !== id)!;
  if (action.type === "place") { if (room.readyPlayers.length > 0) throw new Error("Placement is locked."); if (!validShips(action.ships)) throw new Error("Fleet placement is invalid."); room.ships[id] = action.ships; room.message = `${player.name} placed a fleet.`; touch(room); return; }
  if (action.type === "ready") {
    if (room.players.length < 2 || room.ships[id]?.length !== 4) throw new Error("Place all four ships first.");
    if (!Number.isFinite(action.stake) || action.stake < 1 || action.stake > 250) throw new Error("Stake must be between 1 and 250 moose bucks.");
    if (room.stake !== null && room.stake !== action.stake) throw new Error(`Both players must use the ${room.stake.toFixed(2)} moose buck stake.`);
    room.stake = Math.round(action.stake * 100) / 100; if (!room.readyPlayers.includes(id)) room.readyPlayers.push(id);
    if (room.readyPlayers.length === 2) room.message = `${player.name} starts. Fire when ready.`; else room.message = `${player.name} is ready. Waiting for the other fleet.`;
    touch(room); return;
  }
  if (action.type === "settle") { if (!room.winner || room.stake === null) throw new Error("The round is not finished."); if (!room.settledPlayers.includes(id)) room.settledPlayers.push(id); touch(room); return; }
  if (room.readyPlayers.length !== 2 || room.winner) throw new Error("The battle has not started."); if (room.turn !== id) throw new Error("It is not your turn.");
  if (!Number.isInteger(action.cell) || action.cell < 0 || action.cell >= 64 || room.shots[id][action.cell] !== "water") throw new Error("Choose an unplayed cell.");
  const targetShots = room.shots[id]; const targetShips = room.ships[other.id]; const hit = targetShips.some((ship) => ship.cells.includes(action.cell)); targetShots[action.cell] = hit ? "hit" : "miss";
  room.message = `${player.name} fired at ${String.fromCharCode(65 + action.cell % 8)}${Math.floor(action.cell / 8) + 1}: ${hit ? "hit" : "miss"}.`;
  if (sunk(targetShips, targetShots)) { room.winner = player.name; room.message = `${player.name} destroyed the enemy fleet!`; } else room.turn = other.id;
  touch(room);
}
export function viewBattleshipRoom(room: BattleshipRoom, id: string) {
  const player = room.players.some((item) => item.id === id); const spectator = room.spectators.some((item) => item.id === id); if (!player && !spectator) throw new Error("You are not in this room.");
  const opponent = room.players.find((item) => item.id !== id) ?? null; const ownShips = player ? room.ships[id] : []; const ownShots = player ? room.shots[id] : emptyBoard();
  return { code: room.code, role: spectator ? "spectator" : "player", playerName: [...room.players, ...room.spectators].find((item) => item.id === id)?.name ?? "Player", hostId: room.hostId, players: room.players, spectators: room.spectators, opponent: player ? opponent : null, ownShips, ownShots, opponentShotCount: player && opponent ? room.shots[opponent.id].filter((cell) => cell !== "water").length : 0, opponentHitCount: player && opponent ? room.shots[opponent.id].filter((cell) => cell === "hit").length : 0, opponentFleetPlaced: player && opponent ? room.ships[opponent.id].length === 4 : false, readyCount: room.readyPlayers.length, isReady: room.readyPlayers.includes(id), isYourTurn: player && room.turn === id, winner: room.winner, stake: room.stake, settledCount: room.settledPlayers.length, message: room.message, updatedAt: room.updatedAt };
}
