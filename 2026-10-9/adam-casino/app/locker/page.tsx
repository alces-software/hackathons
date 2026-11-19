"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { COSMETIC_SLOTS, kindLabels, type CosmeticItem, type CosmeticSlot } from "@/lib/cosmeticsCatalog";
import { CosmeticPreview } from "@/app/cosmeticPreview";
import { fetchBankingBalance, getStoredBankingCredentials, storeBankingCredentials, useBankingBalance } from "@/lib/banking";

type OwnedCosmetic = { itemId: string; expiresAt: number | null };
type LockerInventory = {
  owned: OwnedCosmetic[];
  equippedId: string | null;
  equippedBy: Partial<Record<CosmeticSlot, string | null>>;
  badge: { id: string; icon: string } | null;
  title: { id: string; label: string; icon: string } | null;
};

const SLOT_ORDER: CosmeticSlot[] = [...COSMETIC_SLOTS];
const SLOT_HINT: Record<CosmeticSlot, string> = {
  badge: "Shown beside your name across the casino.",
  title: "Worn under your name in UNO and Battleships.",
  "uno-card-skin": "Colours every UNO card you play.",
  "craps-dice": "Pips on the craps table dice.",
  "roulette-wheel": "Pockets and rim of the roulette wheel.",
  "blackjack-table": "Felt and card backs at blackjack.",
};

