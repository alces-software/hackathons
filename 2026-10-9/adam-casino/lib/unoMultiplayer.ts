import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export type UnoColor = "red" | "yellow" | "green" | "blue" | "wild";
export type UnoPlayColor = Exclude<UnoColor, "wild">;
export type UnoValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "draw4" | "draw6" | "draw10" | "switch" | "discardColor" | "drawColor";
export type UnoCard = { id: number; color: UnoColor; value: UnoValue };
export type UnoRuleset = "regular" | "no-mercy";
export type UnoAction = { type: "play"; cardId: number; color?: UnoPlayColor; targetPlayerId?: string } | { type: "draw" } | { type: "pass" } | { type: "ready"; stake: number } | { type: "settle" } | { type: "configure"; ruleset: UnoRuleset };
export type UnoPlayer = { id: string; name: string };

export type UnoRoom = {
  code: string;
  hostId: string;
  maxPlayers: number;
  players: UnoPlayer[];
  spectators: UnoPlayer[];
  ruleset: UnoRuleset;
  deck: UnoCard[];
  discard: UnoCard[];
  hands: Record<string, UnoCard[]>;
  activeColor: UnoPlayColor;
  turn: string;
  direction: 1 | -1;
  drawnId: number | null;
  winner: string | null;
  stake: number | null;
  readyPlayers: string[];
  settledPlayers: string[];
  pendingDraw: number;
  pendingDrawColor: UnoPlayColor | null;
  message: string;
  updatedAt: number;
};

const colors: UnoPlayColor[] = ["red", "yellow", "green", "blue"];
const rooms = new Map<string, UnoRoom>();
const roomsFile = process.env.UNO_ROOMS_FILE ?? join(process.cwd(), ".data/uno-rooms.json");
const sessionSecret = process.env.UNO_SESSION_SECRET ?? "local-development-only-change-me";
let roomsLoaded = false;

function requirePlayerName(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error("Enter a name before joining a UNO room.");
  return normalized.slice(0, 24);
}

