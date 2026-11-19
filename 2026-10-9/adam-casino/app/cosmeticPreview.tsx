"use client";

// Shared cosmetic preview renderers used by the Alces Pass ladder, the reward modal and the locker.
import { findCosmetic, type CosmeticCardColor, type CosmeticSlot } from "@/lib/cosmeticsCatalog";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Small visual strip for one catalog item; falls back to the icon chip when styles are absent. */
export function CosmeticPreview({ itemId, size = "sm" }: { itemId: string; size?: "sm" | "lg" }) {
  const item = findCosmetic(itemId);
  if (!item) return null;
  const pad = size === "lg" ? "gap-2" : "gap-1.5";
  if (item.cardStyles) {
    return (
      <span className={`flex max-w-full ${pad}`}>
        {(Object.keys(item.cardStyles) as CosmeticCardColor[]).map((color) => (
          <span
            key={color}
            aria-hidden="true"
            className={`flex items-center justify-center rounded-md font-black ${size === "lg" ? "h-14 w-11 text-sm" : "h-8 w-6 text-[10px]"} ${item.cardStyles![color]}`}
          >
            {color === "wild" ? "★" : color[0].toUpperCase()}
          </span>
        ))}
      </span>
    );
  }
  if (item.diceStyles) {
    return (
      <span className={`flex ${pad}`}>
        {[1, 6].map((value) => (
          <span
            key={value}
            aria-hidden="true"
            className={`grid grid-cols-3 grid-rows-3 items-center justify-center gap-[1px] rounded-md border-2 border-sky-200/60 bg-white/90 ${size === "lg" ? "h-14 w-14 p-2" : "h-8 w-8 p-[2px]"}`}
          >
            {(PIPS[value] ?? PIPS[1]).map((pip) => (
              <span
                key={pip}
                className={`rounded-full ${size === "lg" ? "h-2.5 w-2.5" : "h-1.5 w-1.5"} ${value === 1 ? item.diceStyles?.acePip ?? "bg-rose-600" : item.diceStyles?.pip ?? "bg-slate-900"}`}
              />
            ))}
          </span>
        ))}
      </span>
    );
  }
  if (item.wheelStyles) {
    return (
      <span className={`flex items-center ${pad}`}>
        {(["red", "black", "green"] as const).map((pocket) => (
          <span
            key={pocket}
            aria-hidden="true"
            className={`flex items-center justify-center rounded-full font-black ${size === "lg" ? "h-14 w-14 text-sm" : "h-8 w-8 text-[10px]"}`}
            style={{ backgroundColor: item.wheelStyles!.pockets[pocket] }}
          >
            {pocket === "black" ? "B" : pocket === "green" ? "0" : "R"}
          </span>
        ))}
      </span>
    );
  }
  if (item.tableStyles) {
    return (
      <span className={`flex items-center ${pad}`}>
        <span
          aria-hidden="true"
          className={`flex items-center justify-center rounded-md ${size === "lg" ? "h-16 w-24 text-2xl" : "h-8 w-14 text-sm"} ${item.tableStyles.cardBackClass}`}
        >
          {item.tableStyles.cardBackIcon}
        </span>
        <span
          aria-hidden="true"
          className={`flex items-center justify-center rounded-md border text-[9px] font-black uppercase tracking-widest text-white/80 ${size === "lg" ? "h-16 w-24" : "h-8 w-14"} ${item.tableStyles.feltClass}`}
        >
          Felt
        </span>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-xl bg-white/[0.08] ${size === "lg" ? "h-24 w-24 text-5xl" : "h-8 w-8 text-base"}`}
    >
      {item.icon}
    </span>
  );
}

export const COSMETIC_SLOTS_UI: CosmeticSlot[] = ["badge", "title", "uno-card-skin", "craps-dice", "roulette-wheel", "blackjack-table"];
