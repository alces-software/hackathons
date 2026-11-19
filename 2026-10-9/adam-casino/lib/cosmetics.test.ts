import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { test } from "node:test";
import {
  createCosmeticPass,
  equippedBadge,
  equippedTitle,
  grantCosmetic,
  issueCosmeticPasses,
  pruneInventory,
  resolveCosmeticBadge,
  resolveCosmeticTitle,
  setEquippedCosmetic,
  verifyCosmeticPass,
  viewCosmeticInventory,
} from "./cosmetics.ts";
import { COSMETIC_CATALOG, PASS_CATALOG, SHOP_CATALOG, findCosmetic, findCosmeticTitle, permanentPriceCosmetic } from "./cosmeticsCatalog.ts";
import { passRewardForLevel } from "./battlepass.ts";

// COSMETICS_FILE and UNO_SESSION_SECRET come from the test:cosmetics npm script, before this
// module (and its file-path binding) loads.
rmSync(".data/test-cosmetics.json", { force: true });
test("catalog has 50 items with unique ids and a shop/pass split", () => {
  assert.equal(COSMETIC_CATALOG.length, 50);
  assert.equal(new Set(COSMETIC_CATALOG.map((item) => item.id)).size, 50);
  assert.equal(COSMETIC_CATALOG.filter((item) => item.kind === "badge").length, 16);
  assert.equal(COSMETIC_CATALOG.filter((item) => item.kind === "title").length, 10);
  assert.equal(COSMETIC_CATALOG.filter((item) => item.kind === "uno-card-skin").length, 8);
  assert.equal(COSMETIC_CATALOG.filter((item) => item.kind === "craps-dice").length, 6);
  assert.equal(COSMETIC_CATALOG.filter((item) => item.kind === "roulette-wheel").length, 5);
  assert.equal(COSMETIC_CATALOG.filter((item) => item.kind === "blackjack-table").length, 5);
  for (const item of COSMETIC_CATALOG) {
    if (item.kind === "uno-card-skin") {
      assert.ok(item.cardStyles, `${item.id} must define cardStyles`);
      for (const color of ["red", "yellow", "green", "blue", "wild"] as const) assert.ok(item.cardStyles![color], `${item.id} must style ${color}`);
    }

    if (item.kind === "craps-dice") {
      assert.ok(item.diceStyles?.pip && item.diceStyles?.acePip, `${item.id} must define diceStyles`);
    }
    if (item.kind === "roulette-wheel") {
      assert.ok(item.wheelStyles?.pockets.red && item.wheelStyles?.pockets.black && item.wheelStyles?.pockets.green && item.wheelStyles.accent, `${item.id} must define wheelStyles`);
    }
    if (item.kind === "blackjack-table") {
      assert.ok(item.tableStyles?.feltClass && item.tableStyles?.cardBackClass && item.tableStyles?.cardBackIcon, `${item.id} must define tableStyles`);
    }
  }
  // Shop/pass split: SHOP_CATALOG is the full catalog minus pass rewards, and vice versa.
  assert.equal(SHOP_CATALOG.length + PASS_CATALOG.length, COSMETIC_CATALOG.length);
  assert.ok(PASS_CATALOG.length > 0 && SHOP_CATALOG.length > 0);
  for (const item of PASS_CATALOG) assert.ok(item.passReward, `${item.id} must be flagged passReward`);
  for (const item of SHOP_CATALOG) assert.ok(!item.passReward, `${item.id} must not be flagged passReward`);
  // Every level's cosmetic reward must exist in the catalog (catches ladder/catalog drift on both tracks).
  for (const level of [5, 10, 15, 20, 25, 30, 34, 39]) {
    const reward = passRewardForLevel(level).free;
    assert.ok(reward && "cosmeticId" in reward && reward.cosmeticId, `free level ${level} must carry a cosmetic`);
    assert.ok(findCosmetic(reward.cosmeticId), `${reward.cosmeticId} (free level ${level}) missing from catalog`);
  }
  // Pass sets (Voyager starter, Lord Nelson finale) are pass-only across every slot.
  assert.ok(["voyager-badge", "voyager-title", "lord-nelson-badge", "lord-nelson-title", "lord-nelson-dice", "lord-nelson-wheel", "lord-nelson-table", "lord-nelson-card-skin"].every((id) => !SHOP_CATALOG.some((item) => item.id === id)));
});

