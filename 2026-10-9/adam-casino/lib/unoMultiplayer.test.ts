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
