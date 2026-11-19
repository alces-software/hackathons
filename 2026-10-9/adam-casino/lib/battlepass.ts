import {
  findCosmetic,
  permanentPriceCosmetic,
  slotForKind,
  type CosmeticSlot,
} from "./cosmeticsCatalog.ts";
import { grantCosmetic } from "./cosmetics.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/* ---------- Alces Pass: XP ladder, tracks and rewards (server-side store) ---------- */

/**
 * The Alces Pass is a free + premium two-track ladder over "season XP". XP is earned from
 * settled bets (every moose buck staked earns one XP — see app/api/banking/transfer/route.ts),
 * so the pass pays players back for playing without changing any game odds.
 *
 * State lives server-side in .data/battlepass.json (env override BATTLEPASS_FILE for tests),
 * so a cookie wipe or browser refresh never loses progress or claimed rewards.
 */

// Client-safe copies of the pass constants live in ./battlepassConstants.ts (no node:fs here so
// the pass page can import them); re-export from there to keep one source of truth.
import {
  BATTLEPASS_LEVELS,
  XpPerLevel,
  XP_PER_BUCK,
  PREMIUM_PRICE,
  PREMIUM_LEVEL,
} from "./battlepassConstants.ts";

// Re-export so existing server imports of these constants keep resolving through this module.
export {
  BATTLEPASS_LEVELS,
  XpPerLevel,
  XP_PER_BUCK,
  PREMIUM_PRICE,
  PREMIUM_LEVEL,
};

/** Cumulative XP needed to START each level: levelThresholds[0] = 0 (level 1) … [LEVELS-1] = max. */
const LEVEL_THRESHOLDS: number[] = (() => {
  const thresholds = [0];
  for (let level = 1; level < BATTLEPASS_LEVELS; level += 1) thresholds.push(thresholds[level - 1] + XpPerLevel(level));
  return thresholds;
})();
const MAX_XP = LEVEL_THRESHOLDS[BATTLEPASS_LEVELS - 1];

// Test/inspection hook: cumulative thresholds per level (XP needed to START each level).
export const LEVEL_THRESHOLDS_FOR_TESTS = LEVEL_THRESHOLDS;

/** Level for a total-XP value: the last level whose threshold the XP has reached. */
const levelForXp = (xp: number): number => {
  let level = 1;
  while (level < BATTLEPASS_LEVELS && xp >= LEVEL_THRESHOLDS[level]) level += 1;
  return level;
};

export type RewardSpec = { mooseBucks?: number; cosmeticId?: string };
export type PassSetId = "voyager" | "lord-nelson";
export type PremiumSetReward = { set: PassSetId };
export type TrackReward = { level: number; free: RewardSpec; premium: PremiumSetReward | RewardSpec | null };

export const NELSON_BADGE = "lord-nelson-badge";
export const NELSON_TITLE = "lord-nelson-title";
export const NELSON_SKINS = ["lord-nelson-card-skin", "lord-nelson-dice", "lord-nelson-wheel", "lord-nelson-table"] as const;
/** Every cosmetic the Lord Nelson set grants (badge + title + one skin per cosmetic slot). */
export const NELSON_SET_ITEMS = [NELSON_BADGE, NELSON_TITLE, ...NELSON_SKINS] as const;

/** Level-1 premium starter set: a matching badge and title, granted from the moment the pass is bought. */
export const VOYAGER_BADGE = "voyager-badge";
export const VOYAGER_TITLE = "voyager-title";
export const VOYAGER_SET_ITEMS = [VOYAGER_BADGE, VOYAGER_TITLE] as const;

/** Pass set registry: label shown on the pass page, blurb for the preview, and the level that grants the set. */
const PREMIUM_SETS: Record<PassSetId, { label: string; blurb: string; level: number }> = {
  voyager: { label: "The Voyager set", blurb: "The starter set — a matching badge and title to open the premium track with.", level: 1 },
  "lord-nelson": { label: "The Lord Nelson set", blurb: "The badge, the title, and a skin for every game with cosmetics.", level: PREMIUM_LEVEL },
};
/** Cosmetics granted by each pass set (each entry covers its own cosmetic slot). */
const SET_ITEMS: Record<PassSetId, readonly string[]> = {
  voyager: VOYAGER_SET_ITEMS,
  "lord-nelson": NELSON_SET_ITEMS,
};

