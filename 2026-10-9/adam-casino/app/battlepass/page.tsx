"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { kindLabels, findCosmetic, type CosmeticSlot } from "@/lib/cosmeticsCatalog";
import { BATTLEPASS_LEVELS, PREMIUM_LEVEL } from "@/lib/battlepassConstants";
import { CosmeticPreview } from "@/app/cosmeticPreview";
import { fetchBankingBalance, getStoredBankingCredentials, storeBankingCredentials, useBankingBalance } from "@/lib/banking";

type RewardView =
  | { kind: "moose-bucks"; amount: number }
  | { kind: "cosmetic"; cosmeticId: string; name: string; icon: string; slot: CosmeticSlot; passExclusive: boolean }
  | { kind: "premium-set"; setId: string; label: string; blurb: string; items: { cosmeticId: string; name: string; icon: string; slot: CosmeticSlot; passExclusive: true }[] };

type PassLevelView = {
  level: number;
  reached: boolean;
  free: RewardView;
  premium: RewardView | null;
  freeClaimed: boolean;
  premiumClaimed: boolean;
};

type PassView = {
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

function rewardLabel(reward: RewardView): string {
  if (reward.kind === "moose-bucks") return `${reward.amount.toLocaleString()} moose bucks`;
  if (reward.kind === "cosmetic") return `${reward.icon} ${reward.name}`;
  return `${reward.items[0]?.icon ?? "✨"} ${reward.label}`;
}

export default function BattlePassPage() {
  const [balance, setBalance] = useBankingBalance();
  const [pass, setPass] = useState<PassView | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [preview, setPreview] = useState<RewardView | null>(null);

  const loadPass = useCallback(async () => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) {
      setPass(null);
      return;
    }
    try {
      const response = await fetch(`/api/battlepass?username=${encodeURIComponent(credentials.username)}`, { cache: "no-store" });
      const body = await response.json() as PassView & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load your pass.");
      setPass(body);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load your pass.");
    }
  }, []);

  useEffect(() => {
    setConnected(getStoredBankingCredentials() !== null);
    void loadPass();
  }, [loadPass]);

  async function act(postBody: Record<string, unknown>, successMessage: string) {
    const credentials = getStoredBankingCredentials();
    if (!credentials) {
      setTone("error");
      setMessage("Connect your banking account first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/battlepass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: credentials.username, password: credentials.password, ...postBody }),
      });
      const body = await response.json() as { view?: PassView; error?: string };
      if (!response.ok || !body.view) throw new Error(body.error || "The Alces Pass could not process that.");
      setPass(body.view);
      setTone("ok");
      setMessage(successMessage);
      setBalance(await fetchBankingBalance(credentials.username));
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "The Alces Pass could not process that.");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const nextBalance = await fetchBankingBalance(username.trim());
      storeBankingCredentials({ username: username.trim(), password });
      setBalance(nextBalance);
      setConnected(true);
      setTone("ok");
      setMessage("Banking account connected.");
      setPassword("");
      await loadPass();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Could not verify that banking account.");
    } finally {
      setBusy(false);
    }
  }

  const ladderLevels = Array.from({ length: BATTLEPASS_LEVELS }, (_, index) => BATTLEPASS_LEVELS - index);
  const progressPercent = pass ? Math.min(100, Math.round(((pass.level - 1) + pass.xpIntoLevel / pass.xpForNextLevel) / (pass.levelsTotal - 1) * 100)) : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,_rgba(251,191,36,0.22),_transparent_32%),radial-gradient(circle_at_0%_70%,_rgba(59,130,246,0.18),_transparent_36%)]" />
      <nav className="relative mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Alces Casino home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400 text-2xl text-[#071426] shadow-[0_0_24px_rgba(251,191,36,0.35)]">⚓</span>
          <span className="font-serif text-xl font-bold tracking-wide">The Alces Pass</span>
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
            <p className="text-sm leading-6 text-sky-100/65">Sign in with your moose bucks account to start earning pass XP from every bet you place at the casino.</p>
            <input aria-label="Banking username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} className="rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-white outline-none focus:border-amber-400" required />
            <input aria-label="Banking password" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-white outline-none focus:border-amber-400" required />
            <button type="submit" disabled={busy} className="rounded-lg bg-amber-400 px-4 py-2.5 font-bold text-[#071426] hover:bg-amber-300 disabled:opacity-50">Verify account</button>
            {message && <p role="status" className={`text-xs ${tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message}</p>}
          </form>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300/70">Season progress</p>
                  <p className="mt-1 font-serif text-3xl font-bold">Level {pass?.level ?? 1} <span className="text-base font-normal text-sky-100/55">of {pass?.levelsTotal ?? BATTLEPASS_LEVELS}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-sky-100/55">Season XP</p>
                  <p className="font-serif text-3xl font-bold text-amber-300">{(pass?.xp ?? 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-950/60">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-sky-100/55">{pass?.xpIntoLevel ?? 0} / {pass?.xpForNextLevel ?? 250} XP into this level — every moose buck you stake at any table earns 1 XP. Progress and rewards live on the server, so refreshing or switching devices never loses them.</p>
              {pass && !pass.premiumUnlocked && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-400/[0.08] p-4">
                  <div>
                    <p className="font-serif text-lg font-bold text-amber-200">Premium track</p>
                    <p className="max-w-md text-xs text-sky-100/60">Extra rewards on every level from 1 up — the Voyager starter set right away, capped by the full Lord Nelson set at level {PREMIUM_LEVEL}: the badge, the title, and a skin for every cosmetic game.</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void act({ action: "buy-premium" }, "Premium pass unlocked — the premium track is yours.")} className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-[#071426] hover:bg-amber-300 disabled:opacity-50">
                    Unlock · {pass.premiumPrice.toLocaleString()} moose bucks
                  </button>
                </div>
              )}
              {pass?.premiumUnlocked && (
                <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/[0.08] p-4 text-sm font-bold text-amber-200">⚓ Premium pass active — claim premium rewards as you level.</p>
              )}
            </div>
            {message && <p role="status" className={`mt-4 text-sm ${tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{message}</p>}
            {pass && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-[64px_1fr_1fr] items-stretch border-b border-white/10 bg-slate-950/60 text-[10px] font-bold uppercase tracking-widest text-sky-100/50">
                  <div className="px-3 py-3">Level</div>
                  <div className="border-l border-white/10 px-3 py-3">Free track</div>
                  <div className="border-l border-white/10 px-3 py-3 bg-amber-400/[0.06]">Premium track</div>
                </div>
                {ladderLevels.map((level) => {
                  const row = pass.tracks.find((entry) => entry.level === level)!;
                  const setLevel = row.premium?.kind === "premium-set";
                  return (
                    <div key={level} className={`grid grid-cols-[64px_1fr_1fr] items-center border-b border-white/5 text-sm ${setLevel ? "bg-amber-400/[0.1]" : row.reached ? "" : "opacity-45"}`}>
                      <div className={`px-3 py-3 font-serif text-base font-bold ${row.reached ? "text-amber-300" : "text-sky-100/50"}`}>{level}</div>
                      <div className="border-l border-white/10 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate">
                            <RewardChip reward={row.free} onPreview={setPreview} />
                          </span>
                          {row.freeClaimed ? (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Claimed</span>
                          ) : row.reached ? (
                            <button type="button" disabled={busy} onClick={() => void act({ action: "claim", level, track: "free" }, `Level ${level} free reward claimed.`)} className="rounded-lg bg-sky-400 px-2.5 py-1.5 text-xs font-bold text-[#071426] hover:bg-sky-300 disabled:opacity-50">Claim</button>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-100/40">Locked</span>
                          )}
                        </div>
                      </div>
                      <div className={`border-l border-white/10 px-3 py-2.5 ${setLevel ? "bg-amber-400/[0.08]" : ""}`}>
                        {row.premium === null ? (
                          <span className="text-sky-100/35">—</span>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className={`min-w-0 truncate ${setLevel ? "font-bold text-amber-200" : ""}`}>
                              <RewardChip reward={row.premium} premium={setLevel} onPreview={setPreview} />
                            </span>
                            {row.premiumClaimed ? (
                              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Claimed</span>
                            ) : row.reached && pass.premiumUnlocked ? (
                              <button type="button" disabled={busy} onClick={() => void act({ action: "claim", level, track: "premium" }, `Level ${level} premium reward claimed.`)} className="rounded-lg bg-amber-400 px-2.5 py-1.5 text-xs font-bold text-[#071426] hover:bg-amber-300 disabled:opacity-50">Claim</button>
                            ) : !pass.premiumUnlocked ? (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-100/40">Premium</span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-100/40">Locked</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-10 text-xs leading-6 text-sky-100/45">XP is earned from staked moose bucks on settled bets — winning and losing both earn season XP, so the pass always pays something back. Pass cosmetics are exclusive to the Alces Pass: they are never sold in the gift shop, and claimed cosmetics are equipped from your locker.</p>
          </>
        )}
      </section>
      {preview && (
        <RewardPreviewModal reward={preview} onClose={() => setPreview(null)} />
      )}
    </main>
  );
}

/** Clickable cosmetic reward: opens the full preview modal. */
function RewardChip({ reward, premium, onPreview }: { reward: RewardView; premium?: boolean; onPreview: (reward: RewardView) => void }) {
  if (reward.kind === "cosmetic") {
    return (
      <button
        type="button"
        onClick={() => onPreview(reward)}
        className="group flex min-w-0 items-center gap-1 truncate rounded-lg px-1 py-0.5 text-left hover:bg-white/10"
        title={`Preview ${reward.name}`}
      >
        <span aria-hidden="true">{reward.icon}</span>
        <span className="truncate">{reward.name}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-widest text-sky-100/40">{kindLabels[reward.slot]}</span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-sky-200/0 transition group-hover:text-sky-200">🔍</span>
      </button>
    );
  }
  if (reward.kind === "premium-set") {
    return (
      <button
        type="button"
        onClick={() => onPreview(reward)}
        className="group flex min-w-0 items-center gap-1 truncate rounded-lg px-1 py-0.5 text-left hover:bg-white/10"
        title={`Preview ${reward.label}`}
      >
        <span aria-hidden="true">{reward.items[0]?.icon ?? "✨"}</span>
        <span className={`truncate ${premium ? "font-bold text-amber-200" : ""}`}>{reward.label}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-widest text-sky-100/40">{reward.items.length} cosmetics</span>
        <span aria-hidden="true" className="shrink-0 text-[10px] text-sky-200/0 transition group-hover:text-sky-200">🔍</span>
      </button>
    );
  }
  return <span className="truncate">{rewardLabel(reward)}</span>;
}

function RewardPreviewModal({ reward, onClose }: { reward: RewardView; onClose: () => void }) {
  const cosmeticIds =
    reward.kind === "cosmetic" ? [reward.cosmeticId]
    : reward.kind === "premium-set" ? reward.items.map((item) => item.cosmeticId)
    : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Reward preview">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-300/30 bg-[#0b1f35] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-2xl font-bold text-amber-200">{reward.kind === "moose-bucks" ? "Moose bucks" : reward.kind === "premium-set" ? reward.label : reward.name}</h2>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-2.5 py-1 text-sm font-bold hover:bg-white/20" aria-label="Close preview">✕</button>
        </div>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-sky-100/50">
          {reward.kind === "moose-bucks"
            ? "Alces Pass reward"
            : reward.kind === "premium-set"
              ? `Alces Pass ${reward.setId === "voyager" ? "level 1 · premium starter set" : `level ${PREMIUM_LEVEL} · premium set`}`
              : `Alces Pass reward · ${kindLabels[reward.slot]}`}
        </p>
        {reward.kind === "moose-bucks" ? (
          <p className="mt-4 font-serif text-3xl font-bold text-emerald-300">{reward.amount.toLocaleString()} moose bucks</p>
        ) : (
          <>
            {reward.kind === "premium-set" && (
              <p className="mt-2 text-sm text-sky-100/70">{reward.blurb}</p>
            )}
            <div className="mt-4 flex flex-col gap-3">
              {cosmeticIds.map((id) => {
                const item = findCosmetic(id);
                if (!item) return null;
                return (
                  <div key={id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
                    <CosmeticPreview itemId={id} size="lg" />
                    <div className="min-w-0">
                      <p className="font-bold">{item.name}</p>
                      <p className="text-xs text-sky-100/55">{kindLabels[item.kind]}</p>
                      {item.blurb && <p className="mt-0.5 text-xs text-sky-100/55">{item.blurb}</p>}
                      {item.kind === "title" && item.label && (
                        <p className="mt-1 font-serif text-lg text-white">{item.icon} {item.label}</p>
                      )}
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-300/80">Alces Pass exclusive</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="mt-4 text-xs leading-5 text-sky-100/45">Claim it from the ladder once you reach the level, then equip it from your locker.</p>
      </div>
    </div>
  );
}
