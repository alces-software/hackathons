import assert from "node:assert/strict";
import test from "node:test";
import { aiMoveTactical, DEFAULT_TACTICS, newGame, simulateGame, type AiTactics } from "./unoLocal.ts";

// Monte-Carlo harness: player = greedy baseline, AI = tactical defaults.
const RUNS = parseInt(process.env.UNO_SIM_RUNS ?? "2000", 10);

test(`simulated win rates (player vs tactical AI, ${RUNS} games)`, () => {
  let player = 0;
  let ai = 0;
  let stalemate = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const result = simulateGame(newGame(i, i % 2 === 0 ? "player" : "ai", "regular"), DEFAULT_TACTICS);
    if (result === "You") player += 1;
    else if (result === "AI") ai += 1;
    else stalemate += 1;
  }
  const playerRate = (player / RUNS) * 100;
  const aiRate = (ai / RUNS) * 100;
  console.log(`regular  — player ${playerRate.toFixed(1)}% · AI ${aiRate.toFixed(1)}% · stalemate ${((stalemate / RUNS) * 100).toFixed(1)}%`);
  assert.ok(playerRate < 55, `player win rate ${playerRate.toFixed(1)}% should sit at or below ~50%`);
  assert.ok(stalemate / RUNS < 0.02, "games should resolve, not stall");
});

test(`simulated no-mercy win rates (player vs tactical AI, ${RUNS} games)`, () => {
  let player = 0;
  let ai = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const result = simulateGame(newGame(i, i % 2 === 0 ? "player" : "ai", "no-mercy"), DEFAULT_TACTICS);
    if (result === "You") player += 1;
    else if (result === "AI") ai += 1;
  }
  const playerRate = (player / (player + ai)) * 100;
  console.log(`no-mercy — player ${playerRate.toFixed(1)}% · AI ${(100 - playerRate).toFixed(1)}%`);
  assert.ok(playerRate < 50, `no-mercy player win rate ${playerRate.toFixed(1)}% should sit below 50% (hard mode)`);
});

test("tuned tactics profile compiles", () => {
  const profile: AiTactics = DEFAULT_TACTICS;
  assert.equal(profile.winOut, 100);
});