/** Refuses unknown sets so a typo can never resolve to a silently empty reward. */
export function premiumSetReward(setId: PassSetId): PremiumSetReward {
  if (!PREMIUM_SETS[setId]) throw new Error(`Unknown Alces Pass set: ${setId}`);
  return { set: setId };
}

/** Free-track cosmetics: all pass-exclusive, never on the premium ladder. 34/39 are late free-exclusives that pad the ladder. */
const FREE_COSMETIC_LEVELS: Record<number, string> = {
  5: "pinecone-charm",
  10: "lucky-antlers",
  15: "campfire-rookie",
  20: "maple-pips",
  25: "aurora-royale-wheel",
  30: "timberline-felt",
  34: "north-passage-title",
  39: "alces-deck",
};
/** Free-track reward at one level; moose-buck payouts credit via the banking service. */
const freeRewardForLevel = (level: number): RewardSpec =>
  level === 1 ? { mooseBucks: 50 }
  : FREE_COSMETIC_LEVELS[level] ? { cosmeticId: FREE_COSMETIC_LEVELS[level] }
  : level % 10 === 0 ? { mooseBucks: 200 }
  : level % 4 === 0 ? { mooseBucks: 75 }
  : { mooseBucks: 25 };

/** Pass-exclusive cosmetic granted on the premium track at each level (all live outside the gift shop, never on the free track). */
const PREMIUM_COSMETIC_LEVELS: Record<number, string> = {
  4: "snowflake-charm",
  7: "howling-wolf",
  10: "truenorth-title",
  15: "northwind-deck",
  20: "aurora-king-dice",
  25: "maple-frost-wheels",
  30: "moose-crest-felt",
  32: "sugar-shack-deck",
  35: "trapper-cap",
  39: "beaverwork-badge",
};

/** Premium-track reward on every level: sets at 1 and 40, pass-exclusive cosmetics at key levels, moose bucks elsewhere. */
const premiumRewardForLevel = (level: number): PremiumSetReward | RewardSpec => {
  if (level === PREMIUM_LEVEL) return premiumSetReward("lord-nelson");
  if (level === 1) return premiumSetReward("voyager");
  const cosmetic = PREMIUM_COSMETIC_LEVELS[level];
  return cosmetic ? { cosmeticId: cosmetic } : { mooseBucks: 40 };
};

/** Flat ladder: a free and a premium reward on every level, premium from level 1 upward. */
export function passRewardForLevel(level: number): TrackReward {
  return { level, free: freeRewardForLevel(level), premium: premiumRewardForLevel(level) };
}

/* ---------- Store (mirrors lib/cosmetics.ts file persistence) ---------- */

export type BattlePassState = {
  xp: number;
  claimedFree: number[];
  claimedPremium: number[];
  premiumUnlockedAt: number | null;
};

export type SetItemView = { cosmeticId: string; name: string; icon: string; slot: CosmeticSlot; passExclusive: true };
export type RewardView =
  | { kind: "moose-bucks"; amount: number }
  | { kind: "cosmetic"; cosmeticId: string; name: string; icon: string; slot: CosmeticSlot; passExclusive: boolean }
  | { kind: "premium-set"; setId: PassSetId; label: string; blurb: string; items: SetItemView[] };

export type PassLevelView = {
  level: number;
  reached: boolean;
  free: RewardView;
  premium: RewardView | null;
  freeClaimed: boolean;
  premiumClaimed: boolean;
};

export type BattlePassView = {
  username: string;
  xp: number;
  level: number;
  levelsTotal: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  premiumUnlocked: boolean;
  premiumPrice: number;
  claimedFree: number[];
  claimedPremium: number[];
  tracks: PassLevelView[];
};

const battlePasses = new Map<string, BattlePassState>();
const battlePassFile = process.env.BATTLEPASS_FILE ?? join(process.cwd(), ".data/battlepass.json");
let battlePassLoaded = false;

function loadBattlePasses() {
  if (battlePassLoaded) return;
  battlePassLoaded = true;
  if (!existsSync(/* turbopackIgnore: true */ battlePassFile)) return;
  try {
    const saved = JSON.parse(readFileSync(/* turbopackIgnore: true */ battlePassFile, "utf8")) as Record<string, BattlePassState>;
    Object.entries(saved).forEach(([username, state]) => {
      battlePasses.set(username, {
        xp: Math.max(0, Math.round(state.xp ?? 0)),
        claimedFree: Array.isArray(state.claimedFree) ? state.claimedFree.filter(Number.isInteger) : [],
        claimedPremium: Array.isArray(state.claimedPremium) ? state.claimedPremium.filter(Number.isInteger) : [],
        premiumUnlockedAt: typeof state.premiumUnlockedAt === "number" ? state.premiumUnlockedAt : null,
      });
    });
  } catch {
    /* ignore corrupt runtime state */
  }
}

