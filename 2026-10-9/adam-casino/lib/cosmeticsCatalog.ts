/* Catalog shared by the server, the shop page and the room badges. Kept in its own module so
   client components can import it without pulling the node:fs-based cosmetics store into the
   browser bundle. */

export type CosmeticsTier = "lodge" | "trophy" | "legend";
export type CosmeticSlot = "badge" | "title" | "uno-card-skin" | "craps-dice" | "roulette-wheel" | "blackjack-table";
/** Each cosmetic kind equips into its own slot, so the two unions stay 1:1. */
export type CosmeticKind = CosmeticSlot;
/** The five UNO card colours a skin restyles (hue-preserving so gameplay stays fair). */
export type CosmeticCardColor = "red" | "yellow" | "green" | "blue" | "wild";
export type CosmeticCardStyles = Partial<Record<CosmeticCardColor, string>> & { hiddenStyle?: string };
/** Craps dice only: pip colour overrides for the dice pair. */
export type CosmeticDiceStyles = { pip: string; acePip: string };
/** Roulette wheels only: pocket/track/accent palette (readability preserved). */
export type CosmeticWheelStyles = {
  pockets: { red: string; black: string; green: string };
  woodFrom: string; woodTo: string;
  trackFrom: string; trackTo: string;
  accent: string; spoke: string;
};
/** Blackjack tables only: felt tint plus a themed face-down card back. */
export type CosmeticTableStyles = { feltClass: string; cardBackClass: string; cardBackIcon: string };

export type CosmeticItem = {
  id: string;
  name: string;
  icon: string;
  price: number;
  tier: CosmeticsTier;
  kind: CosmeticKind;
  /** Titles only: the text worn next to the player's name (the icon prefixes it on plates). */
  label?: string;
  /** Marks Alces Pass rewards; these never appear in the gift shop and cannot be bought. */
  passReward?: boolean;
  /** Card skins only: tailwind classes per UNO colour; runtime classes are scanned by Tailwind. */
  cardStyles?: CosmeticCardStyles;
  /** Card skins only: the face-down card back for that skin. */
  hiddenStyle?: string;
  /** Craps dice only: tailwind classes for pip colours. */
  diceStyles?: CosmeticDiceStyles;
  /** Roulette wheels only: pocket/track/accent palette. */
  wheelStyles?: CosmeticWheelStyles;
  /** Blackjack tables only: felt tint and face-down card back. */
  tableStyles?: CosmeticTableStyles;
  /** Short shop description for the newer catalogue entries. */
  blurb?: string;
  /**
   * Absent for permanent-only purchases; otherwise a timed rental from the moment of purchase.
   * `price` is the rental price; a `permanentPrice` makes the item also buyable to keep forever.
   */
  rental?: { hours: 24 | 168; price?: number };
  /** Optional one-off price to own a rentable item forever (must exceed the rental `price`). */
  permanentPrice?: number;
};

export const COSMETIC_SLOTS: CosmeticSlot[] = ["badge", "title", "uno-card-skin", "craps-dice", "roulette-wheel", "blackjack-table"];
export const slotForKind: Record<CosmeticKind, CosmeticSlot> = {
  badge: "badge",
  title: "title",
  "uno-card-skin": "uno-card-skin",
  "craps-dice": "craps-dice",
  "roulette-wheel": "roulette-wheel",
  "blackjack-table": "blackjack-table",
};
export const kindLabels: Record<CosmeticSlot, string> = {
  badge: "Badge",
  title: "Title",
  "uno-card-skin": "UNO card skin",
  "craps-dice": "Craps dice",
  "roulette-wheel": "Roulette wheel",
  "blackjack-table": "Blackjack table",
};

