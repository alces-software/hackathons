"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Category = "Consensus" | "Tech" | "Entertainment" | "Markets" | "Sports";
type View = "Discover" | "Trending" | "My portfolio" | "Activity";
type Market = {
  id: string;
  category: Category;
  title: string;
  volume: string;
  accent: string;
  outcomes: string[];
  outcomePrices: number[];
};
type Position = {
  marketId: string;
  title: string;
  outcome: string;
  shares: number;
  amount: number;
  payout: number | null;
  status: string;
  result: "win" | "loss" | null;
  placedAt: string;
};
type SessionUser = { id: number; displayName: string; bookieUsername: string | null };

const categories: Array<{ name: Category; color: string }> = [
  { name: "Consensus", color: "green" },
];

const initialMarkets: Market[] = [
  { id: "office-quiz-winner", category: "Consensus", title: "Which team will win the next office quiz?", volume: "84.2k", accent: "pine", outcomes: ["Yes", "No"], outcomePrices: [0.68, 0.5] },
];

const navItems: Array<[string, View]> = [["⌂", "Discover"], ["◈", "Trending"], ["▣", "My portfolio"], ["◷", "Activity"]];

export default function Home() {
  const [view, setView] = useState<View>("Discover");
  const [category, setCategory] = useState<Category | null>(null);
  const [markets, setMarkets] = useState(initialMarkets);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { user?: SessionUser | null };
        if (data.user) {
          setUser(data.user);
          if (data.user.bookieUsername) {
            refreshBalance();
            refreshPositions();
          }
        }
      })
      .catch(() => undefined);
    fetch("/api/markets")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { markets?: Market[] };
        if (data.markets?.length) setMarkets(data.markets);
      })
      .catch(() => {
        setStatus({ type: "error", message: "Could not load saved markets. Showing the starter markets instead." });
      });
  }, []);

  const visibleMarkets = useMemo(() => markets.filter((market) => {
    const matchesCategory = !category || market.category === category;
    const matchesSearch = market.title.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesSearch;
  }), [category, markets, query]);

  function navigate(nextView: View) {
    setView(nextView);
    setCategory(null);
    setStatus(null);
    setShowCreate(false);
  }

  function openCategory(nextCategory: Category) {
    setView("Discover");
    setCategory(nextCategory);
    setStatus(null);
  }

  function openPrediction(marketId: string, outcome: string) {
    // Betting happens on the market page only; the home cards just deep-link there.
    router.push(`/market/${marketId}?outcome=${encodeURIComponent(outcome)}`);
  }

  function refreshBalance() {
    fetch("/api/balance")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { balance?: number };
        if (typeof data.balance === "number") setBalance(data.balance);
      })
      .catch(() => undefined);
  }

  function refreshPositions() {
    fetch("/api/positions")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { positions?: Position[] };
        if (data.positions) setPositions(data.positions);
      })
      .catch(() => undefined);
  }

  function handleSignedIn(nextUser: SessionUser) {
    setUser(nextUser);
    setShowAccount(false);
    if (nextUser.bookieUsername) {
      refreshBalance();
      refreshPositions();
    }
    setStatus({ type: "success", message: `Welcome to the herd, ${nextUser.displayName}.` });
  }

  function handleLinked(nextUser: SessionUser) {
    setUser(nextUser);
    setShowAccount(false);
    refreshBalance();
    refreshPositions();
    setStatus({ type: "success", message: "Bookie account linked. Your moose bucks are live." });
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setSigningOut(false);
    }
    setUser(null);
    setBalance(null);
    setPositions([]);
    setShowAccount(false);
    setStatus({ type: "success", message: "Signed out. See you soon." });
  }

  function addMarket(market: Market) {
    setMarkets((current) => [market, ...current]);
    setShowCreate(false);
    setView("Discover");
    setStatus({ type: "success", message: "Market created. Your herd can start making predictions." });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("Discover")} aria-label="Alces home"><span className="brand-mark">🫎</span><span>alces</span></button>
        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Explore</p>
          {navItems.map(([icon, label]) => <button className={`nav-item ${view === label && !category ? "active" : ""}`} onClick={() => navigate(label)} key={label}><span className="nav-icon" aria-hidden="true">{icon}</span>{label}{label === "Activity" && <span className="notification-dot" />}</button>)}
        </nav>
        <nav className="primary-nav category-nav" aria-label="Market categories">
          <p className="nav-label">Topics</p>
          {categories.map((item) => <button className={`topic-link ${category === item.name ? "selected-topic" : ""}`} onClick={() => openCategory(item.name)} key={item.name}><span className={`topic-icon ${item.color}`} />{item.name}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setStatus({ type: "success", message: "Markets settle using verified data or a public Consensus vote." })}><span className="nav-icon">?</span>How it works</button>
          <button className="user-card" onClick={() => setShowAccount(true)}><span className="avatar">{user ? initials(user.displayName) : "?"}</span><span><strong>{user ? user.displayName : "Sign in"}</strong><small>{user ? (balance !== null ? `${balance.toLocaleString()} moose bucks` : user.bookieUsername ? "Loading balance…" : "Bookie account not linked") : "Create an account"}</small></span><span className="chevron">›</span></button>
          {user && <button className="nav-item sign-out" onClick={signOut} disabled={signingOut}><span className="nav-icon">⎋</span>{signingOut ? "Signing out…" : "Sign out"}</button>}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => navigate("Discover")}><span className="brand-mark">🫎</span> alces</button>
          <label className="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search markets" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search markets" /><kbd>⌘ K</kbd></label>
          <button className="icon-button" aria-label="Notifications" onClick={() => navigate("Activity")}>♧<span /></button>
          <button className="connect-button" onClick={() => setShowCreate(true)}>Make a prediction</button>
        </header>

        <div className="content-inner">
          {view === "Discover" && !category && (
            <section className="hero"><div><p className="eyebrow"><span className="live-dot" /> The wisdom of the crowd</p><h1>What do you <em>know?</em></h1><p className="hero-copy">Put your conviction to work. Trade on the outcomes that shape tomorrow.</p></div><div className="hero-art" aria-hidden="true"><span className="sun" /><span className="mountain mountain-back" /><span className="mountain mountain-front" /><span className="moose">🫎</span></div></section>
          )}

          <div className="section-heading">
            <div><p className="eyebrow">{category ?? view === "Discover" ? "Fresh from the forest" : view}</p><h2>{view === "My portfolio" ? "Your predictions" : view === "Activity" ? "Recent activity" : category ? `${category} markets` : "Markets worth watching"}</h2></div>
            <button className="view-all" onClick={() => setShowCreate(true)}>Create market <span>＋</span></button>
          </div>

          {view === "My portfolio" ? <Portfolio positions={positions} balance={balance} signedIn={Boolean(user)} linked={Boolean(user?.bookieUsername)} onOpenAccount={() => setShowAccount(true)} /> : view === "Activity" ? <Activity positions={positions} /> : <section className="market-grid" aria-label="Markets">{visibleMarkets.length ? visibleMarkets.map((market) => <MarketCard key={market.id} market={market} openPrediction={openPrediction} />) : <div className="empty-state">No markets match that search yet.</div>}</section>}
          {status && <p className={`prediction-status ${status.type}`} role="status">{status.message}</p>}
          {view === "Discover" && !category && <section className="portfolio-panel"><div><p className="eyebrow">Your outlook</p><h2>Keep an eye on your herd.</h2><p>Connect a wallet to track positions, follow markets, and earn moose bucks for being right.</p></div><button className="outline-button" onClick={() => navigate("My portfolio")}>Explore your portfolio <span>→</span></button></section>}
        </div>
      </section>
      {showCreate && <CreateMarket onClose={() => setShowCreate(false)} onCreate={addMarket} />}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} user={user} onSignedIn={handleSignedIn} onLinked={handleLinked} onSignOut={signOut} />}
    </main>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

