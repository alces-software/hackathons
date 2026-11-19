"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SHOP_CATALOG, COSMETIC_CATALOG as CATALOG, kindLabels, permanentPriceCosmetic, slotForKind, type CosmeticCardColor, type CosmeticSlot, type CosmeticWheelStyles, type CosmeticsTier } from "@/lib/cosmeticsCatalog";
import { fetchBankingBalance, getStoredBankingCredentials, storeBankingCredentials, useBankingBalance } from "@/lib/banking";

type OwnedCosmetic = { itemId: string; expiresAt: number | null };
type ShopInventory = {
  owned: OwnedCosmetic[];
  equippedId: string | null;
  equippedBy: Partial<Record<CosmeticSlot, string | null>>;
  badge: { id: string; icon: string } | null;
  title: { id: string; label: string; icon: string } | null;
};

// Mirrors the craps page pip layout for dice previews; value 1 shows the special ace pip.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Stand-in wheel palette for previews (and game pages before a skin resolves — no flash).
export const DEFAULT_WHEEL = {
  pockets: { red: "#b91c1c", black: "#111827", green: "#047857" },
  woodFrom: "#6b4423", woodTo: "#2a1608",
  trackFrom: "#0b1d33", trackTo: "#1e3a5f",
  accent: "#fbbf24", spoke: "#fde68a",
} as const;

export type WheelPalette = typeof DEFAULT_WHEEL;

type EquippedSummary = { caption: string; content: React.ReactNode | null };

const tierLabels: Record<CosmeticsTier, string> = {
  lodge: "Lodge classics",
  trophy: "Trophy shelf",
  legend: "Legend tier",
};

const tiers: CosmeticsTier[] = ["lodge", "trophy", "legend"];

