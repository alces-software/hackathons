import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOOPS_BALLS,
  HOOPS_BASKET_PRIZE,
  HOOPS_SENSOR_MARGIN,
  HOOPS_SWISH_PRIZE,
  MOLE_GAP_MIN_MS,
  MOLE_GOLDEN_STING_MS,
  MOLE_PAD_NOISE_MS,
  MOLE_POPS,
  MOLE_PRIZES,
  MOLE_SWING_DELAY_MS,
  judgeHoopsShot,
  judgeMoleEarly,
  judgeMoleTap,
  maximumHoopsPayout,
  maximumMolePayout,
  moleHiddenWindow,
  planMoleRound,
  releaseOffsetFromTap,
  settleHoopsRound,
  settleMoleRound,
} from "./arcade.ts";

const zeroRng = () => 0;
const halfRng = () => 0.5;
const oneRng = () => 0.9999;

const plasticSpawn = (upAtMs: number, downAtMs: number) => ({
  id: 1,
  kind: "mole" as const,
  hole: 4,
  upAtMs,
  downAtMs,
});

test("mole hidden window sits inside the visible window", () => {
  const spawn = plasticSpawn(1_000, 2_000);
  const window = moleHiddenWindow(spawn);
  assert.ok(window.from > spawn.upAtMs, "dodge trim starts after pops up");
  assert.ok(window.to < spawn.downAtMs, "sting trim ends before drops");
  assert.ok(window.from < window.to, "golden or not, some whackable core remains");
});

test("golden moles lose a little more of the tail", () => {
  const spawn = { ...plasticSpawn(1_000, 2_000), kind: "golden" as const };
  const plastic = moleHiddenWindow(plasticSpawn(1_000, 2_000));
  const golden = moleHiddenWindow(spawn);
  assert.equal(golden.to, plastic.to - MOLE_GOLDEN_STING_MS);
  assert.equal(golden.from, plastic.from);
});

test("mallet lands 90ms after the tap and stung taps knock the mole down but pay nothing", () => {
  // Window 1120-1950 for a 1000ms pop; a frozen pad reads the landing 100ms early.
  const spawn = plasticSpawn(1_000, 2_000);
  const window = moleHiddenWindow(spawn);
  // Landing mid-core reads as a whack.
  const core = (window.from + window.to) / 2;
  const coreTap = { moleId: 1, atMs: core - 90 };
  assert.equal(judgeMoleTap(spawn, coreTap, zeroRng), "whack");
  // A landing in the painted-but-stung tail knocks the mole down for nothing.
  const stingLanding = (window.to + spawn.downAtMs) / 2; // 1975ish
  const stingTap = { moleId: 1, atMs: (stingLanding - 90) + 100 }; // +100 undoes the early pad read
  assert.equal(judgeMoleTap(spawn, stingTap, zeroRng), "sting");
  // Same landing before the hidden window reads as air.
  const early = { moleId: 1, atMs: window.from - 200 - 90 };
  assert.equal(judgeMoleTap(spawn, early, zeroRng), "air");
});

test("landing right at the hidden window edge flips across the boundary", () => {
  const spawn = plasticSpawn(1_000, 2_000);
  const window = moleHiddenWindow(spawn);
  // A frozen pad reads the landing MOLE_PAD_NOISE_MS/2 early (jitter = 0),
  // so a tap lands exactly on the edge when it compensates for that.
  const padBias = MOLE_SWING_DELAY_MS - MOLE_PAD_NOISE_MS / 2;
  const atEdge = { moleId: 1, atMs: window.from - padBias };
  assert.equal(judgeMoleTap(spawn, atEdge, zeroRng), "whack");
  const justBefore = { moleId: 1, atMs: window.from - padBias - 1 };
  assert.equal(judgeMoleTap(spawn, justBefore, zeroRng), "air");
});

test("pad noise can swing a borderline landing either way", () => {
  const spawn = plasticSpawn(1_000, 2_000);
  const window = moleHiddenWindow(spawn);
  const borderline = { moleId: 1, atMs: window.from - 90 - 20 };
  // A frozen pad reads the landing early: air...
  assert.equal(judgeMoleTap(spawn, borderline, zeroRng), "air");
  // ...a generous pad later reads it inside: whack.
  const generousPad = () => 1; // +100ms jitter
  assert.equal(judgeMoleTap(spawn, borderline, generousPad), "whack");
});

test("motor stall can swallow an instant swing but only near the pop", () => {
  const spawn = plasticSpawn(1_000, 2_000);
  const instant = { moleId: 1, atMs: spawn.upAtMs + 10 };
  // One-in-eight stall roll passes (0 < 0.12): the swing is judged blind.
  assert.equal(judgeMoleEarly(spawn, instant, zeroRng), true);
  // A quarter in, the click is past the stall gate, no matter what the roll says.
  const later = { moleId: 1, atMs: spawn.upAtMs + 200 };
  assert.equal(judgeMoleEarly(spawn, later, zeroRng), false);
  // Stall roll misses, no swallow even on an instant swing.
  assert.equal(judgeMoleEarly(spawn, instant, oneRng), false);
});

test("planMoleRound schedules three pops and caps the payout", () => {
  const plan = planMoleRound(zeroRng);
  assert.equal(plan.spawns.length, MOLE_POPS);
  for (let i = 1; i < plan.spawns.length; i += 1) {
    assert.ok(plan.spawns[i].upAtMs >= plan.spawns[i - 1].downAtMs + MOLE_GAP_MIN_MS, "gap respects MOLE_GAP_MIN_MS");
  }
  assert.equal(plan.maximumPayout, maximumMolePayout(1));
  assert.equal(maximumMolePayout(10), 10 * 3 * MOLE_PRIZES.golden);
  // With a frozen pad the roll reads 0 < 0.16, so every pop looks golden.
  assert.ok(plan.spawns.every((spawn) => spawn.kind === "golden"), "a frozen rng roll reads golden at 0 < rate");
});