type AccountModalProps = {
  onClose: () => void;
  user: SessionUser | null;
  onSignedIn: (user: SessionUser) => void;
  onLinked: (user: SessionUser) => void;
  onSignOut: () => void;
};

function AccountModal({ onClose, user, onSignedIn, onLinked, onSignOut }: AccountModalProps) {
  const [mode, setMode] = useState<"signin" | "register" | "link">("signin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [bookieUsername, setBookieUsername] = useState("");
  const [bookiePassword, setBookiePassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const linked = Boolean(user?.bookieUsername);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (user) {
        // Signed in: the form is the bookie-link step regardless of the leftover mode state.
        const response = await fetch("/api/auth/link-bookie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookieUsername, bookiePassword }) });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to link your bookie account.");
        onLinked({ ...user, bookieUsername });
      } else if (mode === "signin") {
        const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, password }) });
        const data = (await response.json()) as { user?: SessionUser; error?: string };
        if (!response.ok || !data.user) throw new Error(data.error ?? "Unable to sign in.");
        onSignedIn(data.user);
      } else if (mode === "register") {
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, password, passwordConfirm }) });
        const data = (await response.json()) as { user?: SessionUser; error?: string };
        if (!response.ok || !data.user) throw new Error(data.error ?? "Unable to create your account.");
        onSignedIn(data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" role="presentation"><form className="create-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="create-intro"><span className="create-icon">🫎</span><div><p className="eyebrow">{mode === "link" ? "Bookie link" : "Your account"}</p><h2>{mode === "signin" ? "Welcome back" : mode === "register" ? "Join the herd" : "Link your bookie"}</h2></div></div>{user ? (
    <>
      <p className="modal-copy">Signed in as <strong>{user.displayName}</strong>. {linked ? `Bookie account ${user.bookieUsername} is linked — trades move real moose bucks.` : "Link your existing bookie account so your predictions move your real moose bucks."}</p>
      {!linked && <div className="form-columns"><label>Bookie username<input required maxLength={25} value={bookieUsername} onChange={(event) => setBookieUsername(event.target.value)} placeholder="your-bookie-name" /></label><label>Bookie password<input required type="password" maxLength={30} value={bookiePassword} onChange={(event) => setBookiePassword(event.target.value)} placeholder="••••••••" /></label></div>}
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">{!linked && <button className="create-button" disabled={busy}>{busy ? "Linking…" : "Link bookie account"}</button>}{linked && <button type="button" className="cancel-modal" onClick={onSignOut} disabled={busy}>Sign out</button>}<button type="button" className="cancel-modal" onClick={onClose}>Close</button></div>
    </>
  ) : (
    <>
      <div className="form-columns"><label>Mode<select value={mode} onChange={(event) => { setMode(event.target.value as "signin" | "register"); setError(""); }}><option value="signin">Sign in</option><option value="register">Create account</option></select></label></div>
      <label>Name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Moose McAntlers" /></label>
      <label>Password<input required type="password" maxLength={100} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>
      {mode === "register" && <label>Confirm password<input required type="password" maxLength={100} value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="••••••••" /></label>}
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button className="create-button" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</button><button type="button" className="cancel-modal" onClick={onClose}>Cancel</button></div>
    </>
  )}</form></div>;
}

