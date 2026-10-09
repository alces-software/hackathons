"use client";

import { useState } from "react";
import Link from "next/link";
import { bankingPayout, bankingStake, syncBankingBalance, useBankingBalance } from "../../lib/banking";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { suit: Suit; value: string; points: number };
type Status = "ready" | "playing" | "dealer" | "finished";

const suits: Suit[] = ["♠", "♥", "♦", "♣"];
const values = [["A", 11], ["2", 2], ["3", 3], ["4", 4], ["5", 5], ["6", 6], ["7", 7], ["8", 8], ["9", 9], ["10", 10], ["J", 10], ["Q", 10], ["K", 10]] as const;

function randomIndex(maxExclusive: number) {
  const range = 2 ** 32;
  const limit = range - (range % maxExclusive);
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % maxExclusive;
}

function makeShoe() {
  const cards = Array.from({ length: 6 }, () => suits.flatMap((suit) => values.map(([value, points]) => ({ suit, value, points })))).flat();
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function score(hand: Card[]) {
  let total = hand.reduce((sum, card) => sum + card.points, 0);
  let aces = hand.filter((card) => card.value === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

function soft(hand: Card[]) {
  return hand.some((card) => card.value === "A") && score(hand) + 10 <= 21;
}

function CardView({ card, hidden = false }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) return <div className="card-back flex h-28 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-sky-300/50 shadow-xl sm:h-36 sm:w-24"><span className="text-3xl text-sky-300/60">🫎</span></div>;
  const red = card.suit === "♥" || card.suit === "♦";
  return <div className={`deal-card flex h-28 w-20 shrink-0 flex-col justify-between rounded-lg border border-slate-200 bg-white p-2 text-left shadow-xl sm:h-36 sm:w-24 sm:p-3 ${red ? "text-red-500" : "text-slate-900"}`}><b className="text-xl sm:text-2xl">{card.value}</b><span className="self-center text-3xl sm:text-4xl">{card.suit}</span><b className="rotate-180 text-xl sm:text-2xl">{card.value}</b></div>;
}

export default function Blackjack() {
  const MAX_BET = 250;
  const [shoe, setShoe] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [status, setStatus] = useState<Status>("ready");
  const [message, setMessage] = useState("Place a bet to deal.");
  const [bet, setBet] = useState(25);
  const [balance, setBalance] = useBankingBalance();

  async function settle(hand: Card[], house: Card[], stake: number) {
    const playerScore = score(hand);
    const dealerScore = score(house);
    const won = playerScore <= 21 && (dealerScore > 21 || playerScore > dealerScore);
    const push = playerScore <= 21 && dealerScore <= 21 && playerScore === dealerScore;
    const returned = push ? stake : won ? stake * 2 : 0;
    const profit = push ? 0 : won ? stake : -stake;
    const outcome = push
      ? `Push — ${stake.toFixed(2)} stake returned.`
      : won
        ? `Won ${profit.toFixed(2)} profit + ${stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.`
        : `Dealer wins — ${stake.toFixed(2)} stake lost.`;
    if (returned > 0) {
      try {
        await bankingPayout(returned);
        await syncBankingBalance(setBalance);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Payout failed.");
        setStatus("finished");
        return;
      }
    }
    setMessage(`${outcome} ${playerScore} against ${dealerScore}.`);
    setStatus("finished");
  }

  function draw(deck: Card[]) { return [deck[0], deck.slice(1)] as const; }

  async function deal() {
    if (bet < 1 || bet > MAX_BET || bet > balance) { setMessage(`Choose a bet between 1 and ${MAX_BET} moose bucks within your available balance.`); return; }
    try {
      await bankingStake(bet);
      await syncBankingBalance(setBalance);
      const deck = shoe.length < 20 ? makeShoe() : shoe;
      const [p1, r1] = draw(deck); const [d1, r2] = draw(r1); const [p2, r3] = draw(r2); const [d2, nextShoe] = draw(r3);
      const hand = [p1, p2]; const house = [d1, d2];
      setPlayer(hand); setDealer(house); setShoe(nextShoe);
      if (score(hand) === 21) {
        if (score(house) === 21) await settle(hand, house, bet);
        else {
          await bankingPayout(bet * 2.5);
          await syncBankingBalance(setBalance);
          setMessage(`Blackjack! Won ${(bet * 1.5).toFixed(2)} profit + ${bet.toFixed(2)} stake returned = ${(bet * 2.5).toFixed(2)} moose bucks credited. Blackjack pays 3:2.`);
          setStatus("finished");
        }
      } else {
        setMessage("Your move — hit, stand, or double down.");
        setStatus("playing");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not settle the stake.");
    }
  }

  function hit() {
    const [card, nextShoe] = draw(shoe); const hand = [...player, card];
    setPlayer(hand); setShoe(nextShoe);
    if (score(hand) > 21) { setMessage(`Bust — you scored ${score(hand)}.`); setStatus("finished"); }
    else if (score(hand) === 21) void stand(hand, bet);
  }

  function stand(hand = player, stake = bet) {
    let nextShoe = shoe; const house = [...dealer];
    while (score(house) < 17 || (score(house) === 17 && soft(house))) { const [card, remaining] = draw(nextShoe); house.push(card); nextShoe = remaining; }
    setDealer(house.slice(0, 2));
    setShoe(nextShoe);
    setStatus("dealer");

    const extraCards = house.slice(2);
    if (extraCards.length === 0) {
      window.setTimeout(() => void settle(hand, house, stake), 500);
      return;
    }

    setMessage("Dealer reveals their hand...");
    extraCards.forEach((card, index) => {
      window.setTimeout(() => {
        setDealer((current) => [...current, card]);
        if (index === extraCards.length - 1) {
          window.setTimeout(() => void settle(hand, house, stake), 450);
        } else {
          setMessage("Dealer draws another card...");
        }
      }, (index + 1) * 700);
    });
  }

  async function doubleDown() {
    if (bet * 2 > MAX_BET) { setMessage(`The table limit is ${MAX_BET} moose bucks.`); return; }
    if (balance < bet) { setMessage("You need enough balance to double your bet."); return; }
    try {
      await bankingStake(bet);
      await syncBankingBalance(setBalance);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not place the additional stake.");
      return;
    }
    const stake = bet * 2; const [card, nextShoe] = draw(shoe); const hand = [...player, card];
    setBet(stake); setPlayer(hand); setShoe(nextShoe);
    if (score(hand) > 21) { setMessage(`Double down bust — you scored ${score(hand)}.`); setStatus("finished"); } else stand(hand, stake);
  }

  function reset() { setPlayer([]); setDealer([]); setStatus("ready"); setMessage("Place a bet to deal."); setBet(Math.min(25, balance, MAX_BET)); }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071426] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.32),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(14,116,144,0.2),_transparent_32%)]" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10"><Link href="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400 text-2xl text-[#071426]">🫎</span><span className="font-serif text-xl font-bold">Alces Casino</span></Link><Link href="/" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Exit to lodge</Link></nav>
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Casino table</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Blackjack</h1><p className="mt-2 text-sm text-sky-100/65">Six decks · Dealer stands on soft 17 · Blackjack pays 3:2</p></div>
        <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8"><div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/55">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p></div><p className="max-w-sm text-sm text-sky-100/55">Settlements are processed through your connected banking account.</p></div>
          <div className="grid gap-8 py-2 lg:grid-cols-[1fr_260px]"><div className="rounded-2xl border border-emerald-300/10 bg-[#0a3a36]/70 p-5 sm:p-8"><div className="mb-8"><p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-100/65">Dealer {status === "playing" ? "· hidden card" : ""}</p><div className="flex gap-3">{dealer.map((card, index) => <CardView key={`${card.value}${card.suit}${index}`} card={card} hidden={status === "playing" && index === 1} />)}</div>{dealer.length > 0 && status !== "playing" && <p className="mt-3 text-sm text-emerald-100/65">Score: {score(dealer)}</p>}</div><div><p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-100/65">You · {player.length > 0 && score(player)}</p><div className="flex gap-3">{player.map((card, index) => <CardView key={`${card.value}${card.suit}${index}`} card={card} />)}</div></div><p className="mt-8 min-h-6 text-center text-sm font-semibold text-sky-100">{message}</p></div>
            <div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"><label htmlFor="bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet amount</label><div className="mt-2 flex items-center gap-2">            <input id="bet" type="number" min="1" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={status === "playing" || status === "dealer"} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Table limit: {MAX_BET} moose bucks</p></div><div className="grid grid-cols-2 gap-2"><button onClick={deal} disabled={status === "playing" || status === "dealer"} className="col-span-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#071426] hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">{status === "finished" ? "Deal again" : "Deal cards"}</button><button onClick={hit} disabled={status !== "playing"} className="rounded-xl border border-sky-300/40 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-300/10 disabled:opacity-30">Hit</button><button onClick={() => stand()} disabled={status !== "playing"} className="rounded-xl border border-sky-300/40 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-300/10 disabled:opacity-30">Stand</button><button onClick={doubleDown} disabled={status !== "playing" || player.length !== 2} className="col-span-2 rounded-xl border border-indigo-300/40 px-4 py-3 text-sm font-semibold text-indigo-100 hover:bg-indigo-300/10 disabled:opacity-30">Double down</button></div><button onClick={reset} className="w-full text-xs text-sky-100/65 hover:text-white">Reset table</button></div></div>
        </section>
      </section>
    </main>
  );
}