export default function ShopPage() {
  const [balance, setBalance] = useBankingBalance();
  const [inventory, setInventory] = useState<ShopInventory | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<number | null>(null); // set in an effect so the prerender stays stable

  useEffect(() => {
    setConnected(getStoredBankingCredentials() !== null);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const loadInventory = useCallback(async () => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) {
      setInventory(null);
      return;
    }
    try {
      const response = await fetch(`/api/cosmetics?username=${encodeURIComponent(credentials.username)}`, { cache: "no-store" });
      const body = (await response.json()) as { inventory?: ShopInventory | null; error?: string };
      if (!response.ok || !body.inventory) throw new Error(body.error || "Could not load your collection.");
      setInventory(body.inventory);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load your collection.");
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const slotSummaries: EquippedSummary[] = [
    {
      caption: "Badge",
      content: inventory?.badge ? (
        <span className="mt-2 font-serif text-2xl"><span aria-hidden="true">{inventory.badge.icon}</span></span>
      ) : null,
    },
    {
      caption: "Title",
      content: inventory?.title ? (
        <span className="mt-2 font-serif text-lg text-white">{inventory.title.icon} {inventory.title.label}</span>
      ) : null,
    },
    {
      caption: "Card skin",
      content: inventory?.equippedBy["uno-card-skin"] ? (
        <span className="mt-2 flex max-w-full gap-1">
          {(Object.entries(CATALOG.find((item) => item.id === inventory.equippedBy["uno-card-skin"])?.cardStyles ?? {}) as [CosmeticCardColor, string][]).map(([color, className]) => (
            <span key={color} aria-hidden="true" className={`flex h-9 w-7 items-center justify-center rounded-md text-[10px] font-black ${className}`}>{color === "wild" ? "★" : color[0].toUpperCase()}</span>
          ))}
        </span>
      ) : null,
    },
    {
      caption: "Craps dice",
      content: inventory?.equippedBy["craps-dice"] ? (
        <span className="mt-2 flex max-w-full items-center gap-1.5">
          {(() => {
            const dice = CATALOG.find((item) => item.id === inventory.equippedBy["craps-dice"]);
            return [1, 6].map((value) => (
              <span key={value} aria-hidden="true" className="flex h-9 w-9 grid-cols-3 grid-rows-3 items-center justify-center gap-[1px] rounded-md border-2 border-sky-200/60 bg-white/90 p-[2px]">
                {(PIPS[value] ?? PIPS[1]).map((pip) => (
                  <span key={pip} className={`h-1.5 w-1.5 rounded-full ${value === 1 ? dice?.diceStyles?.acePip ?? "bg-rose-600" : dice?.diceStyles?.pip ?? "bg-slate-900"}`} />
                ))}
              </span>
            ));
          })()}
        </span>
      ) : null,
    },
    {
      caption: "Roulette wheel",
      content: inventory?.equippedBy["roulette-wheel"] ? (
        <span className="mt-2 flex max-w-full items-center gap-1.5">
          {(() => {
            const wheel = CATALOG.find((item) => item.id === inventory.equippedBy["roulette-wheel"])?.wheelStyles;
            return ["red", "black", "green"].map((pocket) => (
              <span key={pocket} aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: wheel?.pockets[pocket as keyof CosmeticWheelStyles["pockets"]] ?? DEFAULT_WHEEL.pockets[pocket as keyof CosmeticWheelStyles["pockets"]] }}>
                {pocket === "black" ? "B" : pocket === "green" ? "0" : "R"}
              </span>
            ));
          })()}
        </span>
      ) : null,
    },
    {
      caption: "Blackjack table",
      content: inventory?.equippedBy["blackjack-table"] ? (() => {
        const table = CATALOG.find((item) => item.id === inventory.equippedBy["blackjack-table"])?.tableStyles;
        return (
          <span className="mt-2 flex max-w-full items-center gap-1.5">
            <span aria-hidden="true" className={`flex h-9 w-12 items-center justify-center rounded-md text-sm ${table?.cardBackClass ?? ""}`}>{table?.cardBackIcon ?? "🫎"}</span>
            <span aria-hidden="true" className={`flex h-9 w-16 items-center justify-center rounded-md border text-[9px] font-black uppercase tracking-widest text-white/80 ${table?.feltClass ?? ""}`}>Felt</span>
          </span>
        );
      })() : null,
    },
  ];

  async function act(action: "buy", targetItemId: string, rentalHours?: number, slot?: CosmeticSlot) {
    const credentials = getStoredBankingCredentials();
    if (!credentials) {
      setTone("error");
      setMessage("Connect your banking account first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username: credentials.username, password: credentials.password, itemId: targetItemId, rentalHours, ...(slot ? { slot } : {}) }),
      });
      const body = (await response.json()) as { inventory?: ShopInventory; error?: string };
      if (!response.ok || !body.inventory) throw new Error(body.error || "The gift shop could not process that.");
      setInventory(body.inventory);
      setTone("ok");
      setMessage(
        action === "buy"
          ? "Purchase complete — cosmetics show up at the UNO, Battleships, craps, roulette and blackjack tables."
          : "Cosmetic removed.",
      );
      setBalance(await fetchBankingBalance(credentials.username));
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The gift shop could not process that.");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      // Same verify-then-store flow as BankingLogin: only real accounts get stored.
      const nextBalance = await fetchBankingBalance(username.trim());
      storeBankingCredentials({ username: username.trim(), password });
      setBalance(nextBalance);
      setConnected(true);
      setTone("ok");
      setMessage("Banking account connected.");
      setPassword("");
      await loadInventory();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not verify that banking account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,_rgba(217,70,239,0.25),_transparent_32%),radial-gradient(circle_at_0%_70%,_rgba(59,130,246,0.18),_transparent_36%)]" />
      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Alces Casino home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-400 text-2xl text-[#071426] shadow-[0_0_24px_rgba(232,121,249,0.3)]">🎁</span>
          <span className="font-serif text-xl font-bold tracking-wide">The Gift Shop</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {connected && <span className="text-emerald-300">{balance.toFixed(2)} moose bucks</span>}
          <Link href="/" className="text-sky-200 hover:text-white">← Back to the floor</Link>
        </div>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 lg:px-10">
        {!connected ? (
          <form onSubmit={login} className="mx-auto mt-10 flex max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-8">
            <h1 className="font-serif text-3xl font-bold">Connect your banking</h1>
            <p className="text-sm leading-6 text-sky-100/65">Sign in with your moose bucks account to buy badges. The account is verified before the shop opens.</p>
            <input aria-label="Banking username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} className="rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-white outline-none focus:border-fuchsia-400" required />
            <input aria-label="Banking password" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-white outline-none focus:border-fuchsia-400" required />
            <button type="submit" disabled={busy} className="rounded-lg bg-fuchsia-400 px-4 py-2.5 font-bold text-[#071426] hover:bg-fuchsia-300 disabled:opacity-50">Verify account</button>
            {message && <p role="status" className={`text-xs ${tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message}</p>}
          </form>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300/70">Your cosmetic box</p>
                <div className="sm:text-right">
                  <p className="text-xs uppercase tracking-widest text-sky-100/55">Moose bucks</p>
                  <p className="font-serif text-3xl font-bold text-emerald-300">{balance.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {slotSummaries.map((summary) => (
                  <div key={summary.caption} className="min-h-20 rounded-xl border border-white/10 bg-slate-950/40 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-100/50">{summary.caption}</p>
                    {summary.content ?? <p className="mt-2 font-serif text-lg text-sky-100/40">Nothing equipped</p>}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-sky-100/55">Equipped cosmetics appear next to your name in UNO and Battleships rooms; dice, wheel and table skins restyle the craps, roulette and blackjack rooms. Buy here, then <Link href="/locker" className="underline hover:text-white">equip from your locker</Link> — switching is always free.</p>
            </div>
            {message && <p role="status" className={`mt-4 text-sm ${tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message}</p>}
            {tiers.map((tier) => (
              <div key={tier} className="mt-10">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-300/70">{tierLabels[tier]}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SHOP_CATALOG.filter((item) => item.tier === tier).map((item) => {
                    const owned = inventory?.owned.find((entry) => entry.itemId === item.id) ?? null;
                    const equippedSlot = owned && (inventory?.equippedBy[slotForKind[item.kind]] === item.id || inventory?.equippedId === item.id);
                    return (
                      <div key={item.id} className={`flex min-h-52 flex-col rounded-2xl border p-5 ${owned ? "border-emerald-300/40 bg-emerald-400/[0.06]" : "border-white/10 bg-white/[0.06]"}`}>
                        <div className="flex items-start justify-between">
                          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.08] text-2xl">{item.icon}</span>
                          {owned && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">{equippedSlot ? "Worn" : "Owned"}</span>}
                        </div>
                        <h3 className="mt-3 font-serif text-xl font-bold">{item.name}</h3>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300/70">{kindLabels[slotForKind[item.kind]]}</p>
                        <p className="mt-1 text-xs text-sky-100/55">{item.blurb ?? (item.rental ? `Rentable · ${item.rental.hours}h` : "Yours forever")}</p>
                        {item.cardStyles && (
                          <div className="mt-2 flex gap-1.5">
                            {(Object.keys(item.cardStyles) as CosmeticCardColor[]).map((color) => (
                              <span key={color} aria-hidden="true" className={`flex h-8 w-6 items-center justify-center rounded-md text-[10px] font-black ${item.cardStyles![color]}`}>{color === "wild" ? "★" : color[0].toUpperCase()}</span>
                            ))}
                          </div>
                        )}
                        {item.diceStyles && (
                          <div className="mt-2 flex gap-1.5">
                            {[1, 6].map((value) => (
                              <span key={value} aria-hidden="true" className="flex h-8 w-8 grid-cols-3 grid-rows-3 items-center justify-center gap-[1px] rounded-md border-2 border-sky-200/60 bg-white/90 p-[2px]">
                                {(PIPS[value] ?? PIPS[1]).map((pip) => (
                                  <span key={pip} className={`h-1.5 w-1.5 rounded-full ${value === 1 ? item.diceStyles?.acePip ?? "bg-rose-600" : item.diceStyles?.pip ?? "bg-slate-900"}`} />
                                ))}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.wheelStyles && (
                          <div className="mt-2 flex items-center gap-1.5">
                            {(["red", "black", "green"] as const).map((pocket) => (
                              <span key={pocket} aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: item.wheelStyles!.pockets[pocket] }}>{pocket === "black" ? "B" : pocket === "green" ? "0" : "R"}</span>
                            ))}
                          </div>
                        )}
                        {item.tableStyles && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span aria-hidden="true" className={`flex h-8 w-14 items-center justify-center rounded-md text-sm ${item.tableStyles.cardBackClass}`}>{item.tableStyles.cardBackIcon}</span>
                            <span aria-hidden="true" className={`flex h-8 w-14 items-center justify-center rounded-md border text-[9px] font-black uppercase tracking-widest text-white/80 ${item.tableStyles.feltClass}`}>Felt</span>
                          </div>
                        )}
                        <div className="mt-auto pt-4">
                          {now !== null && owned?.expiresAt != null && (
                            <p className="mb-2 text-xs text-amber-300">Rental ends in {Math.max(0, Math.round((owned.expiresAt - now) / 3_600_000))}h</p>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            {item.rental ? (
                              <span className="text-sm font-bold text-white">
                                {item.rental.hours}h · {(item.rental.price ?? item.price).toLocaleString()}
                                <span className="text-xs font-normal text-sky-100/55"> / rent</span>
                                {item.permanentPrice != null && (
                                  <span className="ml-2 text-xs font-normal text-sky-100/55">or {item.permanentPrice.toLocaleString()} to keep</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-sm font-bold text-white">
                                {permanentPriceCosmetic(item).toLocaleString()} <span className="text-xs font-normal text-sky-100/55">moose bucks</span>
                              </span>
                            )}
                            {owned ? (
                              equippedSlot ? (
                                <span className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-300">Worn — <Link href="/locker" className="underline hover:text-emerald-200">manage in locker</Link></span>
                              ) : (
                                <Link href="/locker" className="rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-400/20">Equip in locker</Link>
                              )
                            ) : (
                              <span className="flex items-center gap-1.5">
                                {item.rental && (
                                  <button type="button" disabled={busy} onClick={() => void act("buy", item.id, item.rental?.hours)} className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-2.5 py-2 text-xs font-bold text-sky-200 hover:bg-sky-400/20 disabled:opacity-50">
                                    Rent · {(item.rental.price ?? item.price).toLocaleString()}
                                  </button>
                                )}
                                {item.rental
                                  ? item.permanentPrice != null && (
                                    <button type="button" disabled={busy} onClick={() => void act("buy", item.id, undefined)} className="rounded-lg bg-fuchsia-400 px-3 py-2 text-xs font-bold text-[#071426] hover:bg-fuchsia-300 disabled:opacity-50">
                                      Buy · {item.permanentPrice.toLocaleString()}
                                    </button>
                                  )
                                  : (
                                    <button type="button" disabled={busy} onClick={() => void act("buy", item.id, undefined)} className="rounded-lg bg-fuchsia-400 px-3 py-2 text-xs font-bold text-[#071426] hover:bg-fuchsia-300 disabled:opacity-50">
                                      Buy · {permanentPriceCosmetic(item).toLocaleString()}
                                    </button>
                                  )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="mt-10 text-xs leading-6 text-sky-100/45">Cosmetics are visual only — they never change your odds. Purchases credit the house and are final; rentals expire automatically.</p>
          </>
        )}
      </section>
    </main>
  );
}
