// Pure coin-pusher simulation: no DOM, so it can be Monte-Carlo tested in Node.
// A bed of 7 lanes x 8 rows sits on a shelf; every dropped coin shoves the shelf
// one coin-width toward the front. Coins shoved off the front of a middle lane
// tumble into the payout tray; the two outer lanes drain off the sides and lose
// whatever falls down them. Gold tokens are worth five 2p coins.

export const COIN_VALUE_PENCE = 2;
export const GOLD_VALUE_PENCE = 10;
export const LANE_COUNT = 7;
export const LANE_CAPACITY = 8;
export const GOLD_DENSITY = 0.06;
export const TEETER_CHANCE = 0.06;
export const TEETER_MAX_EXTRA = 3;
export const INJECT_INTERVAL = 15;
export const MIN_DROPS = 1;
export const MAX_DROPS = 25;

export type CoinKind = "coin" | "gold";
export type BedCoin = { id: number; kind: CoinKind };
export type Bed = BedCoin[][];

export type FallenCoin = { id: number; kind: CoinKind; lane: number; won: boolean; valuePence: number };

export type DropStep = {
  lane: number;
  injected: boolean;
  fell: FallenCoin[];
  bed: Bed;
};

export type PusherSession = {
  steps: DropStep[];
  winPence: number;
};

let nextCoinId = 1;

export function createBed(rng: () => number): Bed {
  const bed: Bed = [];
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const stack: BedCoin[] = [];
    for (let row = 0; row < LANE_CAPACITY; row++) {
      stack.push({ id: nextCoinId++, kind: rng() < GOLD_DENSITY ? "gold" : "coin" });
    }
    bed.push(stack);
  }
  return bed;
}

function laneWins(lane: number) {
  return lane > 0 && lane < LANE_COUNT - 1;
}

function coinValuePence(kind: CoinKind) {
  return kind === "gold" ? GOLD_VALUE_PENCE : COIN_VALUE_PENCE;
}

function pushIntoLane(bed: Bed, lane: number, kind: CoinKind, rng: () => number, injected: boolean): DropStep {
  const stack = bed[lane];
  const fell: FallenCoin[] = [];
  if (stack.length >= LANE_CAPACITY) {
    const front = stack.shift();
    if (front) {
      fell.push({ id: front.id, kind: front.kind, lane, won: laneWins(lane), valuePence: coinValuePence(front.kind) });
    }
    while (fell.length < 1 + TEETER_MAX_EXTRA && stack.length > 0 && rng() < TEETER_CHANCE) {
      const next = stack.shift();
      if (!next) break;
      fell.push({ id: next.id, kind: next.kind, lane, won: laneWins(lane), valuePence: coinValuePence(next.kind) });
    }
  }
  stack.push({ id: nextCoinId++, kind });
  return { lane, injected, fell, bed: bed.map((l) => l.map((c) => ({ ...c }))) };
}

// Plays `drops` paid coins onto a copy of the bed. Every INJECT_INTERVAL drops
// the attendant feeds a free gold token in, which shoves the shelf like any
// other coin — anything it dislodges into the tray is the player's.
export function simulateSession(startingBed: Bed, drops: number, rng: () => number): PusherSession {
  const bed: Bed = startingBed.map((l) => l.map((c) => ({ ...c })));
  const steps: DropStep[] = [];
  let winPence = 0;
  let sinceInject = 0;
  const creditFalls = (step: DropStep) => {
    for (const f of step.fell) {
      if (f.won) winPence += f.valuePence;
    }
  };
  for (let i = 0; i < drops; i++) {
    const step = pushIntoLane(bed, Math.floor(rng() * LANE_COUNT), "coin", rng, false);
    steps.push(step);
    creditFalls(step);
    sinceInject++;
    if (sinceInject >= INJECT_INTERVAL) {
      sinceInject = 0;
      const injected = pushIntoLane(bed, Math.floor(rng() * LANE_COUNT), "gold", rng, true);
      steps.push(injected);
      creditFalls(injected);
    }
  }
  return { steps, winPence };
}

// Worst case a single drop event can dislodge 1 + TEETER_MAX_EXTRA gold tokens,
// and injections add extra events, so the true ceiling is slightly above
// drops x (1 + TEETER_MAX_EXTRA) x GOLD_VALUE_PENCE.
export function maximumWinPence(drops: number) {
  const events = drops + Math.floor(drops / INJECT_INTERVAL);
  return events * (1 + TEETER_MAX_EXTRA) * GOLD_VALUE_PENCE;
}

export function browserRng(): number {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return Math.random();
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}