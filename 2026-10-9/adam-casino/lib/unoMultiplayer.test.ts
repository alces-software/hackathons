import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyUnoAction,
  createUnoRoom,
  joinUnoRoom,
  spectateUnoRoom,
  verifyPlayerToken,
  viewUnoRoom,
} from "./unoMultiplayer.ts";

test("host-selected No Mercy room gates play until both players are ready", () => {
  assert.throws(() => createUnoRoom("   "), /Enter a name/);
  const host = createUnoRoom("Host", "no-mercy");
  const guest = joinUnoRoom(host.room.code, "Guest");

  assert.equal(host.room.ruleset, "no-mercy");
  assert.equal(host.room.players.length, 2);
  assert.equal(verifyPlayerToken(host.room.code, host.playerToken), host.playerId);
  assert.throws(() => applyUnoAction(host.room, host.playerId, { type: "draw" }), /confirm their stakes/);

  applyUnoAction(host.room, host.playerId, { type: "ready", stake: 25 });
  assert.equal(viewUnoRoom(host.room, host.playerId).bothPlayersReady, false);
  applyUnoAction(host.room, guest.playerId, { type: "ready", stake: 25 });

  const hostView = viewUnoRoom(host.room, host.playerId);
  const guestView = viewUnoRoom(host.room, guest.playerId);
  assert.equal(hostView.bothPlayersReady, true);
  assert.equal(hostView.hand.length, 7);
  assert.equal(guestView.hand.length, 7);
});

test("spectators receive public state but never a private hand", () => {
  const host = createUnoRoom("Host");
  const guest = joinUnoRoom(host.room.code, "Guest");
  applyUnoAction(host.room, host.playerId, { type: "ready", stake: 10 });
  applyUnoAction(host.room, guest.playerId, { type: "ready", stake: 10 });

  const spectator = spectateUnoRoom(host.room.code, "Watcher");
  const spectatorView = viewUnoRoom(host.room, spectator.playerId);
  assert.equal(spectatorView.role, "spectator");
  assert.deepEqual(spectatorView.hand, []);
  assert.equal(spectatorView.players.length, 2);
  assert.equal(spectatorView.spectators.length, 1);
  assert.throws(() => applyUnoAction(host.room, spectator.playerId, { type: "draw" }), /not in this room/);
});

test("both settled players can start a rematch in the same room", () => {
  const host = createUnoRoom("Host");
  const guest = joinUnoRoom(host.room.code, "Guest");
  host.room.winner = "Host";
  host.room.settledPlayers = [host.playerId, guest.playerId];
  host.room.deck = [{ id: 1, color: "red", value: "0" }];

  applyUnoAction(host.room, host.playerId, { type: "ready", stake: 15 });
  assert.equal(host.room.winner, "Host");
  applyUnoAction(host.room, guest.playerId, { type: "ready", stake: 15 });

  assert.equal(host.room.winner, null);
  assert.equal(host.room.players.length, 2);
  assert.equal(host.room.hands[host.playerId].length, 7);
  assert.equal(host.room.hands[guest.playerId].length, 7);
});

test("a playable card drawn during a turn can be played before passing", () => {
  const host = createUnoRoom("Host");
  const guest = joinUnoRoom(host.room.code, "Guest");
  applyUnoAction(host.room, host.playerId, { type: "ready", stake: 10 });
  applyUnoAction(host.room, guest.playerId, { type: "ready", stake: 10 });

  const drawnCard = { id: 900, color: "red" as const, value: "5" as const };
  host.room.hands[host.playerId] = [drawnCard];
  host.room.discard = [{ id: 901, color: "red", value: "4" }];
  host.room.activeColor = "red";
  host.room.drawnId = drawnCard.id;
  host.room.turn = host.playerId;

  applyUnoAction(host.room, host.playerId, { type: "play", cardId: drawnCard.id });

  assert.equal(host.room.winner, host.room.players[0].name);
  assert.equal(host.room.hands[host.playerId].length, 0);
});

