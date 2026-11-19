import {
  createBed,
  simulateSession,
  browserRng,
  COIN_VALUE_PENCE,
  GOLD_VALUE_PENCE,
  LANE_COUNT,
  LANE_CAPACITY,
  GOLD_DENSITY,
  TEETER_CHANCE,
  TEETER_MAX_EXTRA,
  INJECT_INTERVAL,
} from "../lib/coinPusher";

const TRIALS = 200000;

function runTrials(drops: number) {
  let staked = 0;
  let won = 0;
  let best = 0;
  let worst = 0;
  for (let t = 0; t < TRIALS; t++) {
    const bed = createBed(browserRng);
    const session = simulateSession(bed, drops, browserRng);
    const stake = drops * COIN_VALUE_PENCE;
    staked += stake;
    won += session.winPence;
    const net = session.winPence - stake;
    if (net > best) best = net;
    if (net < worst) worst = net;
  }
  const rtp = won / staked;
  console.log(
    `drops=${String(drops).padStart(2)}  RTP=${(rtp * 100).toFixed(2)}%  avgNet=${((won - staked) / TRIALS / 100).toFixed(4)}p  best=+${(best / 100).toFixed(2)}p  worst=${(worst / 100).toFixed(2)}p`
  );
}

console.log(`lanes=${LANE_COUNT} capacity=${LANE_CAPACITY} goldDensity=${GOLD_DENSITY} teeter=${TEETER_CHANCE}+${TEETER_MAX_EXTRA} injectEvery=${INJECT_INTERVAL} gold=${GOLD_VALUE_PENCE}p coin=${COIN_VALUE_PENCE}p trials=${TRIALS}`);
for (const drops of [1, 5, 10, 25]) runTrials(drops);