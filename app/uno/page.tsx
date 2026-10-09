"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bankingPayout, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";

type Color = "red" | "yellow" | "green" | "blue" | "wild";
type PlayColor = Exclude<Color, "wild">;
type Value = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "draw4";
type Card = { id: number; color: Color; value: Value };
type Who = "player" | "ai";
type GameMode = "ai" | "local";
type Game = {
  deck: Card[];
  player: Card[];
  ai: Card[];
  discard: Card[];
  color: PlayColor; // the colour currently in play (differs from the top card after a wild)
  turn: Who;
  started: boolean;
  winner: "You" | "AI" | "Player 2" | null;
  drawnId: number | null; // after drawing a playable card, only that card may be played (or you pass)
  message: string;
  stake: number;
  mode: GameMode;
};

const colors: PlayColor[] = ["red", "yellow", "green", "blue"];
const WIN_PROFIT_RATE = 0.95;
const colorLabels: Record<Color, string> = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue", wild: "Wild" };
const valueLabels: Record<Value, string> = { "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", skip: "⊘", reverse: "↺", draw2: "+2", wild: "★", draw4: "+4" };
const valueNames: Record<Value, string> = { "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", skip: "Skip", reverse: "Reverse", draw2: "+2", wild: "", draw4: "+4" };

// Self-contained card colours (no dependency on global CSS).
const cardStyle: Record<Color, string> = {
  red: "bg-red-600 text-white",
  yellow: "bg-yellow-400 text-slate-900",
  green: "bg-green-600 text-white",
  blue: "bg-blue-600 text-white",
  wild: "bg-[conic-gradient(#dc2626_0_25%,#facc15_0_50%,#16a34a_0_75%,#2563eb_0_100%)] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
};

const emptyGame: Game = {
  deck: [], player: [], ai: [], discard: [], color: "blue", turn: "player", started: false,
  winner: null, drawnId: null, message: "Start a new game to deal the cards.", stake: 0,
  mode: "ai",
};

function shuffle(cards: Card[]) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

function makeDeck() {
  let id = 0;
  const deck: Card[] = [];
  colors.forEach((color) => {
    deck.push({ id: id++, color, value: "0" });
    for (let copy = 0; copy < 2; copy += 1) {
      (["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"] as Value[]).forEach((value) => deck.push({ id: id++, color, value }));
    }
  });
  for (let copy = 0; copy < 4; copy += 1) {
    deck.push({ id: id++, color: "wild", value: "wild" }, { id: id++, color: "wild", value: "draw4" });
  }
  return shuffle(deck);
}

function describe(card: Card) {
  return card.color === "wild" ? `Wild${card.value === "draw4" ? " +4" : ""}` : `${colorLabels[card.color]} ${valueNames[card.value]}`;
}

function canPlay(card: Card, top: Card, activeColor: PlayColor) {
  return card.color === "wild" || card.color === activeColor || card.value === top.value;
}

function newGame(stake: number, mode: GameMode): Game {
  const shuffled = makeDeck();
  const rest = shuffled.slice(14);
  // Start on a plain number card so no action card has to be resolved before the first turn.
  const [start] = rest.splice(rest.findIndex((card) => /^\d$/.test(card.value)), 1);
  return { ...emptyGame, deck: rest, player: shuffled.slice(0, 7), ai: shuffled.slice(7, 14), discard: [start], color: start.color as PlayColor, started: true, stake, mode, message: "Your turn — play a matching card or draw." };
}

// Moves cards from the deck to a hand, reshuffling the discard pile (keeping its top card) if the deck runs out.
function drawCards(g: Game, who: Who, count: number): Game {
  let deck = [...g.deck];
  let discard = [...g.discard];
  const hand = [...g[who]];
  for (let i = 0; i < count; i += 1) {
    if (deck.length === 0) {
      if (discard.length <= 1) break;
      const top = discard[discard.length - 1];
      deck = shuffle(discard.slice(0, -1));
      discard = [top];
    }
    const card = deck.shift();
    if (card) hand.push(card);
  }
  return who === "player" ? { ...g, deck, discard, player: hand } : { ...g, deck, discard, ai: hand };
}