test("rooms can start with more than two players and rotate turns", () => {
  const host = createUnoRoom("Host", "regular", 4);
  const second = joinUnoRoom(host.room.code, "Second");
  const third = joinUnoRoom(host.room.code, "Third");

  applyUnoAction(host.room, host.playerId, { type: "ready", stake: 10 });
  applyUnoAction(host.room, second.playerId, { type: "ready", stake: 10 });
  assert.equal(host.room.deck.length, 0);
  applyUnoAction(host.room, third.playerId, { type: "ready", stake: 10 });
  assert.equal(host.room.deck.length, 0);

  const fourth = joinUnoRoom(host.room.code, "Fourth");
  applyUnoAction(host.room, fourth.playerId, { type: "ready", stake: 10 });

  assert.equal(host.room.players.length, 4);
  assert.equal(host.room.readyPlayers.length, 4);
  assert.equal(host.room.hands[third.playerId].length, 7);
  assert.equal(host.room.turn, host.playerId);
  assert.equal(viewUnoRoom(host.room, host.playerId).maxPlayers, 4);
});

test("reverse gives the current player another turn in a two-player room", () => {
  const host = createUnoRoom("Host");
  const guest = joinUnoRoom(host.room.code, "Guest");
  applyUnoAction(host.room, host.playerId, { type: "ready", stake: 10 });
  applyUnoAction(host.room, guest.playerId, { type: "ready", stake: 10 });

  host.room.hands[host.playerId] = [
    { id: 910, color: "red", value: "reverse" },
    { id: 911, color: "blue", value: "5" },
  ];
  host.room.discard = [{ id: 912, color: "red", value: "4" }];
  host.room.activeColor = "red";
  host.room.turn = host.playerId;

  applyUnoAction(host.room, host.playerId, { type: "play", cardId: 910 });

  assert.equal(host.room.turn, host.playerId);
  assert.equal(host.room.direction, 1);
});

test("No Mercy switch exchanges hands with the selected player", () => {
  const host = createUnoRoom("Host", "no-mercy", 3);
  const second = joinUnoRoom(host.room.code, "Second");
  const third = joinUnoRoom(host.room.code, "Third");
  for (const player of [host, second, third]) applyUnoAction(host.room, player.playerId, { type: "ready", stake: 10 });

  host.room.hands[host.playerId] = [
    { id: 920, color: "red", value: "switch" },
    { id: 924, color: "red", value: "5" },
  ];
  host.room.hands[second.playerId] = [{ id: 921, color: "blue", value: "1" }];
  host.room.hands[third.playerId] = [{ id: 922, color: "green", value: "2" }];
  host.room.discard = [{ id: 923, color: "red", value: "4" }];
  host.room.activeColor = "red";
  host.room.turn = host.playerId;

  applyUnoAction(host.room, host.playerId, { type: "play", cardId: 920, targetPlayerId: third.playerId });

  assert.equal(host.room.hands[host.playerId][0].id, 922);
  assert.equal(host.room.hands[third.playerId][0].id, 924);
  assert.equal(host.room.turn, second.playerId);
});

test("No Mercy draw-until-color draws through the deck until the target color", () => {
  const host = createUnoRoom("Host", "no-mercy");
  const guest = joinUnoRoom(host.room.code, "Guest");
  applyUnoAction(host.room, host.playerId, { type: "ready", stake: 10 });
  applyUnoAction(host.room, guest.playerId, { type: "ready", stake: 10 });

  host.room.hands[host.playerId] = [];
  host.room.deck = [
    { id: 930, color: "red", value: "1" },
    { id: 931, color: "blue", value: "2" },
  ];
  host.room.pendingDrawColor = "blue";
  host.room.turn = host.playerId;
  host.room.discard = [{ id: 932, color: "wild", value: "drawColor" }];

  applyUnoAction(host.room, host.playerId, { type: "draw" });

  assert.deepEqual(host.room.hands[host.playerId].map((card) => card.color), ["red", "blue"]);
  assert.equal(host.room.pendingDrawColor, null);
  assert.equal(host.room.turn, guest.playerId);
});