function saveBattlePasses() {
  mkdirSync(dirname(battlePassFile), { recursive: true });
  writeFileSync(battlePassFile, JSON.stringify(Object.fromEntries(battlePasses)), "utf8");
}

function getBattlePassState(username: string): BattlePassState {
  loadBattlePasses();
  const state = battlePasses.get(username);
  if (state) return state;
  const fresh: BattlePassState = { xp: 0, claimedFree: [], claimedPremium: [], premiumUnlockedAt: null };
  battlePasses.set(username, fresh);
  return fresh;
}

/** Test-only: clears the in-memory pass store between test cases. */
export function resetBattlePassForTests() {
  battlePasses.clear();
  battlePassLoaded = false;
}

/** Test-only: flags a pass as premium-purchased without going through the banking service. */
export function unlockPremiumForTests(username: string) {
  const state = getBattlePassState(username);
  if (state.premiumUnlockedAt === null) state.premiumUnlockedAt = Date.now();
  saveBattlePasses();
}

/* ---------- XP ---------- */

/** Caps runaway per-settlement grants without clipping normal play (tables cap near 500/bet). */
const MAX_XP_PER_SETTLEMENT = 2_000;

/**
 * Awards XP for a settled game bet. Called from the banking transfer route after the banking
 * service settles; every full moose buck staked earns XP_PER_BUCK XP.
 */
export function awardBattlePassXp(username: string, amount: number) {
  const xp = Math.floor(Math.max(0, amount) * XP_PER_BUCK);
  if (xp <= 0 || !username) return;
  loadBattlePasses();
  const state = getBattlePassState(username);
  state.xp = Math.min(MAX_XP, state.xp + Math.min(xp, MAX_XP_PER_SETTLEMENT));
  battlePasses.set(username, state);
  saveBattlePasses();
}

/* ---------- Reward resolution ---------- */

function resolveReward(spec: RewardSpec | PremiumSetReward | null): RewardView | null {
  if (!spec) return null;
  if ("set" in spec) {
    const set = PREMIUM_SETS[spec.set];
    if (!set) return null;
    const items = SET_ITEMS[spec.set].flatMap((id): SetItemView[] => {
      const item = findCosmetic(id);
      return item ? [{ cosmeticId: id, name: item.name, icon: item.icon, slot: slotForKind[item.kind], passExclusive: true }] : [];
    });
    return { kind: "premium-set", setId: spec.set, label: set.label, blurb: set.blurb, items };
  }
  if (spec.cosmeticId) {
    const item = findCosmetic(spec.cosmeticId);
    if (!item) return null;
    return { kind: "cosmetic", cosmeticId: item.id, name: item.name, icon: item.icon, slot: slotForKind[item.kind], passExclusive: Boolean(item.passReward) };
  }
  if (spec.mooseBucks) return { kind: "moose-bucks", amount: spec.mooseBucks };
  return null;
}

/**
 * Full pass view for a player: ladder progress plus every level's free and premium rewards with
 * claim state. Levels run 1..BATTLEPASS_LEVELS.
 */
export function viewBattlePass(username: string): BattlePassView {
  const state = getBattlePassState(username);
  const level = levelForXp(state.xp);
  const maxXpIntoLevel = level >= BATTLEPASS_LEVELS ? XpPerLevel(level) : LEVEL_THRESHOLDS[level] - LEVEL_THRESHOLDS[level - 1];
  const tracks: PassLevelView[] = [];
  for (let lvl = 1; lvl <= BATTLEPASS_LEVELS; lvl += 1) {
    const reward = passRewardForLevel(lvl);
    tracks.push({
      level: lvl,
      reached: lvl <= level,
      free: resolveReward(reward.free)!,
      premium: resolveReward(reward.premium),
      freeClaimed: state.claimedFree.includes(lvl),
      premiumClaimed: state.claimedPremium.includes(lvl),
    });
  }
  return {
    username,
    xp: state.xp,
    level,
    levelsTotal: BATTLEPASS_LEVELS,
    xpIntoLevel: state.xp - LEVEL_THRESHOLDS[level - 1],
    xpForNextLevel: maxXpIntoLevel,
    premiumUnlocked: state.premiumUnlockedAt !== null,
    premiumPrice: PREMIUM_PRICE,
    claimedFree: state.claimedFree,
    claimedPremium: state.claimedPremium,
    tracks,
  };
}

