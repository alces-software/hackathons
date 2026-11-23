// Monte Carlo for the arcade cabinets. The rigging knobs are the dodge/sting
// trims (mole) and the sensor margin (hoop); measured RTP is printed so
// future tuning can land wherever the machine designer wants it.

import {
  HOOPS_BASKET_PRIZE,
  HOOPS_BALLS,
  HOOPS_MAX_BET,
  HOOPS_SENSOR_MARGIN,
  HOOPS_SENSOR_NOISE,
  HOOPS_SWISH_OFFSET,
  HOOPS_SWISH_PRIZE,
  MOLE_DODGE_FRACTION,
  MOLE_GOLDEN_RATE,
  MOLE_GOLDEN_STING_MS,
  MOLE_MAX_BET,
  MOLE_POPS,
  MOLE_STING_FRACTION,
  MOLE_SWING_DELAY_MS,
  browserRng,
  maximumHoopsPayout,
  maximumMolePayout,
  planMoleRound,
  round2,
  settleHoopsRound,
  settleMoleRound,
} from "../lib/arcade.ts";

const TRIALS = 30_000;

function fmtPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function simulateMoleTrials(tapFraction: number, label: string) {
  let staked = 0;
  let returned = 0;
  let best = -Infinity;
  let worst = Infinity;
  let whacks = 0;
  let stings = 0;
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const stake = 10 + (trial % 5) * 5;
    const plan = planMoleRound(browserRng);
    const taps = plan.spawns.map((spawn) => ({
      moleId: spawn.id,
      atMs: spawn.upAtMs + (spawn.downAtMs - spawn.upAtMs) * tapFraction,
    }));
    const settlement = settleMoleRound(plan.spawns, taps, stake);
    staked += stake;
    returned += settlement.returned;
    whacks += settlement.whacks;
    stings += settlement.stings;
    const net = settlement.returned - stake;
    if (net > best) best = net;
    if (net < worst) worst = net;
  }
  const rtp = returned / staked;
  console.log(
    `mole   dodge=${MOLE_DODGE_FRACTION} sting=${MOLE_STING_FRACTION} golden=+${MOLE_GOLDEN_STING_MS}ms goldenRate=${MOLE_GOLDEN_RATE} player@${tapFraction.toFixed(2)} (${label})  RTP=${fmtPct(rtp)}  whacks=${(whacks / TRIALS).toFixed(2)}/round stings=${(stings / TRIALS).toFixed(2)}  best=+${round2(best)} worst=${round2(worst)} maxPayout@10=${maximumMolePayout(10)}`,
  );
}

function simulateHoopsTrials(aimMean: number, aimScatter: number, label: string) {
  let staked = 0;
  let returned = 0;
  let makes = 0;
  let swishes = 0;
  let shots = 0;
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const stake = 5 + (trial % 6) * 5;
    const releases = Array.from({ length: HOOPS_BALLS }, () => ({
      // A player aims at ~aimMean from centre; misses scatter with roughly
      // gaussian error, clipped to the painted rim.
      offset: Math.min(1, Math.max(0, aimMean + Math.abs(browserRng() + browserRng() - 1) * aimScatter)),
    }));
    const settlement = settleHoopsRound(releases, stake, browserRng);
    shots += releases.length;
    makes += settlement.makes;
    swishes += settlement.swishes;
    staked += stake;
    returned += settlement.returned;
  }
  const rtp = returned / staked;
  console.log(
    `hoops  margin=${HOOPS_SENSOR_MARGIN} noise=${HOOPS_SENSOR_NOISE} swish<=${HOOPS_SWISH_OFFSET} aim=${aimMean.toFixed(2)}+/-${aimScatter} (${label})  RTP=${fmtPct(rtp)}  makeRate=${fmtPct(makes / shots)} swishShare=${fmtPct(swishes / Math.max(makes, 1))} maxPayout@10=${maximumHoopsPayout(10)}`,
  );
}

console.log(`mallet lands ${MOLE_SWING_DELAY_MS}ms after the tap; ${MOLE_POPS} pops/round, top bet ${MOLE_MAX_BET}; hoops ${HOOPS_BALLS} balls, swish prize ${HOOPS_SWISH_PRIZE}x, basket ${HOOPS_BASKET_PRIZE}x, top bet ${HOOPS_MAX_BET}`);
simulateMoleTrials(0.3, "quick draw");
simulateMoleTrials(0.82, "waits for it");
simulateMoleTrials(0.5, "middle of the window");
simulateHoopsTrials(0.05, 0.35, "casual: aims centre, sprays");
simulateHoopsTrials(0.02, 0.12, "steady: aims centre, tight");
simulateHoopsTrials(0.12, 0.3, "showoff: aims near-rim");