function MarketCard({ market, openPrediction }: { market: Market; openPrediction: (id: string, outcome: string) => void }) {
  return <article className="market-card"><div className="card-top"><span className={`category-pill ${market.accent}`}>{market.category}</span><button className="bookmark" aria-label={`Save ${market.title}`}>☆</button></div><h3><Link href={`/market/${market.id}`}>{market.title}</Link></h3><div className="odds-row"><span>{market.volume} traded</span></div><div className="card-actions outcome-actions">{market.outcomes.map((outcome, index) => <button className={index % 2 === 0 ? "trade-yes" : "trade-no"} onClick={() => openPrediction(market.id, outcome)} key={outcome}>{outcome} <span>{(market.outcomePrices?.[index] ?? 0.5).toFixed(2)} MB</span></button>)}</div></article>;
}

function resultBadge(result: Position["result"]): { label: string; className: string } | null {
  if (result === "win") return { label: "Win", className: "result-badge win" };
  if (result === "loss") return { label: "Loss", className: "result-badge loss" };
  return null;
}

function settledAmount(position: Position): string {
  if (position.result === "win" && position.payout !== null) return `+${position.payout.toLocaleString()} MB`;
  if (position.result === "loss") return `-${position.amount.toLocaleString()} MB`;
  return `${position.amount.toLocaleString()} MB`;
}