// Plays a card for either side and applies skip / reverse / +2 / +4 (reverse acts as a skip with two players).
function playCard(g: Game, who: Who, card: Card, chosen?: PlayColor): Game {
  const other: Who = who === "player" ? "ai" : "player";
  const opponentLabel = g.mode === "local" ? "Player 2" : "AI";
  const actor = who === "player" ? "You" : opponentLabel;
  const victim = who === "player" ? opponentLabel : "You";
  const hand = g[who].filter((item) => item.id !== card.id);
  const color: PlayColor = card.color === "wild" ? chosen ?? "blue" : card.color;
  let next: Game = { ...g, discard: [...g.discard, card], color, drawnId: null };
  next = who === "player" ? { ...next, player: hand } : { ...next, ai: hand };
  const label = describe(card) + (card.color === "wild" ? `, choosing ${colorLabels[color]}` : "");
  if (hand.length === 0) return { ...next, winner: actor, message: `${actor} played ${label} and went out.` };

  let text = `${actor} played ${label}.`;
  let skip = false;
  if (card.value === "draw2" || card.value === "draw4") {
    const amount = card.value === "draw2" ? 2 : 4;
    next = drawCards(next, other, amount);
    skip = true;
    text += ` ${victim} draw${victim === "You" ? "" : "s"} ${amount} and lose${victim === "You" ? "" : "s"} a turn.`;
  } else if (card.value === "skip" || card.value === "reverse") {
    skip = true;
    text += ` ${victim} ${victim === "You" ? "are" : "is"} skipped.`;
  }
  const turn: Who = skip ? who : other;
  return { ...next, turn, message: `${text} ${turn === "player" ? "Your turn." : g.mode === "local" ? "Pass the device to Player 2." : "AI is thinking..."}` };
}

function aiMove(g: Game): Game {
  if (!g.started || g.winner || g.turn !== "ai") return g;
  const top = g.discard[g.discard.length - 1];
  let state = g;
  const hand = g.ai.filter((card) => canPlay(card, top, g.color));
  if (hand.length === 0) {
    state = drawCards(g, "ai", 1);
    if (state.ai.length === g.ai.length) return { ...state, turn: "player", message: "The deck is empty — your turn." };
    const drawn = state.ai[state.ai.length - 1];
    if (!canPlay(drawn, top, g.color)) return { ...state, turn: "player", message: "The AI drew a card. Your turn." };
    // Keep the AI turn active so the drawn card is visible before its next move.
    return { ...state, turn: "ai", message: "AI drew a playable card..." };
  }
  // Prefer action cards, then numbers, and keep wilds for when nothing else fits.
  const rank = (card: Card) => ({ draw2: 5, skip: 4, reverse: 3, wild: 1, draw4: 0 } as Partial<Record<Value, number>>)[card.value] ?? 2;
  const chosen = [...hand].sort((a, b) => rank(b) - rank(a))[0];
  let wildColor: PlayColor | undefined;
  if (chosen.color === "wild") {
    const counts = new Map<PlayColor, number>();
    state.ai.filter((card) => card.id !== chosen.id && card.color !== "wild").forEach((card) => counts.set(card.color as PlayColor, (counts.get(card.color as PlayColor) ?? 0) + 1));
    wildColor = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? colors[Math.floor(Math.random() * 4)];
  }
  const played = playCard(state, "ai", chosen, wildColor);
  return played;
}

function CardView({ card, hidden = false, onClick, playable = false, dim = false }: { card?: Card; hidden?: boolean; onClick?: () => void; playable?: boolean; dim?: boolean }) {
  const size = "flex h-28 w-20 shrink-0 flex-col items-center justify-center rounded-xl sm:h-36 sm:w-24";
  if (hidden || !card) return <div className={`${size} border-2 border-sky-300/50 bg-gradient-to-br from-slate-900 to-red-800 shadow-xl`}><span className="rounded-full border-2 border-white/50 px-2 py-1 text-xs font-black text-white">UNO</span></div>;
  const face = `${size} border-4 border-white/80 shadow-xl transition ${cardStyle[card.color]}`;
  const content = (
    <>
      <span className="text-3xl font-black sm:text-4xl">{valueLabels[card.value]}</span>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-wider">{card.color === "wild" ? "wild" : colorLabels[card.color]}</span>
    </>
  );
  if (!onClick) return <div className={face}>{content}</div>;
  return (
    <button onClick={onClick} disabled={!playable} aria-label={describe(card)} className={`${face} ${playable ? "hover:-translate-y-3 hover:shadow-2xl focus-visible:-translate-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300" : dim ? "cursor-not-allowed opacity-50" : "cursor-default"}`}>{content}</button>
  );
}

