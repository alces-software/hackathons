import { findCosmetic, findCosmeticTitle, permanentPriceCosmetic, rentalPriceCosmetic, COSMETIC_SLOTS, slotForKind, type CosmeticItem, type CosmeticKind, type CosmeticSlot, type CosmeticsTier } from "./cosmeticsCatalog.ts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

/* ---------- Signed cosmetic passes ---------- */

const passSecret = process.env.UNO_SESSION_SECRET ?? "local-development-only-change-me";

export type CosmeticPassPayload = { u: string; id: string; e: number; s: CosmeticSlot };

function encodePayload(payload: CosmeticPassPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signEncoded(encoded: string) {
  return createHmac("sha256", passSecret).update(encoded).digest("base64url");
}

/** The pass is server-issued; rooms verify the signature instead of trusting the client. */
export function createCosmeticPass(username: string, itemId: string, expiresAt: number, slot?: CosmeticSlot) {
  const item = findCosmetic(itemId);
  if (!item && slot === undefined) throw new Error("That item is not in the gift shop catalog.");
  const payload: CosmeticPassPayload = {
    u: username,
    id: itemId,
    e: expiresAt,
    s: slot ?? (item ? slotForKind[item.kind] : "badge"),
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signEncoded(encoded)}`;
}

/** Returns the pass payload if the signature is valid and the rental (if any) has not expired. */
export function verifyCosmeticPass(pass: string | undefined | null): CosmeticPassPayload | null {
  if (typeof pass !== "string") return null;
  const [encoded, signature] = pass.split(".");
  if (!encoded || !signature) return null;
  const expected = signEncoded(encoded);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CosmeticPassPayload;
    if (typeof payload.u !== "string" || typeof payload.id !== "string" || !Number.isFinite(payload.e)) return null;
    if (COSMETIC_SLOTS.indexOf(payload.s) === -1) return null;
    if (payload.e !== 0 && payload.e <= Date.now()) return null; // 0 = permanent
    if (!findCosmetic(payload.id)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- Ownership store (server-side, persisted to .data/cosmetics.json) ---------- */

export type CosmeticEntry = { itemId: string; expiresAt: number | null }; // null expiry = permanent ownership
export type CosmeticEquips = Partial<Record<CosmeticSlot, string | null>>;
export type CosmeticInventory = { equippedId: string | null; equippedBy: CosmeticEquips; owned: CosmeticEntry[] };
export type OwnedCosmetic = CosmeticEntry & { item: CosmeticItem };

/** All slot keys, with the legacy `equippedId` slot name first for backwards-compatible pass payloads. */
const SLOT_KEYS = ["badge", "title", "uno-card-skin", "craps-dice", "roulette-wheel", "blackjack-table"] as const;

const inventories = new Map<string, CosmeticInventory>();
const inventoriesFile = process.env.COSMETICS_FILE ?? join(process.cwd(), ".data/cosmetics.json");
let inventoriesLoaded = false;

function normalizeEquips(equippedBy: CosmeticEquips | undefined): CosmeticEquips {
  const normalized: CosmeticEquips = {};
  for (const slot of SLOT_KEYS) normalized[slot] = equippedBy?.[slot] ?? null;
  return normalized;
}

/** Drop expired rentals and any equipment pointing at something no longer owned. */
export function pruneInventory(inventory: CosmeticInventory, now: number): CosmeticInventory {
  const owned = (inventory.owned ?? []).filter((entry) => entry.expiresAt === null || entry.expiresAt > now);
  const equippedId = inventory.equippedId && owned.some((entry) => entry.itemId === inventory.equippedId) ? inventory.equippedId : null;
  const equippedBy = normalizeEquips(inventory.equippedBy);
  for (const slot of SLOT_KEYS) {
    const itemId = equippedBy[slot];
    equippedBy[slot] = itemId && owned.some((entry) => entry.itemId === itemId) ? itemId : null;
  }
  equippedBy.badge = equippedId ?? equippedBy.badge ?? null;
  return { equippedId, equippedBy, owned };
}

function loadInventories() {
  if (inventoriesLoaded) return;
  inventoriesLoaded = true;
  if (!existsSync(/* turbopackIgnore: true */ inventoriesFile)) return;
  try {
    const saved = JSON.parse(readFileSync(/* turbopackIgnore: true */ inventoriesFile, "utf8")) as Record<string, CosmeticInventory>;
    Object.entries(saved).forEach(([username, inventory]) => {
      inventories.set(username, pruneInventory({ equippedId: inventory.equippedId ?? null, equippedBy: inventory.equippedBy ?? {}, owned: inventory.owned ?? [] }, Date.now()));
    });
  } catch {
    /* ignore corrupt runtime state */
  }
}

function saveInventories() {
  mkdirSync(dirname(inventoriesFile), { recursive: true });
  writeFileSync(inventoriesFile, JSON.stringify(Object.fromEntries(inventories)), "utf8");
}

function getInventory(username: string) {
  loadInventories();
  return inventories.get(username) ?? { equippedId: null, equippedBy: {}, owned: [] };
}

/** Equips an owned item into its kind's slot, or clears the slot when itemId is null. */
function setEquippedSlot(username: string, slot: CosmeticSlot, itemId: string | null, now: number) {
  loadInventories();
  const inventory = getInventory(username);
  const pruned = pruneInventory(inventory, now);
  const equippedBy = normalizeEquips(pruned.equippedBy);
  if (itemId !== null) {
    const entry = pruned.owned.find((value) => value.itemId === itemId);
    const item = entry ? findCosmetic(itemId) : null;
    if (!item || slotForKind[item.kind] !== slot) throw new Error(`You do not own that cosmetic. Buy it in the gift shop first.`);
    equippedBy[slot] = itemId;
    if (item.kind === "badge") pruned.equippedId = itemId; // legacy mirror of the badge slot
  } else if (slot === "badge") {
    equippedBy.badge = null;
    pruned.equippedId = null;
  } else {
    equippedBy[slot] = null;
  }
  pruned.equippedBy = equippedBy;
  inventories.set(username, pruned);
  saveInventories();
  return pruned;
}

/**
 * Equips an owned item. With no explicit `slot`, only the item's own kind slot stays equipped
 * (legacy single-item callers). With an explicit `slot`, other slots are left untouched and the
 * slot must match the item's kind; itemId null (or slot alone) unequips that slot.
 */
export function setEquippedCosmetic(username: string, itemId: string | null, now = Date.now(), slot?: CosmeticSlot) {
  if (slot !== undefined) {
    if (COSMETIC_SLOTS.indexOf(slot) === -1) throw new Error("Unknown cosmetic slot.");
    if (itemId !== null) {
      const item = findCosmetic(itemId);
      if (!item) throw new Error("That item is not in the gift shop catalog.");
      if (slotForKind[item.kind] !== slot) throw new Error("That cosmetic does not fit that slot.");
      return setEquippedSlot(username, slot, itemId, now);
    }
    return setEquippedSlot(username, slot, null, now);
  }
  const result = equipCosmetic(username, itemId, now);
  if (itemId !== null) {
    const kind = findCosmetic(itemId)?.kind;
    if (kind) for (const other of SLOT_KEYS) if (other !== slotForKind[kind]) setEquippedSlot(username, other, null, now);
  }
  return result;
}

/** The badge a player currently has equipped, or null. Used when players enter rooms. */
export function equippedBadge(username: string): { id: string; icon: string } | null {
  loadInventories();
  const inventory = inventories.get(username);
  if (!inventory) return null;
  const pruned = pruneInventory(inventory, Date.now());
  const badgeId = pruned.equippedBy.badge ?? pruned.equippedId;
  if (!badgeId) return null;
  const item = findCosmetic(badgeId);
  return item ? { id: item.id, icon: item.icon } : null;
}

/** The title a player currently has equipped, or null. Used when players enter rooms. */
export function equippedTitle(username: string): { id: string; label: string; icon: string } | null {
  loadInventories();
  const inventory = inventories.get(username);
  if (!inventory) return null;
  const pruned = pruneInventory(inventory, Date.now());
  const titleId = pruned.equippedBy.title;
  if (!titleId) return null;
  return findCosmeticTitle(titleId);
}

/** Full inventory for the shop page, including the freshly signed cosmetic pass. */
export function viewCosmeticInventory(username: string) {
  loadInventories();
  const inventory = inventories.get(username) ?? { equippedId: null as string | null, equippedBy: {}, owned: [] as CosmeticEntry[] };
  const pruned = pruneInventory(inventory, Date.now());
  const prunedOwned = pruned.owned;
  const equippedEntry = prunedOwned.find((entry) => entry.itemId === pruned.equippedId) ?? null;
  const owned: OwnedCosmetic[] = prunedOwned.flatMap((entry) => {
    const item = findCosmetic(entry.itemId);
    return item ? [{ ...entry, item }] : [];
  });
  const equippedBy = normalizeEquips(pruned.equippedBy);
  return {
    owned,
    equippedId: pruned.equippedId, // legacy badge-slot mirror
    equippedBy,
    badge: equippedBadge(username),
    title: equippedTitle(username),
    pass: equippedEntry ? createCosmeticPass(username, equippedEntry.itemId, equippedEntry.expiresAt ?? 0) : null,
  };
}

/** Passes for everything the player has equipped, keyed by slot (null slot = nothing equipped). */
export function issueCosmeticPasses(username: string): Partial<Record<CosmeticSlot, string | null>> {
  loadInventories();
  const inventory = inventories.get(username);
  if (!inventory) return {};
  const pruned = pruneInventory(inventory, Date.now());
  const passes: Partial<Record<CosmeticSlot, string | null>> = {};
  for (const slot of SLOT_KEYS) {
    const itemId = slot === "badge" ? pruned.equippedBy.badge ?? pruned.equippedId : pruned.equippedBy[slot];
    const entry = itemId ? pruned.owned.find((value) => value.itemId === itemId) : undefined;
    passes[slot] = entry ? createCosmeticPass(username, entry.itemId, entry.expiresAt ?? 0) : null;
  }
  return passes;
}

/** Single-slot convenience for clients that only need the badge pass (legacy shape). */
export function issueCosmeticPass(username: string) {
  return issueCosmeticPasses(username).badge ?? null;
}

/* ---------- Mutations (only called from the shop API route after banking) ---------- */

/** Equips an owned item into the slot matching its kind, or clears that slot when itemId is null. */
export function equipCosmetic(username: string, itemId: string | null, now = Date.now()) {
  const slot = itemId === null ? "badge" : slotForKind[findCosmetic(itemId)?.kind ?? "badge"];
  return setEquippedSlot(username, slot, itemId, now);
}

/**
 * Records a completed purchase. `pricePaid` is the amount the banking service actually took;
 * rental prices are per the rental term, permanent prices are the one-off price.
 */
export function grantCosmetic(username: string, itemId: string, pricePaid: number, now = Date.now()) {
  const item = findCosmetic(itemId);
  if (!item) throw new Error("That item is not in the gift shop catalog.");
  loadInventories();
  const inventory = getInventory(username);
  const pruned = pruneInventory(inventory, now);
  if (item.passReward) {
    // Pass rewards bypass shop-priced validation: they cost XP, and repeating a claim is a no-op.
    if (pruned.owned.some((entry) => entry.itemId === itemId && (entry.expiresAt === null || entry.expiresAt > now))) return pruned;
    if (pruned.owned.some((entry) => entry.itemId === itemId)) {
      // Replace a lapsed rental entry with the permanent pass-grant one.
      pruned.owned = pruned.owned.filter((entry) => entry.itemId !== itemId);
      pruned.owned.push({ itemId, expiresAt: null });
      inventories.set(username, pruned);
      saveInventories();
    } else {
      pruned.owned.push({ itemId, expiresAt: null });
      inventories.set(username, pruned);
      saveInventories();
    }
    return pruned;
  }
  if (pruned.owned.some((entry) => entry.itemId === itemId && (entry.expiresAt === null || entry.expiresAt > now))) {
    if (item.rental && pricePaid === permanentPriceCosmetic(item)) {
      // Buying permanently over a live rental is an upgrade (no refund) — allow it.
    } else {
      throw new Error(
        item.rental
          ? `You already own an active rental of the ${item.name} — equip it from your collection instead.`
          : `You already own the ${item.name} — no need to buy it twice.`,
      );
    }
  }
  if (item.rental) {
    const buyOverRental = pruned.owned.some((entry) => entry.itemId === itemId && (entry.expiresAt === null || entry.expiresAt > now));
    const expected = Math.round((buyOverRental ? permanentPriceCosmetic(item) : rentalPriceCosmetic(item)) * 100) / 100;
    if (Math.round(pricePaid * 100) / 100 !== expected) throw new Error("The amount debited does not match the rental price.");
    if (buyOverRental) {
      // Permanent buy over a live rental: replace the expiring entry with a never-expiring one.
      pruned.owned = pruned.owned.filter((entry) => entry.itemId !== itemId);
      pruned.owned.push({ itemId, expiresAt: null });
    } else {
      pruned.owned.push({ itemId, expiresAt: now + item.rental.hours * 60 * 60 * 1000 });
    }
  } else {
    const expected = Math.round(permanentPriceCosmetic(item) * 100) / 100;
    if (Math.round(pricePaid * 100) / 100 !== expected) throw new Error("The amount debited does not match the item price.");
    pruned.owned = pruned.owned.filter((entry) => entry.itemId !== itemId); // replace any stale rental entry
    pruned.owned.push({ itemId, expiresAt: null });
  }
  inventories.set(username, pruned);
  saveInventories();
  return pruned;
}

/** Removes an owned entry (used for refunds only). Returns true when something was removed. */
export function revokeCosmetic(username: string, itemId: string) {
  loadInventories();
  const inventory = inventories.get(username) ?? { equippedId: null, equippedBy: {}, owned: [] };
  const before = inventory.owned.length;
  const pruned = pruneInventory(inventory, Date.now());
  pruned.owned = pruned.owned.filter((entry) => entry.itemId !== itemId);
  if (pruned.equippedId === itemId) pruned.equippedId = null;
  const equippedBy = pruned.equippedBy;
  for (const slot of SLOT_KEYS) if (equippedBy[slot] === itemId) equippedBy[slot] = null;
  if (pruned.owned.length === before) return false;
  inventories.set(username, pruned);
  saveInventories();
  return true;
}

export const COSMETICS_PURCHASE_TYPE = "shop";

export type PurchasedCosmetic =
  | { kind: "permanent"; inventory: CosmeticInventory }
  | { kind: "rental"; inventory: CosmeticInventory; expiresAt: number };

/**
 * Buys a cosmetic with moose bucks. The banking service is debited first; the cosmetic is only
 * granted when the debit succeeds, so a failed transaction leaves no ownership behind.
 */
export async function purchaseCosmetic(
  username: string,
  itemId: string,
  banking: { username: string; password: string },
  options: { rentalHours?: number } = {},
) {
  const item = findCosmetic(itemId);
  if (!item) throw new Error("That item is not in the gift shop catalog.");
  const bankingApiUrl = process.env.BANKING_API_URL ?? "http://10.151.0.85:3000/api/v1";
  const serviceToken = process.env.BANKING_SERVICE_TOKEN;
  const casinoUsername = process.env.CASINO_USERNAME;
  if (!serviceToken || !casinoUsername) throw new Error("Gift shop is not configured (missing banking service token).");
  const rentalHours = options.rentalHours;
  if (item.rental) {
    const permanent = rentalHours === undefined;
    if (permanent && item.permanentPrice == null) throw new Error(`The ${item.name} is rental-only.`);
    if (!permanent && rentalHours !== item.rental.hours) throw new Error(`The ${item.name} rental is a ${item.rental.hours}-hour term.`);
  } else if (rentalHours) {
    throw new Error("That item is sold permanently and cannot be rented.");
  }
  const amount = item.rental ? rentalPriceCosmetic(item) : permanentPriceCosmetic(item);
  const debit = await fetch(`${bankingApiUrl}/services/transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken}` },
    body: JSON.stringify({ username: banking.username, password: banking.password, serviceToken, amount, type: "loss" }),
  });
  if (debit.status === 401) throw new Error("Banking credentials were rejected — log in again with your banking account.");
  if (!debit.ok && debit.status !== 204) throw new Error(`The banking service refused the purchase (HTTP ${debit.status}).`);
  grantCosmetic(username, itemId, amount);
  return viewCosmeticInventory(username);
}

/**
 * Server-side helper for room routes: verifies a client-supplied cosmetic pass and returns the
 * badge the player may show, or null when the pass is absent/invalid/expired or not a badge.
 */
export function resolveCosmeticBadge(pass: string | undefined | null) {
  const payload = verifyCosmeticPass(pass);
  if (!payload || payload.s !== "badge") return null;
  const item = findCosmetic(payload.id);
  if (!item || item.kind !== "badge") return null;
  return { id: item.id, icon: item.icon, username: payload.u };
}

/** Like resolveCosmeticBadge but for equipped titles. */
export function resolveCosmeticTitle(pass: string | undefined | null) {
  const payload = verifyCosmeticPass(pass);
  if (!payload || payload.s !== "title") return null;
  return findCosmeticTitle(payload.id);
}

/** Test-only: clears the in-memory inventory store between test cases. */
export function resetInventoriesForTests() {
  inventories.clear();
  inventoriesLoaded = false;
}