/* ---------- Claims and premium unlock ---------- */

/**
 * Marks a level/track claimed and grants the reward. Cosmetic rewards are granted permanently
 * into the inventory via grantCosmetic (no banking debit — the pass already collected XP).
 * Moose-buck rewards are credited by the API route through the banking service; this returns
 * what the route should pay out. Throws when the claim is not valid.
 */
export function claimBattlePassReward(username: string, level: number, track: "free" | "premium"): RewardView[] {
  if (!Number.isInteger(level) || level < 1 || level > BATTLEPASS_LEVELS) throw new Error("That pass level does not exist.");
  loadBattlePasses();
  const state = getBattlePassState(username);
  const reachedLevel = levelForXp(state.xp);
  if (level > reachedLevel) throw new Error(`You unlock that level at ${LEVEL_THRESHOLDS[level - 1]} season XP.`);
  if (track === "premium") {
    if (state.premiumUnlockedAt === null) throw new Error("Buy the premium pass before claiming its rewards.");
    if (state.claimedPremium.includes(level)) throw new Error("That premium reward is already claimed.");
    state.claimedPremium = [...state.claimedPremium, level].sort((a, b) => a - b);
  } else {
    if (state.claimedFree.includes(level)) throw new Error("That free reward is already claimed.");
    state.claimedFree = [...state.claimedFree, level].sort((a, b) => a - b);
  }
  const reward = passRewardForLevel(level);
  const spec = track === "free" ? reward.free : reward.premium;
  const granted = grantReward(username, spec);
  battlePasses.set(username, state);
  saveBattlePasses();
  if (spec && granted.length === 0) throw new Error("That reward could not be granted — contact the lodge.");
  return granted;
}

/** Grants cosmetics permanently (pass rewards are never rentals). */
function grantReward(username: string, spec: RewardSpec | PremiumSetReward | null): RewardView[] {
  const view = resolveReward(spec);
  if (!view) return [];
  const grantItems = (ids: readonly string[]) => {
    for (const id of ids) {
      const item = findCosmetic(id);
      if (!item) continue;
      grantCosmetic(username, id, item.rental && item.permanentPrice == null ? item.price : permanentPriceCosmetic(item));
    }
  };
  if (view.kind === "cosmetic") grantItems([view.cosmeticId]);
  if (view.kind === "premium-set") grantItems(SET_ITEMS[view.setId]);
  return [view];
}

/**
 * Route fallback: removes a just-made claim when its moose-buck payout could not be credited
 * through the banking service, so the reward stays claimable (no free re-credits, no losses).
 */
export function revertBattlePassClaim(username: string, level: number, track: "free" | "premium") {
  loadBattlePasses();
  const state = battlePasses.get(username);
  if (!state) return;
  if (track === "premium") state.claimedPremium = state.claimedPremium.filter((entry) => entry !== level);
  else state.claimedFree = state.claimedFree.filter((entry) => entry !== level);
  battlePasses.set(username, state);
  saveBattlePasses();
}

/**
 * Unlocks the premium track for PREMIUM_PRICE moose bucks, debited through the banking service
 * (same shape as the gift shop purchase). The unlock is stored server-side and never re-charged.
 */
export async function buyPremiumBattlePass(
  username: string,
  banking: { username: string; password: string },
): Promise<BattlePassView> {
  const bankingApiUrl = process.env.BANKING_API_URL ?? "http://10.151.0.85:3000/api/v1";
  const serviceToken = process.env.BANKING_SERVICE_TOKEN;
  const casinoUsername = process.env.CASINO_USERNAME;
  if (!serviceToken || !casinoUsername) throw new Error("The Alces Pass is not configured (missing banking service token).");
  const state = getBattlePassState(username);
  if (state.premiumUnlockedAt !== null) throw new Error("Your premium pass is already unlocked.");
  const debit = await fetch(`${bankingApiUrl}/services/transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: banking.username, password: banking.password, serviceToken, amount: PREMIUM_PRICE, type: "loss" }),
  });
  if (debit.status === 401) throw new Error("Banking credentials were rejected — connect your banking account again.");
  if (!debit.ok && debit.status !== 204) throw new Error(`The banking service refused the pass purchase (HTTP ${debit.status}).`);
  state.premiumUnlockedAt = Date.now();
  battlePasses.set(username, state);
  saveBattlePasses();
  return viewBattlePass(username);
}