test("settleMoleRound pays prize fractions per whacked pop, once per pop", () => {
  const spawns = [plasticSpawn(1_000, 2_000), { ...plasticSpawn(4_000, 5_000), id: 2 }, { ...plasticSpawn(7_000, 8_000), id: 3 }];
  for (const spawn of spawns) {
    const window = moleHiddenWindow(spawn);
    spawn.upAtMs = window.from; // shift window so taps land mid-core below
    spawn.downAtMs = window.from + 400;
  }
  const taps = spawns.map((spawn) => ({ moleId: spawn.id, atMs: spawn.upAtMs + 200 }));
  const stake = 20;
  const settlement = settleMoleRound(spawns, taps, stake, zeroRng);
  assert.equal(settlement.whacks, 3);
  assert.equal(settlement.returned, round2(3 * MOLE_PRIZES.mole * stake));
  // Double taps: only the first tap per pop is scored.
  const spammed = settleMoleRound(spawns, [...taps, ...taps], stake, zeroRng);
  assert.equal(spammed.returned, settlement.returned);
  assert.equal(spammed.whacks, 3);
  // Stakes scale in and the house keeps the rest.
  assert.ok(settlement.returned < stake, "three lucky whacks must still sit under the stake at these prizes");
});

test("settleMoleRound scores stings and escapes as losses", () => {
  const spawns = [plasticSpawn(1_000, 2_000), { ...plasticSpawn(4_000, 5_000), id: 2 }, { ...plasticSpawn(7_000, 8_000), id: 3 }];
  const [a, b, c] = spawns;
  const wa = moleHiddenWindow(a);
  const wb = moleHiddenWindow(b);
  const wc = moleHiddenWindow(c);
  const whack = { moleId: a.id, atMs: (wa.from + wa.to) / 2 - 90 };
  // +100 undoes the frozen pad reading the landing 100ms early.
  const sting = { moleId: b.id, atMs: wb.to + 40 - 90 + 100 };
  const escape = { moleId: 99, atMs: wc.from + 100 };
  const settlement = settleMoleRound(spawns, [whack, sting, escape], 10, zeroRng);
  assert.equal(settlement.whacks, 1);
  assert.equal(settlement.stings, 1);
  assert.equal(settlement.escapes, 1, "only the unjudged pop escapes; a wrong moleId tap touches nothing");
  assert.equal(settlement.returned, round2(MOLE_PRIZES.mole * 10));
});

test("hoops sensor rejects the painted edge and the dice gate swishes", () => {
  // The sensor's frozen read (rng 0) pulls offsets 0.07 low, and the LED
  // credits a swish on anything under the rate.
  const deadCentre = judgeHoopsShot(0, zeroRng);
  assert.equal(deadCentre.made, true);
  assert.equal(deadCentre.swish, true, "a passing roll credits the swish LED");
  assert.equal(judgeHoopsShot(0, oneRng).swish, false, "a missed roll keeps the credit");
  // Just inside the painted rim but outside the sensor circle: rattle out.
  const edge = judgeHoopsShot(0.96, oneRng);
  assert.equal(edge.made, false);
  assert.equal(edge.prize, 0);
  // Inside the sensor but nothing more.
  const make = judgeHoopsShot(0.5, oneRng);
  assert.equal(make.made, true);
  assert.equal(make.swish, false);
  assert.equal(make.prize, HOOPS_BASKET_PRIZE);
});

test("hoops boundary honours the hidden margin", () => {
  const limit = 1 - HOOPS_SENSOR_MARGIN;
  assert.equal(judgeHoopsShot(limit, halfRng).made, true);
  assert.equal(judgeHoopsShot(limit + 0.001, halfRng).made, false);
});

test("settleHoopsRound pays prize fractions and caps the round", () => {
  const releases = Array.from({ length: HOOPS_BALLS }, () => ({ offset: 0.05 }));
  // rng 0 pulls the read 0.07 low (sensed ≈ -0.02, inside the swish ring) and
  // passes every LED roll.
  const generous = settleHoopsRound(releases, 10, zeroRng);
  assert.equal(generous.makes, HOOPS_BALLS);
  assert.equal(generous.swishes, HOOPS_BALLS);
  assert.equal(generous.returned, round2(HOOPS_BALLS * HOOPS_SWISH_PRIZE * 10));
  // rng 1 pushes readings 0.07 high and misses every LED roll.
  const stingy = settleHoopsRound(releases, 10, oneRng);
  assert.equal(stingy.makes, HOOPS_BALLS);
  assert.equal(stingy.swishes, 0);
  assert.equal(stingy.returned, round2(HOOPS_BALLS * HOOPS_BASKET_PRIZE * 10));
  const stake = 100;
  assert.ok(settleHoopsRound(releases, stake, zeroRng).returned <= maximumHoopsPayout(stake));
  assert.equal(maximumHoopsPayout(stake), stake * HOOPS_BALLS * HOOPS_SWISH_PRIZE);
});

test("releaseOffsetFromTap maps rim distance to the honest painted scale", () => {
  assert.equal(releaseOffsetFromTap(3, 4, 0, 0, 5), 1);
  assert.equal(releaseOffsetFromTap(1.5, 2, 0, 0, 5), 0.5);
  assert.equal(releaseOffsetFromTap(10, 0, 0, 0, 5), 1, "far taps clamp at the painted edge");
});

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
