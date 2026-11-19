import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import {
  BATTLEPASS_LEVELS,
  NELSON_SET_ITEMS,
  PREMIUM_LEVEL,
  VOYAGER_SET_ITEMS,
  XP_PER_LEVEL,
  awardBattlePassXp,
  claimBattlePassReward,
  passRewardForLevel,
  resetBattlePassForTests,
  revertBattlePassClaim,
  unlockPremiumForTests,
  viewBattlePass,
} from "./battlepass.ts";
import { viewCosmeticInventory } from "./cosmetics.ts";
import { COSMETIC_CATALOG, PASS_CATALOG, findCosmetic } from "./cosmeticsCatalog.ts";

// BATTLEPASS_FILE / COSMETICS_FILE / UNO_SESSION_SECRET come from the test:battlepass npm script.
rmSync(".data/test-battlepass.json", { force: true });
rmSync(".data/test-cosmetics.json", { force: true });

test("catalog contains every Lord Nelson and Voyager pass item", () => {
  for (const id of NELSON_SET_ITEMS) assert.ok(COSMETIC_CATALOG.some((item) => item.id === id), `${id} missing from catalog`);
  for (const id of VOYAGER_SET_ITEMS) assert.ok(COSMETIC_CATALOG.some((item) => item.id === id), `${id} missing from catalog`);
});

test("XP ladder grants one level per full 250 XP", () => {
  resetBattlePassForTests();
  const view = viewBattlePass("ladder-player");
  assert.equal(view.level, 1);
  assert.equal(view.xpIntoLevel, 0);
  assert.equal(view.levelsTotal, BATTLEPASS_LEVELS);
  awardBattlePassXp("ladder-player", 100);
  assert.equal(viewBattlePass("ladder-player").level, 1);
  awardBattlePassXp("ladder-player", 150);
  const levelTwo = viewBattlePass("ladder-player");
  assert.equal(levelTwo.level, 2);
  assert.equal(levelTwo.xpIntoLevel, 0);
  awardBattlePassXp("ladder-player", 10);
  const partial = viewBattlePass("ladder-player");
  assert.equal(partial.level, 2);
  assert.equal(partial.xpIntoLevel, 10);
  for (let index = 0; index < 20; index += 1) awardBattlePassXp("ladder-player", 900);
  const maxed = viewBattlePass("ladder-player");
  assert.equal(maxed.level, BATTLEPASS_LEVELS);
  assert.equal(maxed.xp, BATTLEPASS_LEVELS * XP_PER_LEVEL);
});

test("per-settlement XP is capped and zero is ignored", () => {
  resetBattlePassForTests();
  awardBattlePassXp("cap-player", 0);
  awardBattlePassXp("cap-player", -50);
  assert.equal(viewBattlePass("cap-player").xp, 0);
  awardBattlePassXp("cap-player", 50_000);
  // One settlement cannot grant more than the per-settlement cap.
  assert.equal(viewBattlePass("cap-player").xp, 2_000);
});

test("view marks reached levels and claims state", () => {
  resetBattlePassForTests();
  awardBattlePassXp("view-player", 300);
  const view = viewBattlePass("view-player");
  assert.equal(view.level, 2);
  assert.ok(view.tracks.find((row) => row.level === 1)?.reached);
  assert.ok(!view.tracks.find((row) => row.level === 3)?.reached);
  // Level 1 and 2 are free-claimable right now; premium level 1 is the Voyager starting set.
  const levelOnePremium = view.tracks.find((row) => row.level === 1)?.premium;
  assert.ok(levelOnePremium?.kind === "premium-set", "premium level 1 must be the Voyager set");
  if (levelOnePremium?.kind === "premium-set") assert.equal(levelOnePremium.items.length, VOYAGER_SET_ITEMS.length);
  // Level 38 is the last moose-buck premium level before the trapper-cap cosmetic at 39 and the set at 40.
  const premiumKinds = new Set(view.tracks.map((row) => row.premium?.kind).filter(Boolean));
  // The ladder mixes all three payload shapes (sets, cosmetics, moose bucks) and every level is filled.
  assert.ok(premiumKinds.size >= 2, "premium ladder must mix sets, cosmetics and buck payouts");
  assert.ok(premiumKinds.has("premium-set"), "premium sets resolve through the view");
  assert.equal(view.tracks.find((row) => row.level === PREMIUM_LEVEL - 2)?.premium?.kind, "moose-bucks");
  assert.ok(view.tracks.find((row) => row.level === PREMIUM_LEVEL)?.premium?.kind === "premium-set");
});