export default function LockerPage() {
  const [balance, setBalance] = useBankingBalance();
  const [inventory, setInventory] = useState<LockerInventory | null>(null);
  const [catalog, setCatalog] = useState<CosmeticItem[]>([]);
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
  }, []);

  const loadInventory = useCallback(async () => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) {
      setInventory(null);
      setCatalog([]);
      return;
    }
    try {
      const response = await fetch(`/api/cosmetics?username=${encodeURIComponent(credentials.username)}`, { cache: "no-store" });
      const body = (await response.json()) as { catalog?: CosmeticItem[]; inventory?: LockerInventory | null; error?: string };
      if (!response.ok || !body.inventory) throw new Error(body.error || "Could not load your locker.");
      setInventory(body.inventory);
      if (body.catalog) setCatalog(body.catalog);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load your locker.");
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  async function equip(slot: CosmeticSlot | undefined, itemId: string, action: "equip" | "unequip") {
    const credentials = getStoredBankingCredentials();
    if (!credentials) return;
    await handleAction(action, credentials.username, credentials.password, itemId, slot ?? kindSlot(itemId));
  }

  function kindSlot(itemId: string): CosmeticSlot | undefined {
    const item = catalogById.get(itemId);
    return item ? (item.kind as CosmeticSlot) : undefined;
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      // Same verify-then-store flow as the shop: only real accounts get stored.
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

  async function handleAction(
    action: "equip" | "unequip",
    user: string,
    pass: string,
    itemId: string,
    slot?: CosmeticSlot,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username: user, password: pass, itemId, ...(slot ? { slot } : {}) }),
      });
      const body = (await response.json()) as { inventory?: LockerInventory; error?: string };
      if (!response.ok || !body.inventory) throw new Error(body.error || "The locker could not save that.");
      setInventory(body.inventory);
      setTone("ok");
      setMessage(action === "equip" ? "Equipped." : "Removed.");
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The locker could not save that.");
    } finally {
      setBusy(false);
    }
  }

  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const ownedLive = (inventory?.owned ?? []).filter((entry) => entry.expiresAt === null || (now !== null && entry.expiresAt > now));
  const slotEquipped = (slot: CosmeticSlot): string | null => {
    const current = inventory?.equippedBy[slot] ?? null;
    return current && ownedLive.some((entry) => entry.itemId === current) ? current : null;
  };
  const isEquippedItemId = (itemId: string) => ownedLive.some((entry) => entry.itemId === itemId) && (Object.values(inventory?.equippedBy ?? {}).includes(itemId) || inventory?.equippedId === itemId);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,_rgba(52,211,153,0.18),_transparent_34%),radial-gradient(circle_at_10%_80%,_rgba(251,191,36,0.14),_transparent_36%)]" />
      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Alces Casino home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-2xl text-[#071426] shadow-[0_0_24px_rgba(52,211,153,0.3)]">🗄️</span>
          <span className="font-serif text-xl font-bold tracking-wide">Your Locker</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {connected && <span className="text-emerald-300">{(balance ?? 0).toFixed(2)} moose bucks</span>}
          <Link href="/" className="text-sky-200 hover:text-white">← Back to the floor</Link>
        </div>
      </nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 lg:px-10">
        {!connected ? (
          <form onSubmit={login} className="mx-auto mt-10 flex max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-8">
            <h1 className="font-serif text-3xl font-bold">Connect your banking</h1>
            <p className="text-sm leading-6 text-sky-100/65">Sign in to equip the cosmetics you own, from both the gift shop and the Alces Pass.</p>
            <input aria-label="Banking username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} className="rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-400" required />
            <input aria-label="Banking password" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-400" required />
            <button type="submit" disabled={busy} className="rounded-lg bg-emerald-400 px-4 py-2.5 font-bold text-[#071426] hover:bg-emerald-300 disabled:opacity-50">Verify account</button>
            {message && <p role="status" className={`text-xs ${tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message}</p>}
          </form>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300/70">One cosmetic per slot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SLOT_ORDER.map((slot) => {
                  const equippedId = slotEquipped(slot);
                  const equippedItem = equippedId ? catalogById.get(equippedId) : undefined;
                  return (
                    <div key={slot} className={`rounded-xl border p-4 ${equippedItem ? "border-emerald-300/40 bg-emerald-400/[0.06]" : "border-white/10 bg-slate-950/40"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-100/50">{kindLabels[slot]}</p>
                          <p className="mt-0.5 text-[10px] text-sky-100/40">{SLOT_HINT[slot]}</p>
                        </div>
                        {equippedItem && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { if (equippedId) void equip(slot, equippedId, "unequip"); }}
                            className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold hover:bg-white/15 disabled:opacity-50"
                          >
                            Unequip
                          </button>
                        )}
                      </div>
                      {equippedItem ? (
                        <>
                          <p className="mt-2 font-bold">
                            <span aria-hidden="true">{equippedItem.icon}</span> {equippedItem.name}
                          </p>
                          {equippedItem.kind === "title" && equippedItem.label && (
                            <p className="mt-1 font-serif text-lg text-white">{equippedItem.icon} {equippedItem.label}</p>
                          )}
                          <div className="mt-2"><CosmeticPreview itemId={equippedItem.id} /></div>
                        </>
                      ) : (
                        <p className="mt-2 font-serif text-lg text-sky-100/40">Nothing equipped</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-sky-100/55">Equipped cosmetics appear in the rooms automatically — badges and titles next to your name in UNO and Battleships, and dice, wheel and table skins restyle the craps, roulette and blackjack rooms. Switching is always free.</p>
            </div>
            {message && <p role="status" className={`mt-4 text-sm ${tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message}</p>}
            <h2 className="mt-10 font-serif text-2xl font-bold">Everything you own</h2>
            <p className="mt-1 text-xs text-sky-100/55">Bought in the gift shop or claimed from the Alces Pass — pass cosmetics are marked as exclusive. Press equip to wear one; only one item fits each slot.</p>
            {ownedLive.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-sm text-sky-100/60">Your locker is empty. Buy cosmetics in the gift shop or claim them from the Alces Pass.</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ownedLive.map((entry) => {
                  const item = catalogById.get(entry.itemId);
                  if (!item) return null;
                  const slot = item.kind;
                  const isEquipped = slotEquipped(slot) === entry.itemId || inventory?.equippedId === entry.itemId;
                  return (
                    <div key={entry.itemId} className={`flex min-h-52 flex-col rounded-2xl border p-5 ${isEquipped ? "border-emerald-300/40 bg-emerald-400/[0.06]" : "border-white/10 bg-white/[0.06]"}`}>
                      <div className="flex items-start justify-between">
                        <CosmeticPreview itemId={entry.itemId} />
                        {item.passReward && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">Pass exclusive</span>}
                      </div>
                      <h3 className="mt-3 font-serif text-xl font-bold">{item.name}</h3>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300/70">{kindLabels[slot]}</p>
                      <p className="mt-1 text-xs text-sky-100/55">{item.blurb ?? (item.rental ? `Rentable · ${item.rental.hours}h` : "Yours forever")}</p>
                      {entry.expiresAt != null && now !== null && (
                        <p className="mt-2 text-xs text-amber-300">Rental ends in {Math.max(0, Math.round((entry.expiresAt - now) / 3_600_000))}h</p>
                      )}
                      {item.kind === "title" && item.label && (
                        <p className="mt-2 font-serif text-lg">{item.icon} {item.label}</p>
                      )}
                      <div className="mt-auto pt-4">
                        {isEquipped ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void equip(slot, entry.itemId, "unequip")}
                            className="w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-50"
                          >
                            Unequip
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void equip(slot, entry.itemId, "equip")}
                            className="w-full rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#071426] hover:bg-emerald-300 disabled:opacity-50"
                          >
                            Equip
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-10 text-xs leading-6 text-sky-100/45">The gift shop sells its own collection; the Alces Pass awards exclusive cosmetics you cannot buy. Your locker holds both.</p>
          </>
        )}
      </section>
    </main>
  );
}