export const COSMETIC_CATALOG: CosmeticItem[] = [
  // Badges
  { id: "lucky-antlers", name: "Lucky Antlers", icon: "🫎", price: 250, tier: "lodge", kind: "badge", passReward: true },
  { id: "snowflake-charm", name: "Snowflake Charm", icon: "❄️", price: 300, tier: "lodge", kind: "badge", rental: { hours: 24 }, permanentPrice: 900, passReward: true },
  { id: "pinecone-charm", name: "Pinecone Charm", icon: "🌲", price: 500, tier: "lodge", kind: "badge", passReward: true },
  { id: "trapper-cap", name: "Trapper Cap", icon: "🧢", price: 750, tier: "lodge", kind: "badge", passReward: true },
  {
    id: "beaverwork-badge", name: "Beaverwork Badge", icon: "🦫", price: 800, tier: "trophy", kind: "badge", passReward: true,
    blurb: "A dam-strong piece of lodge craftsmanship. Premium Alces Pass level 39.",
  },
  { id: "lodge-cider", name: "Lodge Cider", icon: "🍺", price: 300, tier: "lodge", kind: "badge", rental: { hours: 168 }, permanentPrice: 780 },
  { id: "poutine", name: "Lodge Poutine", icon: "🍟", price: 300, tier: "lodge", kind: "badge", rental: { hours: 168 }, permanentPrice: 780 },
  { id: "buck-fangs", name: "Buck Fangs", icon: "🦌", price: 1200, tier: "trophy", kind: "badge" },
  { id: "maple-syrup", name: "Maple Syrup", icon: "🍁", price: 1500, tier: "trophy", kind: "badge" },
  { id: "laser-eyes", name: "Laser Eyes", icon: "👁️", price: 800, tier: "trophy", kind: "badge", rental: { hours: 24 }, permanentPrice: 2500 },
  { id: "mystic-tome", name: "Mystic Tome", icon: "📖", price: 2500, tier: "trophy", kind: "badge" },
  { id: "aurora-glow", name: "Aurora Glow", icon: "🌌", price: 1200, tier: "legend", kind: "badge", rental: { hours: 168 }, permanentPrice: 4000 },
  { id: "moose-crown", name: "Moose Crown", icon: "👑", price: 5000, tier: "legend", kind: "badge" },
  // Titles (worn on the name plate in UNO and Battleships rooms)
  { id: "campfire-rookie", name: "Campfire Rookie", icon: "🔥", price: 400, tier: "lodge", kind: "title", label: "Campfire Rookie", blurb: "A humble start beside the fire.", passReward: true },
  // Pass-exclusive cosmetics — these never appear in the gift shop; they only come from the Alces Pass.
  { id: "howling-wolf", name: "Howling Wolf", icon: "🐺", price: 900, tier: "trophy", kind: "badge", passReward: true },
  { id: "truenorth-title", name: "True North", icon: "🧭", price: 1200, tier: "trophy", kind: "title", label: "True North", passReward: true },
  {
    id: "northwind-deck", name: "Northwind Deck", icon: "🌬️", price: 1200, tier: "trophy", kind: "uno-card-skin", passReward: true,
    blurb: "Bleak midwinter colours blown in on the north wind.",
    cardStyles: {
      red: "bg-cyan-600 text-white",
      yellow: "bg-teal-300 text-teal-950",
      green: "bg-teal-700 text-white",
      blue: "bg-cyan-800 text-white",
      wild: "bg-[conic-gradient(#0e7490_0_25%,#2dd4bf_0_50%,#134e4a_0_75%,#155e75_0_100%)] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
    },
    hiddenStyle: "border-2 border-cyan-300/50 bg-gradient-to-br from-teal-950 to-cyan-950 shadow-xl",
  },
  {
    id: "aurora-king-dice", name: "Aurora Dice", icon: "🌌", price: 1400, tier: "legend", kind: "craps-dice", passReward: true,
    blurb: "Pips lit by the northern lights — green ice, violet ace.",
    diceStyles: { pip: "bg-emerald-600", acePip: "bg-violet-500" },
  },
  // Free Alces Pass track: pass-exclusive dice, wheels, tables and titles the shop never sells.
  { id: "maple-pips", name: "Maple Pips", icon: "🍁", price: 1000, tier: "trophy", kind: "craps-dice", passReward: true,
    blurb: "Warm amber pips rolled straight off the sugar bush. Free Alces Pass level 20.",
    diceStyles: { pip: "bg-amber-600", acePip: "bg-rose-700" },
  },
  {
    id: "sugar-shack-deck", name: "Sugar Shack Deck", icon: "🥞", price: 1300, tier: "legend", kind: "uno-card-skin", passReward: true,
    blurb: "Syrup-sticky colours for late-season tables. Premium Alces Pass level 32.",
    cardStyles: {
      red: "bg-rose-700 text-rose-50",
      yellow: "bg-amber-400 text-amber-950",
      green: "bg-[#8a5a2b] text-white",
      blue: "bg-[#6b3f1d] text-amber-100",
      wild: "bg-[conic-gradient(#f59e0b_0_25%,#f97316_0_50%,#b45309_0_75%,#fbbf24_0_100%)] text-amber-950 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
    },
    hiddenStyle: "border-2 border-amber-300/50 bg-gradient-to-br from-amber-900 to-orange-950 shadow-xl",
  },
  {
    id: "timberline-felt", name: "Timberline Table", icon: "🌲", price: 1600, tier: "legend", kind: "blackjack-table", passReward: true,
    blurb: "Deep pine felt under an evergreen card back. Free Alces Pass level 30.",
    tableStyles: {
      feltClass: "border-emerald-300/15 bg-[#0b2e1f]/80",
      cardBackClass: "border-2 border-emerald-300/50 bg-gradient-to-br from-emerald-900 to-teal-950 shadow-xl",
      cardBackIcon: "🌲",
    },
  },
  {
    id: "aurora-royale-wheel", name: "Aurora Royale Wheel", icon: "🌠", price: 2400, tier: "legend", kind: "roulette-wheel", passReward: true,
    blurb: "A boreal wheel rimmed in ice-fire violet. Free Alces Pass level 25.",
    wheelStyles: {
      pockets: { red: "#db2777", black: "#1e1b4b", green: "#31c48d" },
      woodFrom: "#4c1d95", woodTo: "#2e1065",
      trackFrom: "#0b1120", trackTo: "#4c1d95",
      accent: "#c084fc", spoke: "#e9d5ff",
    },
  },
  { id: "trail-guide", name: "Trail Guide", icon: "🥾", price: 700, tier: "lodge", kind: "title", label: "Trail Guide", blurb: "Never lost, mostly on purpose." },
  { id: "high-roller-north", name: "High Roller of the North", icon: "🎲", price: 1500, tier: "trophy", kind: "title", label: "High Roller of the North", blurb: "Stakes so cold they freeze." },
  { id: "maple-sharpshooter", name: "Maple Sharpshooter", icon: "🎯", price: 700, tier: "trophy", kind: "title", label: "Maple Sharpshooter", rental: { hours: 168 }, permanentPrice: 2200, blurb: "One week of aimed glory." },
  { id: "lodge-legend", name: "Lodge Legend", icon: "🏆", price: 1000, tier: "legend", kind: "title", label: "Lodge Legend", rental: { hours: 168 }, permanentPrice: 3500, blurb: "Whispered about at every table." },
  {
    id: "north-passage-title", name: "Northwest Passage", icon: "🧭", price: 1100, tier: "trophy", kind: "title", label: "Northwest Passage", passReward: true,
    blurb: "For finding a way through when the map runs out. Free Alces Pass level 34.",
  },
  {
    id: "alces-deck", name: "Alces Deck", icon: "🫎", price: 1200, tier: "legend", kind: "uno-card-skin", passReward: true,
    blurb: "The lodge's own deck, stamped bull to back. Free Alces Pass level 39.",
    cardStyles: {
      red: "border-red-300/40 bg-gradient-to-br from-red-800 to-red-950 text-red-50",
      yellow: "border-amber-300/40 bg-gradient-to-br from-amber-700 to-amber-900 text-amber-50",
      green: "border-emerald-300/40 bg-gradient-to-br from-emerald-800 to-emerald-950 text-emerald-50",
      blue: "border-sky-300/40 bg-gradient-to-br from-sky-800 to-sky-950 text-sky-50",
      wild: "border-amber-200/50 bg-gradient-to-br from-[#14532d] via-[#78350f] to-[#1e3a8a] text-amber-100",
      hiddenStyle: "border-2 border-amber-300/40 bg-gradient-to-br from-emerald-950 to-[#3f2a12] shadow-xl",
    },
  },
  { id: "warden-of-the-woods", name: "Warden of the Woods", icon: "🌲", price: 6000, tier: "legend", kind: "title", label: "Warden of the Woods", blurb: "The forest answers to you alone." },
  // UNO card skins (colour hues preserved so play stays readable)
  {
    id: "pastel-deck", name: "Pastel Deck", icon: "🍬", price: 300, tier: "lodge", kind: "uno-card-skin", rental: { hours: 24 }, permanentPrice: 800,
    blurb: "Soft springtime colours for one day of gentle Uno.",
    cardStyles: {
      red: "bg-rose-400 text-white",
      yellow: "bg-amber-200 text-amber-950",
      green: "bg-lime-400 text-emerald-950",
      blue: "bg-sky-400 text-white",
      wild: "bg-[conic-gradient(#fb7185_0_25%,#fde047_0_50%,#a3e635_0_75%,#38bdf8_0_100%)] text-slate-950",
    },
    hiddenStyle: "border-2 border-rose-300/60 bg-gradient-to-br from-rose-950 to-sky-900 shadow-xl",
  },
  {
    id: "midnight-deck", name: "Midnight Deck", icon: "🌙", price: 1400, tier: "trophy", kind: "uno-card-skin",
    blurb: "Deep-forest night tones with glowing pips.",
    cardStyles: {
      red: "bg-rose-950 text-rose-300",
      yellow: "bg-amber-950 text-amber-300",
      green: "bg-emerald-950 text-emerald-300",
      blue: "bg-sky-950 text-sky-300",
      wild: "bg-[conic-gradient(#4c0519_0_25%,#451a03_0_50%,#022c22_0_75%,#082f49_0_100%)] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
    },
    hiddenStyle: "border-2 border-indigo-300/50 bg-gradient-to-br from-slate-950 to-indigo-950 shadow-xl",
  },
  {
    id: "maple-deck", name: "Maple Deck", icon: "🍁", price: 1600, tier: "trophy", kind: "uno-card-skin",
    blurb: "Autumn harvest colours, yours forever.",
    cardStyles: {
      red: "bg-red-800 text-white",
      yellow: "bg-amber-500 text-amber-950",
      green: "bg-emerald-800 text-white",
      blue: "bg-indigo-700 text-white",
      wild: "bg-[conic-gradient(#991b1b_0_25%,#d97706_0_50%,#065f46_0_75%,#3730a3_0_100%)] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
    },
    hiddenStyle: "border-2 border-amber-300/50 bg-gradient-to-br from-amber-950 to-red-950 shadow-xl",
  },
  {
    id: "royal-deck", name: "Royal Deck", icon: "👑", price: 1000, tier: "legend", kind: "uno-card-skin", rental: { hours: 168 }, permanentPrice: 3200,
    blurb: "A week of playing Uno like royalty.",
    cardStyles: {
      red: "bg-rose-600 text-white",
      yellow: "bg-yellow-300 text-yellow-950",
      green: "bg-emerald-600 text-white",
      blue: "bg-blue-700 text-white",
      wild: "bg-[conic-gradient(#7e22ce_0_25%,#a16207_0_50%,#047857_0_75%,#1d4ed8_0_100%)] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
    },
    hiddenStyle: "border-2 border-purple-300/50 bg-gradient-to-br from-purple-950 to-blue-950 shadow-xl",
  },
  // Craps dice (pip colours only — die bodies stay white for readable pips)
  {
    id: "frost-dice", name: "Frost Dice", icon: "🧊", price: 350, tier: "lodge", kind: "craps-dice", rental: { hours: 24 }, permanentPrice: 950,
    blurb: "Icy blue pips for a day of cold rolls.",
    diceStyles: { pip: "bg-sky-600", acePip: "bg-sky-500" },
  },
  {
    id: "maple-dice", name: "Maple Dice", icon: "🍁", price: 700, tier: "trophy", kind: "craps-dice", rental: { hours: 168 }, permanentPrice: 2000,
    blurb: "Autumn red pips for one warm week at the craps table.",
    diceStyles: { pip: "bg-red-700", acePip: "bg-amber-600" },
  },
  {
    id: "moonlit-dice", name: "Moonlit Dice", icon: "🌙", price: 900, tier: "legend", kind: "craps-dice",
    blurb: "Deep indigo pips, yours every roll forever.",
    diceStyles: { pip: "bg-indigo-800", acePip: "bg-purple-500" },
  },
  // Roulette wheels (pocket hues stay distinct so bets stay readable)
  {
    id: "glacier-wheel", name: "Glacier Wheel", icon: "🧊", price: 400, tier: "lodge", kind: "roulette-wheel", rental: { hours: 24 }, permanentPrice: 1100,
    blurb: "Chilled pockets and a birwood rim for one day.",
    wheelStyles: {
      pockets: { red: "#e11d48", black: "#312e81", green: "#10b981" },
      woodFrom: "#94a3b8", woodTo: "#475569",
      trackFrom: "#082f49", trackTo: "#155e75",
      accent: "#67e8f9", spoke: "#a5f3fc",
    },
  },
  {
    id: "aurora-wheel", name: "Aurora Wheel", icon: "🌌", price: 2600, tier: "trophy", kind: "roulette-wheel",
    blurb: "Northern-lights palette, yours through every freeze-out.",
    wheelStyles: {
      pockets: { red: "#db2777", black: "#134e4a", green: "#84cc16" },
      woodFrom: "#312e81", woodTo: "#1e1b4b",
      trackFrom: "#1e1b4b", trackTo: "#4c1d95",
      accent: "#e879f9", spoke: "#f0abfc",
    },
  },
  // Blackjack tables (felt + face-down card back)
  {
    id: "cabin-felt", name: "Cabin Felt", icon: "🏕️", price: 300, tier: "lodge", kind: "blackjack-table", rental: { hours: 24 }, permanentPrice: 850,
    blurb: "Wool-lined cabin felt with a plaid card back, for a day.",
    tableStyles: {
      feltClass: "border-red-300/10 bg-[#4a2c1a]/80",
      cardBackClass: "border-2 border-amber-300/50 bg-gradient-to-br from-red-900 to-amber-950 shadow-xl",
      cardBackIcon: "🏕️",
    },
  },
  {
    id: "midnight-felt", name: "Midnight Felt", icon: "🃏", price: 1300, tier: "trophy", kind: "blackjack-table",
    blurb: "Starlit navy felt and a joker-back deck, forever.",
    tableStyles: {
      feltClass: "border-indigo-300/20 bg-[#1e1b4b]/80",
      cardBackClass: "border-2 border-indigo-200/60 bg-gradient-to-br from-indigo-950 to-slate-950 shadow-xl",
      cardBackIcon: "🃏",
    },
  },
  {
    id: "moose-crest-felt", name: "Moose Crest Felt", icon: "🫎", price: 1800, tier: "legend", kind: "blackjack-table", passReward: true,
    blurb: "A lodge-green felt stamped with the moose crest. Premium Alces Pass level 30.",
    tableStyles: {
      feltClass: "border-emerald-200/15 bg-[#1d3a25]/85",
      cardBackClass: "border-2 border-amber-300/40 bg-gradient-to-br from-emerald-950 to-[#3f2a12] shadow-xl",
      cardBackIcon: "🫎",
    },
  },
  {
    id: "maple-frost-wheels", name: "Maple Frost Wheel", icon: "🍁", price: 2000, tier: "legend", kind: "roulette-wheel", passReward: true,
    blurb: "An amber-on-ice wheel that spins like late October. Premium Alces Pass level 25.",
    wheelStyles: {
      pockets: { red: "#b45309", black: "#1c1917", green: "#15803d" },
      woodFrom: "#d97706", woodTo: "#7c2d12",
      trackFrom: "#0c4a6e", trackTo: "#1e3a8a",
      accent: "#fbbf24", spoke: "#fde68a",
    },
  },
  // Voyager set — the Alces Pass level-1 premium starter reward. Pass-exclusive: never sold in the shop.
  {
    id: "voyager-badge", name: "Voyager Badge", icon: "🛶", price: 900, tier: "lodge", kind: "badge", passReward: true,
    blurb: "Paddle in hand at dawn. Premium Alces Pass level 1 starting-set piece.",
  },
  {
    id: "voyager-title", name: "Voyager Title", icon: "🛶", price: 1100, tier: "lodge", kind: "title", label: "Voyager", passReward: true,
    blurb: "First over the portage, first to the table. Premium Alces Pass level 1 starting-set piece.",
  },
  {
    id: "lord-nelson-badge", name: "Lord Nelson Badge", icon: "⚓", price: 3500, tier: "legend", kind: "badge", passReward: true,
    blurb: "England expects. Alces Pass level 40 reward.",
  },
  {
    id: "lord-nelson-title", name: "Lord Nelson Title", icon: "⚓", price: 4000, tier: "legend", kind: "title", label: "Lord Nelson", passReward: true,
    blurb: "Every hand is Trafalgar. Alces Pass level 40 reward.",
  },
  {
    id: "lord-nelson-card-skin", name: "Nelson Navy Deck", icon: "⚓", price: 1400, tier: "legend", kind: "uno-card-skin", passReward: true,
    blurb: "Admiral's navy and gold for every card you play.",
    cardStyles: {
      red: "bg-rose-500 text-white",
      yellow: "bg-amber-400 text-amber-950",
      green: "bg-emerald-600 text-white",
      blue: "bg-blue-700 text-white",
      wild: "bg-[conic-gradient(#dc2626_0_25%,#ca8a04_0_50%,#047857_0_75%,#1d4ed8_0_100%)] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
    },
    hiddenStyle: "border-2 border-amber-300/60 bg-gradient-to-br from-blue-950 to-sky-950 shadow-xl",
  },
  {
    id: "lord-nelson-dice", name: "Nelson Dice", icon: "⚓", price: 1100, tier: "legend", kind: "craps-dice", passReward: true,
    blurb: "Signal-flag pips for rolls worthy of a broadside.",
    diceStyles: { pip: "bg-blue-800", acePip: "bg-amber-500" },
  },
  {
    id: "lord-nelson-wheel", name: "Nelson Wheel", icon: "⚓", price: 2800, tier: "legend", kind: "roulette-wheel", passReward: true,
    blurb: "Gilded navy wheel that never breaks position.",
    wheelStyles: {
      pockets: { red: "#dc2626", black: "#0f172a", green: "#15803d" },
      woodFrom: "#92400e", woodTo: "#3f2412",
      trackFrom: "#0a1f44", trackTo: "#1e3a8a",
      accent: "#f59e0b", spoke: "#fcd34d",
    },
  },
  {
    id: "lord-nelson-table", name: "Nelson Table", icon: "⚓", price: 1500, tier: "legend", kind: "blackjack-table", passReward: true,
    blurb: "Deep navy felt under a gold anchor card back.",
    tableStyles: {
      feltClass: "border-amber-300/20 bg-[#0a1f44]/80",
      cardBackClass: "border-2 border-amber-300/60 bg-gradient-to-br from-blue-950 to-amber-900 shadow-xl",
      cardBackIcon: "⚓",
    },
  },
];

