"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type MarketData = {
  id: string;
  title: string;
  outcomes: string[];
  status: "open" | "closed" | "resolved";
  closesAt: string;
  resolutionOutcome: string | null;
  volume: number;
  stats: Array<{ outcome: string; amount: number; bets: number; probability: number; priceMb: number }>;
  positions: Array<{ outcome: string; shares: number }>;
  history?: PricePoint[];
};

type PricePoint = { t: number; prices: Record<string, number> };
const SERIES_COLORS = ["#1f4a3a", "#5e9564", "#c8a36b", "#a93d3a", "#8aa3b5"];

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="detail-page"><p className="state-note">Following the herd…</p></main>}>
      <MarketPageInner params={params} />
    </Suspense>
  );
}

function MarketPageInner({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(0);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const latestRequest = useRef(0);

  async function loadMarket() {
    const requestId = ++latestRequest.current;
    const { id } = await params;
    const response = await fetch(`/api/markets/${id}`, { cache: "no-store" });
    const data = (await response.json()) as { market?: MarketData; error?: string };
    if (!response.ok || !data.market) throw new Error(data.error ?? "Unable to load market.");
    if (requestId !== latestRequest.current) return;
    const loaded = data.market;
    setMarket(loaded);
    // Deep link (?outcome=…) preselects the outcome the user tapped on the home card.
    const requested = searchParams.get("outcome");
    if (requested) {
      const match = loaded.outcomes.find((option) => option.toLowerCase() === requested.toLowerCase());
      if (match) setSelectedOutcome(match);
    }
    setHistory((previous) =>
      loaded.history?.length
        ? loaded.history
        : [
            ...previous.filter((point) => point.t < Date.now()),
            { t: Date.now(), prices: Object.fromEntries(loaded.stats.map((s) => [s.outcome, s.priceMb])) },
          ].slice(-17280),
    );
    setLoading(false);
  }

  async function sellShares() {
    if (!market || !selectedOutcome) return;
    setSubmitting(true);
    try {
      const sellSharesCount = Number(amount);
      const response = await fetch("/api/predictions/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, outcome: selectedOutcome, shares: sellSharesCount }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to sell shares.");
      setMessage(data.message ?? "Shares sold.");
      setSelectedOutcome(null);
      setTradeMode("buy");
      await loadMarket();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sell shares.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadMarket().catch((error) => {
        setMessage(error instanceof Error ? error.message : "Unable to load market.");
        setLoading(false);
      });
    }, 0);
    const interval = window.setInterval(() => loadMarket().catch(() => undefined), 5000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, []);

  async function placePrediction() {
    if (!market || !selectedOutcome) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, outcome: selectedOutcome, amount: Number(amount) }),
      });
      const data = (await response.json()) as { message?: string; error?: string; shares?: number };
      if (!response.ok) throw new Error(data.error ?? "Unable to place prediction.");
      setMessage(data.message ?? "Prediction placed.");
      setSelectedOutcome(null);
      await loadMarket();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to place prediction.");
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(outcome: string) {
    if (!market) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/markets/${market.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to record vote.");
      setMessage(data.message ?? "Vote recorded.");
      await loadMarket();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record vote.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="detail-page">
        <p className="state-note">Following the herd…</p>
      </main>
    );
  }
  if (!market) {
    return (
      <main className="detail-page">
        <p className="state-note error">{message}</p>
        <Link className="back-link" href="/">← Back to markets</Link>
      </main>
    );
  }

  const isClosed = market.status !== "open" || (now > 0 && new Date(market.closesAt).getTime() <= now);
  const top = leader(market.stats);
  const totalBets = market.stats.reduce((sum, stat) => sum + stat.bets, 0);
  const selectedStat = market.stats.find((stat) => stat.outcome === selectedOutcome);
  const holding = market.positions.find((position) => position.outcome.toLowerCase() === selectedOutcome?.toLowerCase())?.shares ?? 0;
  const price = selectedStat?.bets ? selectedStat.priceMb : 0.5;
  const stake = Number(amount);
  const shares = price > 0 && stake > 0 ? Math.floor(stake / price) : 0;
  const cost = Number((shares * price).toFixed(2));

  return (
    <main className="detail-page">
      <header className="detail-nav">
        <Link className="back-link" href="/">← Back to markets</Link>
        <span className="brand-mini">🫎 alces</span>
      </header>

      <div className="detail-layout">
        <section className="detail-main">
          <span className="category-pill">Consensus market</span>
          <h1>{market.title}</h1>
          <p className="detail-intro">
            The trading herd sets the odds. After the market closes, a separate herd vote decides what actually
            happened.
          </p>
          <div className={`close-banner ${isClosed ? "closed" : ""}`}>
            <span className="close-label">{isClosed ? "Trading closed" : "Trading closes in"}</span>
            <strong className="close-value">
              {isClosed ? "Cast your resolution vote" : now > 0 ? timeLeft(market.closesAt, now) : "…"}
            </strong>
            {!isClosed && <span className="close-date">{formatDate(market.closesAt)}</span>}
          </div>

          <dl className="detail-stats">
            <div><dt>Total bet</dt><dd>{market.volume.toFixed(2)} MB</dd></div>
            <div><dt>Predictions</dt><dd>{totalBets}</dd></div>
            <div><dt>Status</dt><dd className={`status status-${market.status}`}>{market.status}</dd></div>
          </dl>

          <PriceChart outcomes={market.outcomes} history={history} />
        </section>

        <aside className="prediction-panel">
          {market.status === "resolved" ? (
            <div className="resolved-card">
              <span className="eyebrow">Resolved by the herd</span>
              <h2>{market.resolutionOutcome}</h2>
              <p>This market was settled by community consensus.</p>
            </div>
          ) : isClosed ? (
            <div>
              <p className="eyebrow">What actually happened?</p>
              <h2>Cast the resolution vote</h2>
              <p className="panel-copy">Trading is over. Vote separately on the outcome that actually happened.</p>
              <div className="vote-options">
                {market.outcomes.map((outcome) => (
                  <button key={outcome} onClick={() => vote(outcome)} disabled={submitting}>
                    {outcome}
                    <span>Vote</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="trade-ticket-heading">
                <div>
                  <p className="eyebrow">Live market</p>
                  <h2>Trade the herd&apos;s view</h2>
                </div>
                <span className="live-chip"><i /> Live</span>
              </div>

              <p className="price-summary">
                {top ? <>Leading: <strong>{top.outcome}</strong> at {top.priceMb.toFixed(2)} MB</> : "No bets yet. Be the first."}
              </p>

              <div className="odds-list" role="radiogroup" aria-label="Choose an outcome">
                {market.outcomes.map((outcome) => {
                  const stat = market.stats.find((item) => item.outcome === outcome);
                  const p = stat?.probability ?? 0;
                  const selected = selectedOutcome === outcome;
                  return (
                    <button
                      key={outcome}
                      role="radio"
                      aria-checked={selected}
                      className={`odds-row ${selected ? "selected-odds" : ""}`}
                      onClick={() => setSelectedOutcome(outcome)}
                      style={{ "--fill": `${p}%` } as React.CSSProperties}
                    >
                      <span className="odds-fill" />
                      <span className="odds-name">
                        <strong>{outcome}</strong>
                        <small>{stat?.amount ?? 0} MB across {stat?.bets ?? 0} bets</small>
                      </span>
                      <span className="odds-price">
                        <b>{(stat?.priceMb ?? 0.5).toFixed(2)} MB</b>
                        {outcome === top?.outcome && <em>Leader</em>}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedOutcome && (
                <div className="detail-stake">
                  <div className="trade-mode" role="tablist" aria-label="Trade action">
                    <button
                      className={tradeMode === "buy" ? "active" : ""}
                      onClick={() => setTradeMode("buy")}
                      role="tab"
                      aria-selected={tradeMode === "buy"}
                    >
                      Buy
                    </button>
                    <button
                      className={tradeMode === "sell" ? "active" : ""}
                      onClick={() => setTradeMode("sell")}
                      role="tab"
                      aria-selected={tradeMode === "sell"}
                    >
                      Sell
                    </button>
                  </div>
                  <div className="order-summary"><span>{tradeMode === "buy" ? "Buying" : "Selling"} <strong>{selectedOutcome}</strong></span><span>Price <strong>{price.toFixed(2)} MB</strong></span></div>
                  {tradeMode === "buy" ? <label>
                    Amount to spend
                    <span className="input-with-unit"><input
                      type="number"
                      min="0.50"
                      step="0.01"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    /><b>MB</b></span>
                  </label> : <label>
                    Shares to sell
                    <span className="input-with-unit"><input
                      type="number"
                      min="1"
                      max={holding}
                      step="1"
                      inputMode="numeric"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    /><b>shares</b></span>
                  </label>}
                  {tradeMode === "buy" ? <>
                  <div className="quick-stakes">
                    {[10, 50, 100, 250].map((value) => (
                      <button key={value} type="button" onClick={() => setAmount(String(value))}>{value}</button>
                    ))}
                  </div>
                  <div className="share-preview">
                    <span><small>Whole shares</small><strong>{shares.toLocaleString()}</strong></span>
                    <span><small>Amount spent</small><strong>{cost.toFixed(2)} MB</strong></span>
                  </div>
                  <p className="payout">
                    The moose takes a small cut of every buy and the rest pools between bettors. If <strong>{selectedOutcome}</strong> wins, winners split the pool in proportion to shares held — cheap underdog shares pay out far more. If it loses, those shares pay 0.
                  </p>
                  <button className="place-button" onClick={placePrediction} disabled={submitting || shares < 1}>
                    {submitting ? "Placing order..." : `Buy ${shares.toLocaleString()} ${selectedOutcome} shares for ${cost.toFixed(2)} MB`}
                  </button>
                  </> : <>
                    <div className="share-preview">
                      <span><small>You own</small><strong>{holding.toLocaleString()} shares</strong></span>
                      <span><small>You receive</small><strong>{(Number(amount) * price).toFixed(2)} MB</strong></span>
                    </div>
                    <button className="place-button sell-button" onClick={sellShares} disabled={submitting || holding < 1 || !Number.isInteger(Number(amount)) || Number(amount) < 1 || Number(amount) > holding}>
                      {submitting ? "Selling..." : `Sell ${Number(amount) || 0} shares for ${(Number(amount) * price).toFixed(2)} MB`}
                    </button>
                  </>}
                </div>
              )}

              <p className="ticket-note">Prices reflect the herd&apos;s current consensus — the more the herd agrees, the more expensive a share gets (no ceiling). Winners split the pooled funds; losing shares pay 0. The house moose keeps a small cut of every buy.</p>
            </div>
          )}
          {message && <p className="detail-message" role="status">{message}</p>}
        </aside>
      </div>
    </main>
  );
}

const CHART = { W: 460, H: 220, L: 36, R: 14, T: 10, B: 22 };

function PriceChart({ outcomes, history }: { outcomes: string[]; history: PricePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [range, setRange] = useState<"15m" | "1h" | "6h" | "all">("all");
  const { W, H, L, R, T, B } = CHART;

  if (history.length === 0) {
    return (
      <div className="price-chart">
        <h2>Price history</h2>
        <p className="chart-empty">Price history will appear when the first prediction is placed.</p>
      </div>
    );
  }

  const latestTime = history[history.length - 1].t;
  const cutoff = range === "all" ? 0 : latestTime - ({ "15m": 15, "1h": 60, "6h": 360 }[range] * 60 * 1000);
  const visibleHistory = history.filter((point) => point.t >= cutoff);
  const chartHistory = visibleHistory.length === 1
    ? [visibleHistory[0], { ...visibleHistory[0], t: visibleHistory[0].t + 1 }]
    : visibleHistory.length > 0 ? visibleHistory : [history[history.length - 1]];
  const t0 = chartHistory[0].t;
  const span = Math.max(chartHistory[chartHistory.length - 1].t - t0, 1);
  const x = (t: number) => L + ((t - t0) / span) * (W - L - R);
  const maxPrice = Math.max(1, Math.ceil(Math.max(...chartHistory.flatMap((point) => Object.values(point.prices)), 0.5) * 2) / 2);
  const y = (v: number) => T + (1 - v / maxPrice) * (H - T - B);
  const value = (point: PricePoint, outcome: string) => {
    const recorded = point.prices[outcome];
    if (recorded !== undefined && Object.values(point.prices).some((price) => price > 0)) {
      return recorded;
    }
    return 0.5;
  };
  const activeIndex = hover ?? chartHistory.length - 1;
  const active = chartHistory[activeIndex];
  const clock = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const target = t0 + ((px - L) / (W - L - R)) * span;
    let best = 0;
    chartHistory.forEach((point, i) => {
      if (Math.abs(point.t - target) < Math.abs(chartHistory[best].t - target)) best = i;
    });
    setHover(best);
  }

  return (
    <div className="price-chart">
      <div className="chart-heading">
        <h2>Price history</h2>
        <div className="chart-range" role="group" aria-label="Chart history range">
          {(["15m", "1h", "6h", "all"] as const).map((option) => (
            <button key={option} className={range === option ? "selected-range" : ""} onClick={() => { setRange(option); setHover(null); }}>
              {option === "all" ? "All" : option}
            </button>
          ))}
        </div>
      </div>
      <svg
        className="price-chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Price of each outcome over time"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const tick = maxPrice * fraction;
          return (
          <g key={tick}>
            <line className="grid-line" x1={L} x2={W - R} y1={y(tick)} y2={y(tick)} />
            <text className="axis-label" x={L - 6} y={y(tick) + 4} textAnchor="end">{tick.toFixed(2)} MB</text>
          </g>
          );
        })}
        <text className="axis-label" x={L} y={H - 4}>{clock(t0)}</text>
        <text className="axis-label" x={W - R} y={H - 4} textAnchor="end">{clock(chartHistory[chartHistory.length - 1].t)}</text>

        {outcomes.map((outcome, i) => (
          <polyline
            key={outcome}
            className={`price-line line-${i % 5}`}
            style={{ stroke: SERIES_COLORS[i % SERIES_COLORS.length] }}
            points={chartHistory.map((point) => `${x(point.t).toFixed(1)},${y(value(point, outcome)).toFixed(1)}`).join(" ")}
          />
        ))}

        {hover !== null && <line className="hover-line" x1={x(active.t)} x2={x(active.t)} y1={T} y2={H - B} />}
        {outcomes.map((outcome, i) => (
          <circle key={outcome} className={`price-dot dot-${i % 5}`} r={4} cx={x(active.t)} cy={y(value(active, outcome))} />
        ))}
        {outcomes.map((outcome, i) => (
          <text
            key={`${outcome}-label`}
            className="chart-line-label"
            x={x(active.t) + 8}
            y={y(value(active, outcome)) + 4}
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
          >
            {outcome}
          </text>
        ))}
      </svg>

      <div className="legend-heading"><strong>Live prices</strong><span>What the herd is paying now</span></div>
      <ul className="chart-legend" aria-label="Outcome price legend">
        {outcomes.map((outcome, i) => {
          const now = value(active, outcome);
          const delta = now - value(chartHistory[0], outcome);
          return (
            <li key={outcome}>
              <i
                className="legend-swatch"
                style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                aria-hidden="true"
              />
              <span><strong>{outcome}</strong><small>Matches the {outcome} line</small></span>
              <b>{now.toFixed(2)} MB</b>
              <em className={delta > 0 ? "up" : delta < 0 ? "down" : ""}>
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} {Math.abs(delta)}
              </em>
            </li>
          );
        })}
      </ul>
      <p className="chart-note">{hover === null ? "Latest prices" : `Prices at ${clock(active.t)}`}. Changes are since you opened this page.</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function timeLeft(closesAt: string, now: number) {
  const total = Math.max(0, Math.floor((new Date(closesAt).getTime() - now) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function leader(stats: MarketData["stats"]) {
  return stats.reduce<MarketData["stats"][number] | undefined>(
    (current, stat) => (!current || stat.probability > current.probability ? stat : current),
    undefined,
  );
}