test("findCosmetic returns catalog item or null", () => {
  assert.equal(findCosmetic("moose-crown")?.name, "Moose Crown");
  assert.equal(findCosmetic("nonsense"), null);
  assert.equal(findCosmetic("campfire-rookie")?.kind, "title");
  assert.equal(findCosmeticTitle("campfire-rookie")?.label, "Campfire Rookie");
  assert.equal(findCosmeticTitle("pinecone-charm"), null);
  assert.equal(findCosmeticTitle("nonsense"), null);
});

test("pruneInventory drops expired rentals and dangling equipment", () => {
  const pruned = pruneInventory(
    {
      equippedId: "snowflake-charm",
      equippedBy: { badge: "snowflake-charm", title: "campfire-rookie" },
      owned: [
        { itemId: "pinecone-charm", expiresAt: null },
        { itemId: "snowflake-charm", expiresAt: 1000 },
      ],
    },
    2000,
  );
  assert.deepEqual(pruned.owned.map((entry) => entry.itemId), ["pinecone-charm"]);
  assert.equal(pruned.equippedId, null);
  assert.equal(pruned.equippedBy.badge, null);
  // the title equip also drops because campfire-rookie was never owned
  assert.equal(pruned.equippedBy.title, null);
});

test("grantCosmetic grants, charges exact prices, and refuses duplicate purchases", () => {
  assert.equal(issueCosmeticPasses("shopper2").badge ?? null, null);
  grantCosmetic("shopper2", "lodge-cider", 300);
  assert.equal(viewCosmeticInventory("shopper2").owned.length, 1);
  assert.throws(() => grantCosmetic("shopper2", "lodge-cider", 300), /already own an active rental of the Lodge Cider|no need to buy it twice/);
  assert.throws(() => grantCosmetic("shopper2", "moose-crown", 4999), /does not match the item price/i);
  // rentable items rent at their rental price; the permanent price is separate and higher
  grantCosmetic("shopper2", "midnight-deck", 1400);
  const rent = viewCosmeticInventory("shopper2").owned.find((entry) => entry.itemId === "midnight-deck");
  assert.ok(!rent?.expiresAt, "non-rental items are permanent");
});

test("pass-exclusive cosmetics grant without shop pricing, idempotently", () => {
  assert.equal(issueCosmeticPasses("passer").badge ?? null, null);
  grantCosmetic("passer", "aurora-king-dice", 1);
  assert.ok(viewCosmeticInventory("passer").owned.some((entry) => entry.itemId === "aurora-king-dice" && entry.expiresAt === null));
  grantCosmetic("passer", "aurora-king-dice", 0); // repeat claim is a harmless no-op
  assert.equal(viewCosmeticInventory("passer").owned.filter((entry) => entry.itemId === "aurora-king-dice").length, 1);
});

test("permanent buy replaces a live rental of a rentable item", () => {
  const now = Date.now();
  grantCosmetic("updater", "snowflake-charm", 300, now); // pass badge grants permanently
  assert.ok(viewCosmeticInventory("updater").owned.find((e) => e.itemId === "snowflake-charm")?.expiresAt === null);
  // A rental of a shop rentable still expires...
  grantCosmetic("updater", "laser-eyes", 800, now);
  const rental = viewCosmeticInventory("updater").owned.find((e) => e.itemId === "laser-eyes");
  assert.ok(rental?.expiresAt && rental.expiresAt > now, "laser-eyes rental carries an expiry");
  // ...and buying permanently replaces the rental entry with a never-expiring one.
  grantCosmetic("updater", "laser-eyes", permanentPriceCosmetic(findCosmetic("laser-eyes")!), now + 1_000);
  const bought = viewCosmeticInventory("updater");
  const entry = bought.owned.find((e) => e.itemId === "laser-eyes");
  assert.equal(entry?.expiresAt, null);
  assert.equal(bought.owned.filter((e) => e.itemId === "laser-eyes").length, 1);
});