function Portfolio({ positions, balance, signedIn, linked, onOpenAccount }: { positions: Position[]; balance: number | null; signedIn: boolean; linked: boolean; onOpenAccount: () => void }) {
  return <section className="panel-list"><div className="balance-card"><p className="eyebrow">Available balance</p><strong>{balance !== null ? `${balance.toLocaleString()} moose bucks` : signedIn ? "Link your bookie to see your balance" : "Sign in to see your balance"}</strong><span>{linked ? "Live from your bookie account" : "Not linked yet"}</span>{!linked && <button className="outline-button" onClick={onOpenAccount}>{signedIn ? "Link bookie account" : "Sign in"}</button>}</div>{positions.length ? positions.map((position) => {
    const badge = resultBadge(position.result);
    return <Link className="list-row" href={`/market/${position.marketId}`} key={`${position.marketId}-${position.outcome}`}><span><strong>{position.title}</strong><small>{position.outcome} prediction · {position.shares.toLocaleString()} shares</small></span><span className="row-end">{badge && <em className={badge.className}>{badge.label}</em>}<b className={position.result === "win" ? "amount-win" : position.result === "loss" ? "amount-loss" : undefined}>{settledAmount(position)}</b></span></Link>;
  }) : <div className="empty-state">{signedIn ? "You have not placed any predictions yet. Choose a market to get started." : "Sign in to see your predictions."}</div>}</section>;
}

function Activity({ positions }: { positions: Position[] }) {
  return <section className="panel-list">{positions.length ? positions.map((position) => {
    const badge = resultBadge(position.result);
    const label = position.result === "win" ? "Prediction won" : position.result === "loss" ? "Prediction lost" : "Prediction placed";
    return <Link className="list-row" href={`/market/${position.marketId}`} key={`${position.marketId}-${position.outcome}-${position.placedAt}`}><span><strong>{label}</strong><small>{position.outcome} · {position.title}</small></span><span className="row-end">{badge && <em className={badge.className}>{badge.label}</em>}<b className={position.result === "win" ? "amount-win" : position.result === "loss" ? "amount-loss" : undefined}>{settledAmount(position)}</b></span></Link>;
  }) : <div className="empty-state">Your prediction activity will appear here.</div>}</section>;
}

function CreateMarket({ onClose, onCreate }: { onClose: () => void; onCreate: (market: Market) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Consensus");
  const [closesAt, setClosesAt] = useState("");
  const [outcomes, setOutcomes] = useState(["Yes", "No"]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/markets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, category: category.toLowerCase(), closesAt, outcomes }) });
      const data = (await response.json()) as { error?: string; market?: { id: string; title: string; category: Category; outcomes: string[] } };
      if (!response.ok || !data.market) throw new Error(data.error ?? "Unable to create market.");
      onCreate({ id: data.market.id, title: data.market.title, category: data.market.category, volume: "0", outcomes: data.market.outcomes ?? outcomes, accent: category === "Consensus" ? "pine" : category === "Entertainment" ? "berry" : category === "Tech" ? "sky" : "pine", outcomePrices: (data.market.outcomes ?? outcomes).map(() => 0.5) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create market.");
    } finally { setSaving(false); }
  }

  function updateOutcome(index: number, value: string) { setOutcomes((current) => current.map((outcome, outcomeIndex) => outcomeIndex === index ? value : outcome)); }
  return <div className="modal-backdrop" role="presentation"><form className="create-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}>×</button><div className="create-intro"><span className="create-icon">✦</span><div><p className="eyebrow">New market</p><h2>Ask the herd</h2></div></div><p className="modal-copy">Create a clear question with outcomes your herd can weigh in on.</p><label>Question<span className="field-hint">Be specific enough that everyone knows how to resolve it.</span><input required maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Who will win the next office quiz?" /></label><div className="form-columns"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>Trading closes<input required type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label></div><div className="outcomes-heading"><label>Possible outcomes<span className="field-hint">Add 2–8 options. Pick one when you make a prediction.</span></label><span>{outcomes.length}/8</span></div><div className="outcome-inputs">{outcomes.map((outcome, index) => <div className="outcome-input" key={index}><span>{index + 1}</span><input required maxLength={80} value={outcome} onChange={(event) => updateOutcome(index, event.target.value)} placeholder={`Outcome ${index + 1}`} />{outcomes.length > 2 && <button type="button" onClick={() => setOutcomes((current) => current.filter((_, outcomeIndex) => outcomeIndex !== index))}>×</button>}</div>)}</div>{outcomes.length < 8 && <button type="button" className="add-outcome" onClick={() => setOutcomes((current) => [...current, ""])}>＋ Add another outcome</button>}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="cancel-modal" onClick={onClose}>Cancel</button><button className="create-button" disabled={saving}>{saving ? "Creating..." : "Create market"}</button></div></form></div>;
}