function createPlayerToken(code: string, playerId: string) {
  const payload = `${code}:${playerId}`;
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${playerId}.${signature}`;
}

export function verifyPlayerToken(code: string, token: string) {
  const [playerId, signature] = token.split(".");
  if (!playerId || !signature) return null;
  const expected = createPlayerToken(code.trim().toUpperCase(), playerId).split(".")[1];
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null;
  return playerId;
}

function loadRooms() {
  if (roomsLoaded) return;
  roomsLoaded = true;
  if (!existsSync(/* turbopackIgnore: true */ roomsFile)) return;
  try {
    const savedRooms = JSON.parse(readFileSync(/* turbopackIgnore: true */ roomsFile, "utf8")) as UnoRoom[];
    savedRooms.forEach((room) => {
      room.hostId ??= room.players[0]?.id;
      room.maxPlayers ??= 2;
      room.direction ??= 1;
      room.spectators ??= [];
      room.ruleset ??= "regular";
      room.stake ??= null;
      room.readyPlayers ??= [];
      room.settledPlayers ??= [];
      room.pendingDraw ??= 0;
      room.pendingDrawColor ??= null;
      rooms.set(room.code, room);
    });
  } catch {
    // A corrupt persistence file should not prevent the casino from starting.
  }
}

function saveRooms() {
  mkdirSync(dirname(roomsFile), { recursive: true });
  writeFileSync(roomsFile, JSON.stringify([...rooms.values()]), "utf8");
}

function shuffle(cards: UnoCard[]) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function makeDeck(ruleset: UnoRuleset) {
  let id = 0;
  const deck: UnoCard[] = [];
  colors.forEach((color) => {
    deck.push({ id: id++, color, value: "0" });
    for (let copy = 0; copy < 2; copy += 1) {
      (["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"] as UnoValue[]).forEach((value) => deck.push({ id: id++, color, value }));
    }
  });
  for (let copy = 0; copy < 4; copy += 1) {
    deck.push({ id: id++, color: "wild", value: "wild" }, { id: id++, color: "wild", value: "draw4" });
    if (ruleset === "no-mercy") {
      deck.push({ id: id++, color: "wild", value: "draw6" }, { id: id++, color: "wild", value: "draw10" }, { id: id++, color: "wild", value: "drawColor" });
      colors.forEach((color) => deck.push({ id: id++, color, value: "discardColor" }, { id: id++, color, value: "switch" }));
    }
  }
  return shuffle(deck);
}

function drawAmount(value: UnoValue) {
  return value === "draw2" ? 2 : value === "draw4" ? 4 : value === "draw6" ? 6 : value === "draw10" ? 10 : 0;
}

function canPlay(card: UnoCard, top: UnoCard, room: UnoRoom) {
  if (room.pendingDrawColor !== null) return false;
  if (room.pendingDraw > 0) {
    // Compare against the last draw card played, not the running total.
    const amount = drawAmount(card.value);
    const topAmount = drawAmount(top.value);
    return amount > 0 && (room.ruleset === "no-mercy" ? amount >= topAmount : amount === topAmount);
  }
  if (room.drawnId !== null) return card.id === room.drawnId;
  if (room.deck.length === 0 && room.discard.length <= 1) return false;
  return card.color === "wild" || card.color === room.activeColor || card.value === top.value;
}

function refillDeck(room: UnoRoom) {
  if (room.deck.length > 0 || room.discard.length <= 1) return;
  const top = room.discard[room.discard.length - 1];
  room.deck = shuffle(room.discard.slice(0, -1));
  room.discard = [top];
}

function drawCards(room: UnoRoom, playerId: string, count: number) {
  const hand = room.hands[playerId];
  for (let index = 0; index < count; index += 1) {
    refillDeck(room);
    const card = room.deck.shift();
    if (!card) break;
    hand.push(card);
  }
}

function touch(room: UnoRoom) {
  room.updatedAt = Date.now();
}

function nextPlayer(room: UnoRoom, playerId: string, steps = 1) {
  const index = room.players.findIndex((player) => player.id === playerId);
  if (index < 0) throw new Error("Player is not in this room.");
  const offset = room.direction * steps;
  return room.players[(index + offset + room.players.length * 10) % room.players.length];
}

export function createUnoRoom(name: string, ruleset: UnoRuleset = "regular", maxPlayers = 2) {
  loadRooms();
  const playerName = requirePlayerName(name);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) throw new Error("UNO rooms can have between 2 and 8 players.");
  const playerId = randomUUID();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const room: UnoRoom = {
    code,
    hostId: playerId,
    maxPlayers,
    players: [{ id: playerId, name: playerName }],
    spectators: [],
    ruleset,
    deck: [],
    discard: [],
    hands: { [playerId]: [] },
    activeColor: "blue",
    turn: playerId,
    direction: 1,
    drawnId: null,
    winner: null,
    stake: null,
    readyPlayers: [],
    settledPlayers: [],
    pendingDraw: 0,
    pendingDrawColor: null,
    message: "Waiting for another player to join.",
    updatedAt: Date.now(),
  };
  rooms.set(code, room);
  saveRooms();
  return { room, playerId, playerToken: createPlayerToken(code, playerId) };
}

export function joinUnoRoom(code: string, name: string) {
  loadRooms();
  const playerName = requirePlayerName(name);
  const room = rooms.get(code.trim().toUpperCase());
  if (!room) throw new Error("Room not found.");
  if (room.players.length >= room.maxPlayers) throw new Error("That room is full.");
  if (room.deck.length > 0) throw new Error("That game has already started.");
  const playerId = randomUUID();
  room.players.push({ id: playerId, name: playerName });
  room.hands[playerId] = [];
  room.message = "Choose a stake and confirm when ready. All players must match.";
  touch(room);
  saveRooms();
  return { room, playerId, playerToken: createPlayerToken(room.code, playerId) };
}

export function spectateUnoRoom(code: string, name: string) {
  loadRooms();
  const playerName = requirePlayerName(name);
  const room = rooms.get(code.trim().toUpperCase());
  if (!room) throw new Error("Room not found.");
  const spectatorId = randomUUID();
  room.spectators.push({ id: spectatorId, name: playerName });
  touch(room);
  saveRooms();
  return { room, playerId: spectatorId, playerToken: createPlayerToken(room.code, spectatorId) };
}

export function getUnoRoom(code: string) {
  loadRooms();
  return rooms.get(code.trim().toUpperCase());
}

export function applyUnoAction(room: UnoRoom, playerId: string, action: UnoAction) {
  if (!room.players.some((player) => player.id === playerId)) throw new Error("You are not in this room.");
  if (action.type === "configure") {
    if (room.hostId !== playerId) throw new Error("Only the room creator can choose the ruleset.");
    if (room.deck.length > 0 || room.readyPlayers.length > 0) throw new Error("The ruleset can only be changed before players ready up.");
    room.ruleset = action.ruleset;
    room.message = `${action.ruleset === "no-mercy" ? "UNO No Mercy" : "Regular UNO"} selected. Choose a stake when ready.`;
    touch(room);
    saveRooms();
    return;
  }
  if (action.type === "ready") {
    if (room.players.length < 2) throw new Error("Waiting for another player to join.");
    const rematch = room.winner !== null && room.settledPlayers.length === room.players.length;
    if (room.deck.length > 0 && !rematch) throw new Error("The game has already started.");
    if (rematch && room.readyPlayers.length === 0) {
      room.hands[room.players[0].id] = [];
      room.players.slice(1).forEach((roomPlayer) => { room.hands[roomPlayer.id] = []; });
      room.discard = [];
      room.deck = [];
      room.stake = null;
    }
    if (!Number.isFinite(action.stake) || action.stake < 1 || action.stake > 250) throw new Error("Stake must be between 1 and 250 moose bucks.");
    if (room.stake !== null && room.stake !== action.stake) throw new Error(`Both players must use the ${room.stake.toFixed(2)} moose buck stake.`);
    room.stake = Math.round(action.stake * 100) / 100;
    if (!room.readyPlayers.includes(playerId)) room.readyPlayers.push(playerId);
    if (room.readyPlayers.length === room.maxPlayers) {
      const deck = makeDeck(room.ruleset);
      const firstCardIndex = deck.findIndex((card) => /^\d$/.test(card.value));
      const [firstCard] = deck.splice(firstCardIndex, 1);
      room.deck = deck.slice(room.players.length * 7);
      room.players.forEach((roomPlayer, index) => {
        room.hands[roomPlayer.id] = deck.slice(index * 7, (index + 1) * 7);
      });
      room.discard = [firstCard];
      room.activeColor = firstCard.color as UnoPlayColor;
      room.pendingDraw = 0;
      room.pendingDrawColor = null;
      room.drawnId = null;
      room.direction = 1;
      room.winner = null;
      room.settledPlayers = [];
      room.turn = room.players[0].id;
      room.message = `${room.players[0].name} starts. ${room.players[0].name}'s turn.`;
    } else {
      room.message = `${room.players.find((player) => player.id === playerId)!.name} is ready. Waiting for all players to confirm the ${room.stake.toFixed(2)} moose buck stake.`;
    }
    touch(room);
    saveRooms();
    return;
  }
  if (action.type === "settle") {
    if (!room.winner || room.stake === null) throw new Error("The round is not ready to settle.");
    if (!room.settledPlayers.includes(playerId)) room.settledPlayers.push(playerId);
    if (room.settledPlayers.length === room.players.length) {
      room.readyPlayers = [];
      room.stake = null;
    }
    touch(room);
    saveRooms();
    return;
  }
  if (room.players.length < 2) throw new Error("Waiting for another player to join.");
  if (room.deck.length === 0) throw new Error("Waiting for both players to confirm their stakes.");
  if (room.winner) throw new Error("This game is already over.");
  if (room.turn !== playerId) throw new Error("It is not your turn.");
  const hand = room.hands[playerId];
  const top = room.discard[room.discard.length - 1];
  const player = room.players.find((item) => item.id === playerId)!;

  if (action.type === "draw") {
    if (room.drawnId !== null) throw new Error("Play the card you drew, or pass.");
    if (room.pendingDrawColor !== null) {
      let drawn = 0;
      let lastDrawnColor: UnoColor | null = null;
      while (room.deck.length > 0 && lastDrawnColor !== room.pendingDrawColor) {
        const before = room.hands[playerId].length;
        drawCards(room, playerId, 1);
        if (room.hands[playerId].length === before) break;
        lastDrawnColor = room.hands[playerId][room.hands[playerId].length - 1].color;
        drawn += 1;
      }
      room.pendingDrawColor = null;
      room.drawnId = null;
      room.turn = nextPlayer(room, playerId).id;
      room.message = `${player.name} drew ${drawn} cards until finding the active color.`;
      if (room.ruleset === "no-mercy" && hand.length >= 25) {
        room.winner = nextPlayer(room, playerId).name;
        room.message = `${player.name} reached 25 cards and was knocked out.`;
      }
      touch(room);
      saveRooms();
      return;
    }

    const forced = room.pendingDraw > 0;
    const count = forced ? room.pendingDraw : 1; // never infer the count from the top card
    const handSizeBeforeDraw = hand.length;
    drawCards(room, playerId, count);
    const gained = hand.length - handSizeBeforeDraw;
    room.pendingDraw = 0;
    room.drawnId = null; // always reset so it can never leak to the other player

    if (room.ruleset === "no-mercy" && hand.length >= 25) {
      room.winner = nextPlayer(room, playerId).name;
      room.message = `${player.name} reached 25 cards and was knocked out.`;
    } else if (forced || gained === 0) {
      room.turn = nextPlayer(room, playerId).id;
      room.message = gained === 0 ? `${player.name} had nothing left to draw.` : `${player.name} drew ${gained} cards.`;
    } else {
      const drawnCard = hand[hand.length - 1];
      if (canPlay(drawnCard, top, room)) {
        room.drawnId = drawnCard.id; // only now may the player keep it and pass
        room.message = `${player.name} drew a card and may play it or pass.`;
      } else {
        room.turn = nextPlayer(room, playerId).id; // unplayable: turn ends automatically
        room.message = `${player.name} drew a card.`;
      }
    }
  } else if (action.type === "pass") {
    if (room.drawnId === null) throw new Error("Draw a card before passing.");
    room.drawnId = null;
    room.turn = nextPlayer(room, playerId).id;
    room.message = `${player.name} passed.`;
  } else {
    const cardIndex = hand.findIndex((card) => card.id === action.cardId);
    const card = hand[cardIndex];
    if (!card || !canPlay(card, top, room)) throw new Error("That card cannot be played.");
    if (card.color === "wild" && !action.color) throw new Error("Choose a color for the wild card.");
    const switchTarget = card.value === "switch" && room.ruleset === "no-mercy"
      ? room.players.find((roomPlayer) => roomPlayer.id === action.targetPlayerId && roomPlayer.id !== playerId)
      : null;
    if (card.value === "switch" && room.ruleset === "no-mercy" && !switchTarget) throw new Error("Choose another player to switch hands with.");
    hand.splice(cardIndex, 1);
    const wentOut = hand.length === 0; // judged before Hand Switch swaps the arrays
    room.discard.push(card);
    room.activeColor = card.color === "wild" ? action.color! : card.color;
    room.drawnId = null;
    if (card.value === "draw2" || card.value === "draw4" || card.value === "draw6" || card.value === "draw10") room.pendingDraw += drawAmount(card.value);
    if (card.value === "drawColor" && room.ruleset === "no-mercy") room.pendingDrawColor = room.activeColor;
    if (card.value === "discardColor" && room.ruleset === "no-mercy") room.hands[playerId] = hand.filter((item) => item.color !== room.activeColor);
    if (card.value === "switch" && room.ruleset === "no-mercy") {
      const targetHand = room.hands[switchTarget!.id];
      room.hands[switchTarget!.id] = room.hands[playerId];
      room.hands[playerId] = targetHand;
    }
    const emptiedByDiscardColor = card.value === "discardColor" && room.ruleset === "no-mercy" && room.hands[playerId].length === 0;
    if (wentOut || emptiedByDiscardColor) {
      room.winner = player.name;
      room.message = `${player.name} wins!`;
    } else {
      if (card.value === "reverse" && room.players.length > 2) room.direction = room.direction === 1 ? -1 : 1;
      const steps = card.value === "skip" || (card.value === "reverse" && room.players.length === 2) ? 2 : 1;
      room.turn = nextPlayer(room, playerId, steps).id;
      room.message = `${player.name} played ${card.color === "wild" ? "a wild card" : card.value}.`;
    }
  }
  touch(room);
  saveRooms();
}