test("explicit-slot equips only touch their own slot", () => {
  grantCosmetic("stylist", "truenorth-title", 0); // pass-exclusive title
  grantCosmetic("stylist", "midnight-deck", 1400); // uno-card-skin
  grantCosmetic("stylist", "howling-wolf", 0); // pass-exclusive badge
  setEquippedCosmetic("stylist", "truenorth-title", Date.now(), "title");
  setEquippedCosmetic("stylist", "midnight-deck", Date.now(), "uno-card-skin");
  setEquippedCosmetic("stylist", "howling-wolf", Date.now(), "badge");
  const inventory = viewCosmeticInventory("stylist");
  assert.equal(inventory.equippedBy.badge, "howling-wolf");
  assert.equal(inventory.equippedBy.title, "truenorth-title");
  assert.equal(inventory.equippedBy["uno-card-skin"], "midnight-deck");
  assert.equal(equippedTitle("stylist")?.label, "True North");
  assert.equal(equippedBadge("stylist")?.icon, "🐺");
  // kind must fit the slot
  assert.throws(() => setEquippedCosmetic("stylist", "howling-wolf", Date.now(), "title"), /does not fit that slot/i);
  assert.throws(() => setEquippedCosmetic("stylist", "truenorth-title", Date.now(), "badge"), /does not fit that slot/i);
  // unequipping one slot keeps the rest
  setEquippedCosmetic("stylist", null, Date.now(), "title");
  const after = viewCosmeticInventory("stylist");
  assert.equal(after.equippedBy.title, null);
  assert.equal(after.equippedBy["uno-card-skin"], "midnight-deck");
  assert.equal(after.equippedBy.badge, "howling-wolf");
});

test("legacy no-slot equip clears the other slots", () => {
  // stylist already has badge + skin from the previous case (title slot was cleared last)
  grantCosmetic("stylist", "trail-guide", 700);
  setEquippedCosmetic("stylist", "trail-guide", Date.now()); // no slot → titles slot only
  const inventory = viewCosmeticInventory("stylist");
  assert.equal(inventory.equippedBy.title, "trail-guide");
  assert.equal(inventory.equippedBy.badge, null);
  assert.equal(inventory.equippedBy["uno-card-skin"], null);
  assert.equal(inventory.equippedId, null);
});

