import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBattleshipAction, createBattleshipRoom, joinBattleshipRoom, spectateBattleshipRoom, viewBattleshipRoom } from "./battleshipsMultiplayer.ts";

const hostFleet = [
  { name: "Battleship", cells: [0, 1, 2, 3], horizontal: true },
  { name: "Cruiser", cells: [16, 24, 32], horizontal: false },
  { name: "Destroyer", cells: [28, 29, 30], horizontal: true },
  { name: "Patrol boat", cells: [54, 62], horizontal: false },
];
const guestFleet = [
  { name: "Battleship", cells: [8, 9, 10, 11], horizontal: true },
  { name: "Cruiser", cells: [24, 32, 40], horizontal: false },
  { name: "Destroyer", cells: [36, 37, 38], horizontal: true },
  { name: "Patrol boat", cells: [60, 61], horizontal: true },
];

test("Battleships keeps fleets private and gates the battle on matching stakes", () => {
  const host = createBattleshipRoom("Host");
  const guest = joinBattleshipRoom(host.room.code, "Guest");
  const spectator = spectateBattleshipRoom(host.room.code, "Watcher");
  applyBattleshipAction(host.room, host.playerId, { type: "place", ships: hostFleet });
  applyBattleshipAction(host.room, guest.playerId, { type: "place", ships: guestFleet });
  applyBattleshipAction(host.room, host.playerId, { type: "ready", stake: 10 });
  assert.equal(viewBattleshipRoom(host.room, host.playerId).readyCount, 1);
  assert.throws(() => applyBattleshipAction(host.room, guest.playerId, { type: "ready", stake: 25 }), /Both players/);
  applyBattleshipAction(host.room, guest.playerId, { type: "ready", stake: 10 });
  const spectatorView = viewBattleshipRoom(host.room, spectator.playerId);
  assert.equal(spectatorView.role, "spectator");
  assert.deepEqual(spectatorView.ownShips, []);
  assert.throws(() => applyBattleshipAction(host.room, spectator.playerId, { type: "fire", cell: 0 }), /Spectators/);
});

test("Battleships rejects out-of-turn shots and records a winning shot", () => {
  const host = createBattleshipRoom("Host");
  const guest = joinBattleshipRoom(host.room.code, "Guest");
  applyBattleshipAction(host.room, host.playerId, { type: "place", ships: hostFleet });
  applyBattleshipAction(host.room, guest.playerId, { type: "place", ships: guestFleet });
  applyBattleshipAction(host.room, host.playerId, { type: "ready", stake: 5 });
  applyBattleshipAction(host.room, guest.playerId, { type: "ready", stake: 5 });
  assert.throws(() => applyBattleshipAction(host.room, guest.playerId, { type: "fire", cell: 0 }), /not your turn/);
  const guestMisses = [7, 8, 9, 10, 11, 12, 13, 14, 15, 23, 31, 39];
  guestFleet.flatMap((ship) => ship.cells).forEach((cell, index) => {
    applyBattleshipAction(host.room, host.playerId, { type: "fire", cell });
    if (index < guestFleet.flatMap((ship) => ship.cells).length - 1) applyBattleshipAction(host.room, guest.playerId, { type: "fire", cell: guestMisses[index] });
  });
  assert.equal(host.room.winner, "Host");
});
