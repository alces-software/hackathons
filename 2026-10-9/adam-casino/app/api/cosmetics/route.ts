import { NextResponse } from "next/server";
import { COSMETIC_SLOTS, SHOP_CATALOG, COSMETIC_CATALOG, findCosmetic, type CosmeticSlot } from "@/lib/cosmeticsCatalog";
import { purchaseCosmetic, setEquippedCosmetic, viewCosmeticInventory } from "@/lib/cosmetics";

function isSlot(value: string | null): value is CosmeticSlot {
  return value !== null && (COSMETIC_SLOTS as readonly string[]).includes(value);
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** The catalog is static; inventory comes only when the request names an account (public read-only view). */
/** Public catalog is what the shop sells; the full catalog resolves via findCosmetic for equips/previews. */
export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim();
  const catalog = username ? COSMETIC_CATALOG : SHOP_CATALOG;
  if (!username) return NextResponse.json({ catalog, inventory: null });
  return NextResponse.json({ catalog, inventory: viewCosmeticInventory(username) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "buy" | "equip" | "unequip";
      username?: string;
      password?: string;
      itemId?: string;
      rentalHours?: number;
      slot?: string;
    };
    const username = body.username?.trim();
    const password = body.password ?? "";
    if (!username) throw new Error("Sign in with your banking account to use the gift shop.");
    if (!password) throw new Error("Confirm your banking password for this change.");
    if (body.action === "buy") {
      // Alces Pass rewards are never purchasable.
      const buyItem = findCosmetic(body.itemId ?? "");
      if (buyItem?.passReward) throw new Error("That cosmetic is an Alces Pass reward and cannot be purchased.");
      const inventory = await purchaseCosmetic(
        username,
        body.itemId ?? "",
        { username, password },
        body.rentalHours ? { rentalHours: body.rentalHours } : {},
      );
      return NextResponse.json({ inventory });
    }
    if (body.action === "equip" || body.action === "unequip") {
      if (body.slot !== undefined && !isSlot(body.slot)) throw new Error("Unknown cosmetic slot.");
      const itemId = body.action === "unequip" ? null : (body.itemId ?? "");
      setEquippedCosmetic(username, itemId, Date.now(), body.slot);
      return NextResponse.json({ inventory: viewCosmeticInventory(username) });
    }
    throw new Error("Unknown gift shop action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected gift shop error.";
    const unauthorized = /banking credentials/i.test(message);
    return errorResponse(message, unauthorized ? 401 : 400);
  }
}