export default function Uno() {
  const MAX_BET = 250;
  const [g, setG] = useState<Game>(emptyGame);
  const [pendingWild, setPendingWild] = useState<Card | null>(null);
  const [pendingWildWho, setPendingWildWho] = useState<Who | null>(null);
  const [balance, setBalance] = useBankingBalance();
  const [bet, setBet] = useState(25);
  const [mode] = useState<GameMode>("ai");

  const inProgress = g.started && !g.winner;
  const top = g.discard[g.discard.length - 1];
  const playerTurn = inProgress && g.turn === "player" && !pendingWild;
  const localOpponentTurn = inProgress && g.mode === "local" && g.turn === "ai" && !pendingWild;

  useEffect(() => {
    if (!inProgress || g.mode !== "ai" || g.turn !== "ai") return;
    const id = window.setTimeout(() => setG(aiMove), 5000);
    return () => window.clearTimeout(id);
  }, [g, inProgress]);

  useEffect(() => {
    if (!g.winner) return;
    const stake = g.stake;
    if (g.winner === "You") {
      const profit = stake * WIN_PROFIT_RATE;
      const returned = stake + profit;
      bankingPayout(returned).then(() => syncBankingBalance(setBalance)).then(() => {
        setG((current) => ({ ...current, message: `You win — ${profit.toFixed(2)} profit + ${stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.` }));
      }).catch((error) => {
        setG((current) => ({ ...current, message: error instanceof Error ? error.message : "Payout failed." }));
      });
    } else {
      setG((current) => ({ ...current, message: `AI wins — ${stake.toFixed(2)} stake lost. Start a new game to try again.` }));
    }
  }, [g.winner, g.stake, g.mode, setBalance]);

  async function startGame() {
    if (inProgress) return;
    if (bet < 1 || bet > MAX_BET || bet > balance) {
      setG((current) => ({ ...current, message: `Choose a bet between 1 and ${MAX_BET} moose bucks within your available balance.` }));
      return;
    }
    try {
      await bankingStake(bet);
      await syncBankingBalance(setBalance);
    } catch (error) {
      setG((current) => ({ ...current, message: error instanceof Error ? error.message : "Could not place the stake." }));
      return;
    }
    setPendingWild(null);
    setPendingWildWho(null);
    setG(newGame(bet, mode));
  }

  function isPlayable(card: Card, who: Who = "player") {
    const turnIsActive = who === "player" ? playerTurn : localOpponentTurn;
    if (!turnIsActive || !top) return false;
    if (g.drawnId !== null && card.id !== g.drawnId) return false;
    return canPlay(card, top, g.color);
  }

  function handlePlay(card: Card, who: Who = "player") {
    if (!isPlayable(card, who)) return;
    if (card.color === "wild") { setPendingWild(card); setPendingWildWho(who); return; }
    setG(playCard(g, who, card));
  }

  function chooseColor(color: PlayColor) {
    if (!pendingWild || !pendingWildWho) return;
    setG(playCard(g, pendingWildWho, pendingWild, color));
    setPendingWild(null);
    setPendingWildWho(null);
  }

  function drawCard() {
    const who: Who = playerTurn ? "player" : localOpponentTurn ? "ai" : "player";
    if (!isPlayable(g[who][0] ?? { id: -1, color: "wild", value: "wild" }, who) && (who === "player" ? !playerTurn : !localOpponentTurn)) return;
    if (g.drawnId !== null) return;
    const state = drawCards(g, who, 1);
    if (state[who].length === g[who].length) {
      setG({ ...state, turn: who === "player" ? "ai" : "player", message: who === "player" ? (g.mode === "local" ? "Nothing left to draw — pass the device to Player 2." : "Nothing left to draw — AI's turn.") : "Nothing left to draw — your turn." });
      return;
    }
    const drawn = state[who][state[who].length - 1];
    const name = who === "player" ? "You" : "Player 2";
    if (canPlay(drawn, top, g.color)) setG({ ...state, drawnId: drawn.id, message: `${name} drew ${describe(drawn)} — play it, or keep it and pass.` });
    else setG({ ...state, turn: who === "player" ? "ai" : "player", message: who === "player" ? (g.mode === "local" ? `You drew ${describe(drawn)}. Pass the device to Player 2.` : `You drew ${describe(drawn)}. AI is thinking...`) : `Player 2 drew ${describe(drawn)}. Your turn.` });
  }

  function pass() {
    const who: Who = playerTurn ? "player" : localOpponentTurn ? "ai" : "player";
    if (g.drawnId === null || (who === "player" ? !playerTurn : !localOpponentTurn)) return;
    setG({ ...g, drawnId: null, turn: who === "player" ? "ai" : "player", message: who === "player" ? (g.mode === "local" ? "You kept the card. Pass the device to Player 2." : "You kept the card. AI is thinking...") : "Player 2 kept the card. Your turn." });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10"><Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link><Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link></nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Player vs AI</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">UNO</h1><p className="mt-2 text-sm text-sky-100/65">Match colors or symbols, play your wild cards, and empty your hand first.</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/55">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p><p className="mt-2 text-xs text-sky-100/55">UNO returns 95% of a winning profit plus your original stake.</p></div><div className="flex items-center gap-3"><div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"><p className="text-xs uppercase tracking-wider text-sky-100/55">AI hand</p><p className="mt-1 text-xl font-bold text-sky-200">{g.ai.length} cards</p></div><button onClick={startGame} disabled={inProgress} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-bold text-[#071426] hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">{inProgress ? "Game in progress" : "New game"}</button></div></div>
          <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="rounded-2xl border border-emerald-300/10 bg-[#0a3a36]/70 p-5 sm:p-8">
            <div className="flex min-h-36 items-center justify-center overflow-hidden">
              <div className="flex -space-x-12 sm:-space-x-14">{g.ai.slice(0, 10).map((card) => <CardView key={card.id} hidden />)}</div>
              {g.ai.length === 0 && <div className="flex h-28 w-20 items-center justify-center rounded-xl border border-dashed border-sky-200/30 text-sm text-sky-100/50 sm:h-36 sm:w-24">AI</div>}
            </div>
            <div className="my-8 flex flex-wrap items-center justify-center gap-6 border-y border-white/10 py-8">
              <div className="text-center"><p className="mb-3 text-xs uppercase tracking-widest text-sky-100/55">Draw pile</p><button onClick={drawCard} disabled={(!playerTurn && !localOpponentTurn) || g.drawnId !== null} aria-label="Draw a card" className="group relative block rounded-xl disabled:cursor-not-allowed"><span className="block rounded-xl transition group-enabled:group-hover:-translate-y-1 group-enabled:group-hover:shadow-2xl"><CardView hidden /></span><span className="absolute inset-x-0 -bottom-6 text-xs text-sky-100/55">{g.deck.length} left</span></button></div>
              <div className="text-center"><p className="mb-3 text-xs uppercase tracking-widest text-sky-100/55">Discard pile</p>{top ? <CardView card={top} /> : <div className="h-28 w-20 rounded-xl border border-dashed border-white/20 sm:h-36 sm:w-24" />}</div>
              <div className="text-center"><p className="mb-3 text-xs uppercase tracking-widest text-sky-100/55">Active color</p><div className={`flex h-16 w-16 items-center justify-center rounded-full text-xs font-bold uppercase shadow-lg ${cardStyle[g.color]}`}>{colorLabels[g.color]}</div></div>
            </div>
            <div className="flex min-h-36 flex-wrap items-end justify-center gap-2">{g.player.map((card) => <CardView key={card.id} card={card} onClick={() => handlePlay(card)} playable={isPlayable(card)} dim={playerTurn} />)}</div>
            {pendingWild && (
              <div className="mt-6 text-center" role="group" aria-label="Choose a color for your wild card">
                <p className="mb-3 text-sm font-semibold text-sky-100">Choose a color for your {describe(pendingWild)}</p>
                <div className="flex justify-center gap-3">{colors.map((color) => <button key={color} onClick={() => chooseColor(color)} className={`h-12 w-12 rounded-full border-4 border-white/80 text-xs font-bold shadow-lg transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${cardStyle[color]}`} aria-label={colorLabels[color]}>{colorLabels[color][0]}</button>)}</div>
                <button onClick={() => setPendingWild(null)} className="mt-3 text-xs text-sky-100/65 hover:text-white">Cancel</button>
              </div>
            )}
            <p className="mt-7 min-h-6 text-center text-sm font-semibold text-sky-100" aria-live="polite">{g.message}</p>
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Game status</p>
                <p className="mt-2 text-sm text-sky-100/65">{!g.started ? "Waiting to start" : g.winner ? "Game over" : g.turn === "player" ? "Your turn" : "AI turn"} · {g.player.length} cards left</p>
                <button onClick={pass} disabled={!playerTurn || g.drawnId === null} className="mt-3 w-full rounded-xl border border-sky-300/40 px-5 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-30">Keep &amp; pass</button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <label htmlFor="uno-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet amount</label>
                <div className="mt-2 flex items-center gap-2">                <input id="uno-bet" type="number" min="1" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={inProgress} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Table limit: {MAX_BET} moose bucks</p>
              </div>
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}