export function viewUnoRoom(room: UnoRoom, playerId: string) {
  const isPlayer = room.players.some((player) => player.id === playerId);
  const isSpectator = room.spectators.some((spectator) => spectator.id === playerId);
  if (!isPlayer && !isSpectator) throw new Error("You are not in this room.");
  const opponent = room.players.find((player) => player.id !== playerId) ?? null;
  const currentMember = isPlayer
    ? room.players.find((player) => player.id === playerId)
    : room.spectators.find((spectator) => spectator.id === playerId);
  return {
    code: room.code,
    playerName: currentMember?.name ?? "Player",
    players: room.players,
    spectators: room.spectators,
    role: isSpectator ? "spectator" : "player",
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    ruleset: room.ruleset,
    hand: isPlayer ? room.hands[playerId] : [],
    opponent: isPlayer ? opponent : null,
    opponentCardCount: isPlayer && opponent ? room.hands[opponent.id].length : 0,
    opponents: isPlayer
      ? room.players.filter((player) => player.id !== playerId).map((player) => ({ ...player, cardCount: room.hands[player.id].length }))
      : [],
    deckCount: room.deck.length,
    top: room.discard[room.discard.length - 1] ?? null,
    activeColor: room.activeColor,
    isYourTurn: isPlayer && room.turn === playerId,
    currentTurn: room.players.find((player) => player.id === room.turn)?.name ?? "Unknown player",
    direction: room.direction,
    turnOrder: room.players.map((player) => player.name),
    drawnId: room.drawnId,
    pendingDraw: room.pendingDraw,
    pendingDrawColor: room.pendingDrawColor,
    winner: room.winner,
    stake: room.stake,
    isReady: room.readyPlayers.includes(playerId),
    readyCount: room.readyPlayers.length,
    bothPlayersReady: room.readyPlayers.length === room.maxPlayers,
    settlementComplete: room.settledPlayers.includes(playerId),
    settledCount: room.settledPlayers.length,
    message: room.message,
    updatedAt: room.updatedAt,
  };
}