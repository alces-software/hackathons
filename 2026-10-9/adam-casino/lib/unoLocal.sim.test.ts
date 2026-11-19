import assert from "node:assert/strict";
import test from "node:test";
import { aiMoveTactical, DEFAULT_TACTICS, newGame, playCard, simulateGame, type AiTactics, type Game } from "./unoLocal.ts";

// Monte-Carlo harness: player = greedy baseline, AI = tactical defaults.
const RUNS = parseInt(process.env.UNO_SIM_RUNS ?? "2000", 10);

test(`simulated win rates (player vs tactical AI, ${RUNS} games)`, () => {
  let player = 0;
  let ai = 0;
  let stalemate = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const result = simulateGame(newGame(i, "ai", "regular"), DEFAULT_TACTICS);
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
    const result = simulateGame(newGame(i, "ai", "no-mercy"), DEFAULT_TACTICS);
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

// Regression: a discardColor that wipes every remaining colour card must win on the spot,
// and a forced turn while playing it must not be scored as an instant win.
test("discardColor emptying the hand wins, including as a forced turn", () => {
  const game = newGame(0, "ai", "no-mercy");
  const yellowDiscard = game.deck.find((card) => card.value === "discardColor" && card.color === "yellow")!;
  // Player: the discardColor plus a yellow number card — the pre-effect empty-hand check
  // passes over it, and only the discard-a-colour effect empties the hand.
  const player = [
    yellowDiscard,
    game.deck.find((card) => /^\d$/.test(card.value) && card.color === "yellow")!,
  ];
  // AI: an unplayable hand whose only coloured card is yellow — wiped by the effect, not a win.
  const ai = game.deck.filter((card) => card.value === "9" && card.color !== "yellow").slice(0, 3);
  const staged: Game = {
    ...game,
    player,
    ai,
    discard: [game.deck.find((card) => /^\d$/.test(card.value) && card.color === "yellow")!],
    turn: "player",
  };
  const played = playCard(staged, "player", yellowDiscard);
  assert.equal(played.winner, "You");
  assert.ok((played.message ?? "").toLowerCase().includes("discarded all yellow cards and went out"));

  // Forced-turn variant: pendingDrawColor requires the player to find a yellow; playing the
  // discardColor (hand still holds one extra yellow) must award the win, not pass the turn.
  const forced: Game = {
    ...staged,
    player: [yellowDiscard, ...staged.player.filter((card) => card.id !== yellowDiscard.id), game.deck.find((card) => /^\d$/.test(card.value) && card.color === "yellow")!],
    pendingDrawColor: "yellow",
    turn: "player",
  };
  const forcedPlay = playCard(forced, "player", yellowDiscard);
  assert.equal(forcedPlay.winner, "You");
  assert.equal(forcedPlay.ai.length, 3);
  assert.ok(forcedPlay.ai.every((card) => card.color !== "yellow"));
});