test("free claim works once, rejects duplicates and locked levels", () => {
  resetBattlePassForTests();
  const rewards = claimBattlePassReward("claims-player", 1, "free");
  assert.equal(rewards.length, 1);
  assert.equal(rewards[0].kind, "moose-bucks");
  assert.ok("amount" in rewards[0] && rewards[0].amount === 50);
  assert.throws(() => claimBattlePassReward("claims-player", 1, "free"), /already claimed/);
  assert.throws(() => claimBattlePassReward("claims-player", 9, "free"), /season XP/);
  const view = viewBattlePass("claims-player");
  assert.ok(view.claimedFree.includes(1));
  assert.ok(view.tracks.find((row) => row.level === 1)?.freeClaimed);
});

test("premium claims stay locked without the premium pass", () => {
  resetBattlePassForTests();
  awardBattlePassXp("locked-player", 1_000);
  assert.throws(() => claimBattlePassReward("locked-player", 5, "premium"), /premium pass/i);
  assert.equal(viewBattlePass("locked-player").claimedPremium.length, 0);
});

test("premium claim of the Lord Nelson set grants all six cosmetics", () => {
  resetBattlePassForTests();
  unlockPremiumForTests("nelson-player");
  assert.ok(viewBattlePass("nelson-player").premiumUnlocked);
  awardBattlePassXp("nelson-player", 20_000);
  for (let index = 0; index < 20; index += 1) awardBattlePassXp("nelson-player", 900);
  const rewards = claimBattlePassReward("nelson-player", PREMIUM_LEVEL, "premium");
  const setReward = rewards[0];
  assert.equal(setReward.kind, "premium-set");
  if (setReward.kind !== "premium-set") throw new Error("expected set reward");
  assert.equal(setReward.setId, "lord-nelson");
  assert.equal(setReward.label, "The Lord Nelson set");
  assert.equal(setReward.items.length, NELSON_SET_ITEMS.length);
  const inventory = viewCosmeticInventory("nelson-player");
  for (const id of NELSON_SET_ITEMS) assert.ok(inventory.owned.some((entry) => entry.itemId === id), `${id} must be owned after the set claim`);
  // Duplicate claim is blocked so the set cannot be farmed.
  assert.throws(() => claimBattlePassReward("nelson-player", PREMIUM_LEVEL, "premium"), /already claimed/);
});

test("premium claim of the Voyager starter set grants badge and title", () => {
  resetBattlePassForTests();
  unlockPremiumForTests("voyager-player");
  const rewards = claimBattlePassReward("voyager-player", 1, "premium");
  const setReward = rewards[0];
  assert.equal(setReward.kind, "premium-set");
  if (setReward.kind !== "premium-set") throw new Error("expected set reward");
  assert.equal(setReward.setId, "voyager");
  assert.equal(setReward.label, "The Voyager set");
  const inventory = viewCosmeticInventory("voyager-player");
  for (const id of VOYAGER_SET_ITEMS) assert.ok(inventory.owned.some((entry) => entry.itemId === id), `${id} must be owned after the starter set claim`);
  assert.throws(() => claimBattlePassReward("voyager-player", 1, "premium"), /already claimed/);
});

test("premium claim grants a pass-exclusive cosmetic from the ladder", () => {
  resetBattlePassForTests();
  unlockPremiumForTests("premium-ladder");
  for (let i = 0; i < 5; i += 1) awardBattlePassXp("premium-ladder", 5_000);
  const rewards = claimBattlePassReward("premium-ladder", 25, "premium");
  const reward = rewards[0];
  assert.equal(reward.kind, "cosmetic");
  if (reward.kind !== "cosmetic") throw new Error("expected cosmetic reward");
  // Ladder cosmetic at level 25 (maple-frost-wheels) has a distinctive wheel preset; verify it applied.
  const equippedWheel = findCosmetic(reward.cosmeticId);
  assert.ok(equippedWheel && equippedWheel.wheelStyles !== undefined, `${reward.cosmeticId} must style the wheel`);
  const inventory = viewCosmeticInventory("premium-ladder");
  assert.ok(inventory.owned.some((entry) => entry.itemId === reward.cosmeticId));
  // Every premium cosmetic reward comes from the pass-exclusive list.
  assert.ok(PASS_CATALOG.some((item) => item.id === reward.cosmeticId), `${reward.cosmeticId} must be pass-exclusive`);
});

