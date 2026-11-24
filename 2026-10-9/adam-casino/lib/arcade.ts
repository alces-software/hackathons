// Pure arcade-cabinet simulations: no DOM here, so the maths that decides
// whether you win can be Monte-Carlo tested in Node like lib/coinPusher.ts.
// The cabinets pay like real redemption machines — the stake buys the game,
// each hit prints a small prize fraction back — and the rig hides in the
// sensors: two windows painted on each mole, a rim painted wider than the
// sensor behind it. Every miss still feels like your own fault.

// --- Shared helpers --------------------------------------------------------

export type Rng = () => number;

export function browserRng(): number {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return Math.random();
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// --- Whack-a-mole ----------------------------------------------------------
// The stake buys three pops on a steady, learnable rhythm. Whack a pop and it
// prints a small prize: a quarter of your stake for the plastic moles, 1.4 of
// it for the golden moose. The mallet is plainly honest, but every window is
// scored against a hidden pair trimmed inside the visible one — the first
// instant is sensor-dead ("it wasn't quite up yet"), the tail is stung off
// ("it was already going down") and golden windows lose a little more still.
// A swing inside the trim still knocks the mole flat; the machine misses
// nothing, it just pays nothing.

export const MOLE_POPS = 3;
export const MOLE_MAX_BET = 50;
export const MOLE_PRIZES = { mole: 0.21, golden: 0.8 } as const;
export const MOLE_GOLDEN_RATE = 0.16;
export const MOLE_SWING_DELAY_MS = 90;
// Fractions of each visible window the sensor quietly ignores at either end,
// plus a fixed extra trim on golden windows.
export const MOLE_DODGE_FRACTION = 0.12;
export const MOLE_STING_FRACTION = 0.05;
export const MOLE_GOLDEN_STING_MS = 120;
// The contact pad reads the mallet's landing with this much jitter before
// scoring, then scores against its own reading — the way a tired arcade
// machine does (see judgeMoleTap).
export const MOLE_PAD_NOISE_MS = 200;
// The moles run on an old motor: occasionally a pop comes up late relative
// to its scored window, so instant swings get judged as air.
export const MOLE_STALL_RATE = 0.12;
export const MOLE_STALL_MIN_MS = 140;
export const MOLE_STALL_MAX_MS = 420;
export const MOLE_MIN_UP_MS = 460;
export const MOLE_MAX_UP_MS = 1_150;
export const MOLE_GAP_MIN_MS = 350;
export const MOLE_GAP_MAX_MS = 900;

export type MoleKind = "mole" | "golden";

export type MoleSpawn = {
  id: number;
  kind: MoleKind;
  hole: number;
  upAtMs: number;
  downAtMs: number;
};

export type MoleTap = { moleId: number; atMs: number };

export type MoleAward = { moleId: number; kind: MoleKind; prize: number };

export type MoleSettlement = {
  awards: MoleAward[];
  taps: number;
  whacks: number;
  stings: number;
  escapes: number;
  returned: number;
};

export type MolePlan = { spawns: MoleSpawn[]; maximumPayout: number };

// The visible window is honest, but the cabinet scores only inside this
// slice. Players who swing instantly meet the dead zone, players who wait
// for the mole to look settled meet the sting, and golden windows punish
// both ends a touch harder — whichever way you like to time it, part of your
// coverage is quietly gone.
export function moleHiddenWindow(spawn: MoleSpawn) {
  const upTime = spawn.downAtMs - spawn.upAtMs;
  const dodge = spawn.upAtMs + Math.max(60, upTime * MOLE_DODGE_FRACTION);
  const stingTrim = Math.max(50, upTime * MOLE_STING_FRACTION) + (spawn.kind === "golden" ? MOLE_GOLDEN_STING_MS : 0);
  return { from: dodge, to: spawn.downAtMs - stingTrim };
}

export function judgeMoleTap(spawn: MoleSpawn, tap: MoleTap, rng: Rng = browserRng): "whack" | "sting" | "air" {
  // Swing timing is judged when the mallet lands, not when the player clicks.
  const landsAt = tap.atMs + MOLE_SWING_DELAY_MS;
  // The contact pad is noisier than the window it scores against: it reads
  // the mallet's landing a little later than it really did, then scores
  // against its own reading. A real machine would do the same.
  const landedAt = landsAt + (rng() - 0.5) * MOLE_PAD_NOISE_MS;
  const window = moleHiddenWindow(spawn);
  if (landedAt < window.from || landedAt > spawn.downAtMs) return "air";
  return landedAt <= window.to ? "whack" : "sting";
}

// The motor that raises moles is on its own timer and occasionally lags
// behind the sensor's scored window, so an instant swing can land before
// anything has visibly come up.
export function judgeMoleEarly(spawn: MoleSpawn, tap: MoleTap, rng: Rng = browserRng) {
  return rng() < MOLE_STALL_RATE && tap.atMs < spawn.upAtMs + MOLE_STALL_MIN_MS;
}

// Three pops on a slightly irregular but steady cadence. This module only
// produces the schedule; the page animates it and collects taps.
export function planMoleRound(rng: Rng = browserRng): MolePlan {
  const spawns: MoleSpawn[] = [];
  let atMs = 600;
  for (let id = 1; id <= MOLE_POPS; id += 1) {
    const upFor = MOLE_MIN_UP_MS + Math.floor(rng() * (MOLE_MAX_UP_MS - MOLE_MIN_UP_MS));
    spawns.push({
      id,
      kind: rng() < MOLE_GOLDEN_RATE ? "golden" : "mole",
      hole: Math.floor(rng() * 9),
      upAtMs: atMs,
      downAtMs: atMs + upFor,
    });
    atMs += upFor + MOLE_GAP_MIN_MS + Math.floor(rng() * (MOLE_GAP_MAX_MS - MOLE_GAP_MIN_MS));
  }
  return { spawns, maximumPayout: maximumMolePayout(1) };
}

export function maximumMolePayout(stake: number) {
  return stake * MOLE_POPS * MOLE_PRIZES.golden;
}

// Scores a round of collected taps. Each pop is claimed by whichever tap the
// machine judges first; a whacked pop pays its prize, a stung or air-hitting
// tap pays nothing even when the mole visibly went down.
export function settleMoleRound(spawns: MoleSpawn[], taps: MoleTap[], stake: number, rng: Rng = browserRng): MoleSettlement {
  const byId = new Map<number, MoleSpawn>();
  for (const spawn of spawns) byId.set(spawn.id, spawn);
  const judged = new Set<number>();
  const awards: MoleAward[] = [];
  let whacks = 0;
  let stings = 0;
  let air = 0;
  let escapes = 0;
  for (const tap of [...taps].sort((a, b) => a.atMs - b.atMs)) {
    const spawn = byId.get(tap.moleId);
    if (!spawn || judged.has(spawn.id)) continue;
    judged.add(spawn.id);
    if (judgeMoleEarly(spawn, tap, rng)) {
      air += 1;
      continue;
    }
    const verdict = judgeMoleTap(spawn, tap, rng);
    if (verdict === "whack") {
      awards.push({ moleId: spawn.id, kind: spawn.kind, prize: round2(MOLE_PRIZES[spawn.kind] * stake) });
      whacks += 1;
    } else if (verdict === "sting") {
      stings += 1;
    } else {
      air += 1;
    }
  }
  escapes = spawns.length - judged.size;
  const returned = awards.reduce((sum, award) => sum + award.prize, 0);
  return { awards, taps: taps.length, whacks, stings, escapes, returned: round2(returned) };
}

// --- Basketball ------------------------------------------------------------
// The stake buys five balls and 30 seconds at one hoop. Every basket prints a
// small prize fraction of the stake; a swish prints five times that. The rig
// hides in the hoop sensor: the painted rim is a touch wider than the sensor
// circle behind it, so releases right at the painted edge — the shots a human
// counts as in — read as rattled-out near-misses. The ball's flight is
// plainly honest.

export const HOOPS_ROUND_MS = 30_000;
export const HOOPS_BALLS = 5;
export const HOOPS_MAX_BET = 100;
export const HOOPS_BASKET_PRIZE = 0.16;
export const HOOPS_SWISH_PRIZE = 0.35;
// The sensor ring sits this far inside the painted rim. Taps on the painted
// edge (offset ≈ 1.0) sit above the ring, so the outer sliver of the painted
// rim still rattles out — the house edge lives in that sliver and in the
// swish LED's rate gate, not in unreachable geometry.
export const HOOPS_SENSOR_MARGIN = 0.06;
// A release reads as a swish when its offset lands inside this ring — the
// sensor reads the release through noise before scoring (see judgeHoopsShot).
// The swish band now covers the reachable middle of the hoop mouth: with
// ±HOOPS_SENSOR_NOISE/2 scatter, any release at or under this offset whose
// favourable tail clears the band credits the swish LED (rate-gated).
export const HOOPS_SWISH_OFFSET = 0.45;
export const HOOPS_SENSOR_NOISE = 0.14;
// The swish LED only occasionally credits the cleanest shot the sensor saw;
// the machine keeps the rest as a bonus credit.
export const HOOPS_SWISH_RATE = 0.15;

export type HoopsShot = { offset: number; made: boolean; swish: boolean; prize: number };

export type HoopsSettlement = {
  shots: HoopsShot[];
  makes: number;
  swishes: number;
  returned: number;
};

// `offset` is the release's distance from hoop centre as a fraction of the
// painted rim: 0 is dead centre, 1 is the painted edge itself. The visible
// rim accepts everything at or below 1; the sensor only accepts at or below
// 1 - HOOPS_SENSOR_MARGIN.
export function judgeHoopsShot(offset: number, rng: Rng = browserRng): HoopsShot {
  // The machine's release sensor is noisy: it reads a release's offset with
  // scatter before scoring, then trusts its own calibrated reading over
  // whatever the ball actually did. Same trick the mole sensor plays.
  const jitter = (rng() - 0.5) * HOOPS_SENSOR_NOISE;
  const sensed = offset + jitter;
  const made = sensed <= 1 - HOOPS_SENSOR_MARGIN;
  const swish = made && sensed <= HOOPS_SWISH_OFFSET && rng() < HOOPS_SWISH_RATE;
  const prize = swish ? HOOPS_SWISH_PRIZE : made ? HOOPS_BASKET_PRIZE : 0;
  return { offset, made, swish, prize };
}

export function maximumHoopsPayout(stake: number) {
  return stake * HOOPS_BALLS * HOOPS_SWISH_PRIZE;
}

export function settleHoopsRound(releases: { offset: number }[], stake: number, rng: Rng = browserRng): HoopsSettlement {
  const shots = releases.map((release) => judgeHoopsShot(release.offset, rng));
  const makes = shots.filter((shot) => shot.made).length;
  const swishes = shots.filter((shot) => shot.swish).length;
  const returned = shots.reduce((sum, shot) => sum + shot.prize, 0);
  return { shots, makes, swishes, returned: round2(returned * stake) };
}

// The page derives a release offset from the tap position against the painted
// rim while the aim drifts — honest physics, quietly strict sensor.
export function releaseOffsetFromTap(
  tapX: number,
  tapY: number,
  rimX: number,
  rimY: number,
  rimRadius: number,
) {
  const distance = Math.hypot(tapX - rimX, tapY - rimY);
  return Math.min(1, distance / rimRadius);
}
