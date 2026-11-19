import { NextResponse } from "next/server";
import { COSMETIC_SLOTS, type CosmeticSlot } from "@/lib/cosmeticsCatalog";
import { issueCosmeticPasses } from "@/lib/cosmetics";

function isSlot(value: string | null): value is CosmeticSlot {
  return value !== null && (COSMETIC_SLOTS as readonly string[]).includes(value);
}

/** Returns the signed pass for one cosmetic slot (defaults to the legacy badge pass), or all slots. */
export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim();
  if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });
  const passes = issueCosmeticPasses(username);
  const slot = new URL(request.url).searchParams.get("slot");
  if (isSlot(slot)) return NextResponse.json({ pass: passes[slot] ?? null });
  return NextResponse.json({
    pass: passes.badge ?? null,
    passes,
  });
}