test("each slot gets its own kind-matched pass", () => {
  grantCosmetic("wearer", "howling-wolf", 0);
  grantCosmetic("wearer", "truenorth-title", 0);
  grantCosmetic("wearer", "pastel-deck", 300); // rental price for pastel-deck
  grantCosmetic("wearer", "aurora-king-dice", 0);
  grantCosmetic("wearer", "aurora-royale-wheel", 0);
  grantCosmetic("wearer", "timberline-felt", 0);
  setEquippedCosmetic("wearer", "howling-wolf", Date.now(), "badge");
  setEquippedCosmetic("wearer", "truenorth-title", Date.now(), "title");
  setEquippedCosmetic("wearer", "pastel-deck", Date.now(), "uno-card-skin");
  setEquippedCosmetic("wearer", "aurora-king-dice", Date.now(), "craps-dice");
  setEquippedCosmetic("wearer", "aurora-royale-wheel", Date.now(), "roulette-wheel");
  setEquippedCosmetic("wearer", "timberline-felt", Date.now(), "blackjack-table");
  const passes = issueCosmeticPasses("wearer");
  const badgePayload = verifyCosmeticPass(passes.badge);
  assert.equal(badgePayload?.s, "badge");
  assert.equal(badgePayload?.id, "howling-wolf");
  const titlePayload = verifyCosmeticPass(passes.title);
  assert.equal(titlePayload?.s, "title");
  assert.equal(titlePayload?.id, "truenorth-title");
  const skinPayload = verifyCosmeticPass(passes["uno-card-skin"]);
  assert.equal(skinPayload?.s, "uno-card-skin");
  assert.equal(skinPayload?.id, "pastel-deck");
  const dicePayload = verifyCosmeticPass(passes["craps-dice"]);
  assert.equal(dicePayload?.s, "craps-dice");
  assert.equal(dicePayload?.id, "aurora-king-dice");
  const wheelPayload = verifyCosmeticPass(passes["roulette-wheel"]);
  assert.equal(wheelPayload?.s, "roulette-wheel");
  assert.equal(wheelPayload?.id, "aurora-royale-wheel");
  const tablePayload = verifyCosmeticPass(passes["blackjack-table"]);
  assert.equal(tablePayload?.s, "blackjack-table");
  assert.equal(tablePayload?.id, "timberline-felt");
  // kind-payload checks: each new item carries its game-page style payload
  assert.deepEqual(findCosmetic("frost-dice")?.diceStyles, { pip: "bg-sky-600", acePip: "bg-sky-500" });
  assert.deepEqual(findCosmetic("glacier-wheel")?.wheelStyles?.pockets, { red: "#e11d48", black: "#312e81", green: "#10b981" });
  assert.equal(findCosmetic("cabin-felt")?.tableStyles?.cardBackIcon, "🏕️");
  // resolveCosmeticTitle rejects a badge pass (and resolveCosmeticBadge rejects a title pass)
  assert.equal(resolveCosmeticBadge(passes.title), null);
  assert.equal(resolveCosmeticTitle(passes.badge), null);
  const titleAgain = resolveCosmeticTitle(passes.title);
  assert.equal(titleAgain?.label, "True North");
});

test("rentals get an expiry and the badge clears once lapsed", () => {
  const now = Date.now();
  // Rentable shop badge with a 24h term rents at the rental price...
  grantCosmetic("tenant", "laser-eyes", 800, now);
  assert.equal(viewCosmeticInventory("tenant").owned.find((e) => e.itemId === "laser-eyes")?.expiresAt, now + 24 * 60 * 60 * 1000);
  setEquippedCosmetic("tenant", "laser-eyes", now);
  assert.equal(equippedBadge("tenant")?.icon, "👁️");
  assert.throws(() => setEquippedCosmetic("tenant", "buck-fangs", now), /do not own that cosmetic/i);
  // once the rental lapses, pruneInventory clears the dangling equipment (covered above)
  const lapsed = pruneInventory({ equippedId: "laser-eyes", equippedBy: {}, owned: [{ itemId: "laser-eyes", expiresAt: now - 1 }] }, now);
  assert.deepEqual(lapsed.owned, []);
  assert.equal(lapsed.equippedId, null);
});

test("pass only verifies for live signatures", () => {
  grantCosmetic("signer", "buck-fangs", 1200);
  setEquippedCosmetic("signer", "buck-fangs");
  const pass = issueCosmeticPasses("signer").badge ?? null;
  assert.equal(pass, createCosmeticPass("signer", "buck-fangs", 0));
  const payload = verifyCosmeticPass(pass);
  assert.equal(payload?.u, "signer");
  assert.equal(payload?.id, "buck-fangs");
  assert.equal(payload?.s, "badge");
  const tampered = pass!.replace(/.$/, (c) => (c === "0" ? "1" : "0"));
  assert.equal(verifyCosmeticPass(tampered), null);
  assert.equal(verifyCosmeticPass("garbage"), null);
  viewCosmeticInventory("signer");
});