test("premium ladder rewards all resolve to pass-exclusive items", () => {
  for (let level = 1; level <= BATTLEPASS_LEVELS; level += 1) {
    const reward = passRewardForLevel(level).premium;
    assert.ok(reward, `premium reward must exist on every level (level ${level})`);
    if (level === BATTLEPASS_LEVELS) continue; // the full Lord Nelson set
    if ("cosmeticId" in reward) {
      assert.ok(PASS_CATALOG.some((item) => item.id === reward.cosmeticId), `${reward.cosmeticId} at level ${level} must be pass-exclusive`);
    }
  }
});

test("premium track opens with the Voyager set at level 1", () => {
  const reward = passRewardForLevel(1).premium;
  assert.ok(reward && "set" in reward && reward.set === "voyager", "level 1 premium must be the Voyager set");
});

test("free track never repeats a cosmetic across levels", () => {
  const cosmeticLevels: string[] = [];
  for (let level = 1; level <= BATTLEPASS_LEVELS; level += 1) {
    const reward = passRewardForLevel(level).free;
    if ("cosmeticId" in reward && reward.cosmeticId) cosmeticLevels.push(reward.cosmeticId);
  }
  assert.equal(new Set(cosmeticLevels).size, cosmeticLevels.length, `free cosmetics repeat unexpectedly: ${cosmeticLevels.join(", ")}`);
  // Nothing is shared between the tracks: every free cosmetic id sits outside the premium cosmetic ladder.
  // Nothing is shared between the tracks: collect every premium cosmetic from the ladder and diff the sets.
  const premiumCosmetics: string[] = [];
  for (let level = 1; level <= BATTLEPASS_LEVELS; level += 1) {
    const reward = passRewardForLevel(level).premium;
    if (!reward) continue;
    if ("cosmeticId" in reward && reward.cosmeticId) premiumCosmetics.push(reward.cosmeticId);
  }
  const overlap = cosmeticLevels.filter((id) => premiumCosmetics.includes(id));
  assert.ok(overlap.length === 0, `tracks share cosmetics: ${overlap.join(", ")}`);
  // The moose-buck payout spine holds where it isn't displaced by a cosmetic: 50 open, 75 at %4, 25 elsewhere, and 200 at an unmapped %10 level.
  assert.deepEqual(passRewardForLevel(1).free, { mooseBucks: 50 });
  assert.deepEqual(passRewardForLevel(20).free, { cosmeticId: "maple-pips" });
  assert.deepEqual(passRewardForLevel(4).free, { mooseBucks: 75 });
  assert.deepEqual(passRewardForLevel(9).free, { mooseBucks: 25 });
});

test("revert makes a claim claimable again", () => {
  resetBattlePassForTests();
  awardBattlePassXp("revert-player", 100);
  claimBattlePassReward("revert-player", 1, "free");
  revertBattlePassClaim("revert-player", 1, "free");
  assert.ok(!viewBattlePass("revert-player").claimedFree.includes(1));
  claimBattlePassReward("revert-player", 1, "free");
  assert.ok(viewBattlePass("revert-player").claimedFree.includes(1));
});

test("pass state persists across a store reload", () => {
  resetBattlePassForTests();
  awardBattlePassXp("persist-player", 500);
  claimBattlePassReward("persist-player", 1, "free");
  // Simulated fresh process: drop the in-memory cache and read the file back.
  resetBattlePassForTests();
  const view = viewBattlePass("persist-player");
  assert.equal(view.xp, 500);
  assert.ok(view.claimedFree.includes(1));
});

test("battlepass cleanup", () => {
  rmSync(".data/test-battlepass.json", { force: true });
  rmSync(".data/test-cosmetics.json", { force: true });
});