export function findCosmetic(id: string): CosmeticItem | null {
  return COSMETIC_CATALOG.find((item) => item.id === id) ?? null;
}

/** Filter type marker: `true` = Alces Pass rewards only (never sold), `false` = gift shop stock. */
export const SHOP_CATALOG = COSMETIC_CATALOG.filter((item) => !item.passReward);
export const PASS_CATALOG = COSMETIC_CATALOG.filter((item) => item.passReward);

/** Price charged for one rental term; falls back to the legacy single-price field. */
export function rentalPriceCosmetic(item: CosmeticItem): number {
  if (!item.rental) throw new Error("That item is not offered as a rental.");
  return item.rental.price ?? item.price;
}

/** One-off price to own an item forever; rentable items must set it explicitly via `permanentPrice`. */
export function permanentPriceCosmetic(item: CosmeticItem): number {
  if (item.rental) {
    if (item.permanentPrice == null) throw new Error(`The ${item.name} is rental-only.`);
    return item.permanentPrice;
  }
  return item.price;
}

/** Titles only — used when verifying a title cosmetic pass. */
export function findCosmeticTitle(id: string) {
  const item = findCosmetic(id);
  return item && item.kind === "title" && item.label ? { id: item.id, label: item.label, icon: item.icon } : null;
}

/** Fallback wheel palette matching the untouched roulette room; game pages start here before a
    skin resolves, so there is no flash of themed colours. */
export const DEFAULT_WHEEL: CosmeticWheelStyles = {
  pockets: { red: "#b91c1c", black: "#111827", green: "#047857" },
  woodFrom: "#6b4423", woodTo: "#2a1608",
  trackFrom: "#0b1d33", trackTo: "#1e3a5f",
  accent: "#fbbf24", spoke: "#fde68a",
};
