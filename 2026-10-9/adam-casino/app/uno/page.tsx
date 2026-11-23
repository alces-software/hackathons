"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { findCosmetic, findCosmeticTitle } from "../../lib/cosmeticsCatalog";
import { bankingLoss, bankingPayout, bankingReturn, bankingStake, getStoredBankingCredentials, syncBankingBalance, useBankingBalance } from "../../lib/banking";
import type { UnoAction, UnoCard, UnoPlayColor, UnoRuleset } from "../../lib/unoMultiplayer";

import {
  aiMoveTactical,
  canPlay,
  colorLabels,
  colors,
  describe,
  drawAmount,
  drawCards,
  drawUntilColor,
  emptyGame as libEmptyGame,
  newGame,
  playCard,
} from "../../lib/unoLocal";
import type { Card, Color, Game, GameMode, PlayColor, Ruleset, Value, Who } from "../../lib/unoLocal";

type Badge = { id: string; icon: string };
type Title = { id: string; label: string; icon: string };

function BadgeIcon({ badge }: { badge?: Badge | null }) {
  return badge ? <span aria-label={badge.id}>{badge.icon}</span> : null;
}

function TitleChip({ title }: { title?: Title | null }) {
  if (!title) return null;
  return <span className="ml-0.5 rounded-full bg-emerald-300/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100" title={`Title: ${title.label}`}>{title.icon} {title.label}</span>;
}

type MultiplayerView = {
  code: string;
  playerName: string;
  players: { id: string; name: string; badge?: Badge | null; title?: Title | null }[];
  spectators: { id: string; name: string; badge?: Badge | null; title?: Title | null }[];
  role: "player" | "spectator";
  hostId: string;
  maxPlayers: number;
  ruleset: UnoRuleset;
  hand: UnoCard[];
  opponent: { id: string; name: string; badge?: Badge | null; title?: Title | null } | null;
  opponentCardCount: number;
  opponents: { id: string; name: string; badge?: Badge | null; title?: Title | null; cardCount: number }[];
  deckCount: number;
  top: UnoCard | null;
  activeColor: UnoPlayColor;
  isYourTurn: boolean;
  currentTurn: string;
  direction: 1 | -1;
  turnOrder: string[];
  drawnId: number | null;
  pendingDraw: number;
  pendingDrawColor: UnoPlayColor | null;
  winner: string | null;
  stake: number | null;
  isReady: boolean;
  readyCount: number;
  bothPlayersReady: boolean;
  settlementComplete: boolean;
  settledCount: number;
  message: string;
};

const WIN_PROFIT_RATE = 0.95;
const valueLabels: Record<Value, string> = { "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", skip: "⊘", reverse: "↺", draw2: "+2", wild: "★", draw4: "+4", draw6: "+6", draw10: "+10", switch: "⇄", discardColor: "◈", drawColor: "☄" };

// Self-contained card colours (no dependency on global CSS).
const defaultCardStyle: Record<Color, string> = {
  red: "bg-red-600 text-white",
  yellow: "bg-yellow-400 text-slate-900",
  green: "bg-green-600 text-white",
  blue: "bg-blue-600 text-white",
  wild: "bg-[conic-gradient(#dc2626_0_25%,#facc15_0_50%,#16a34a_0_75%,#2563eb_0_100%)] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]",
};

const defaultHiddenCard = "border-2 border-sky-300/50 bg-gradient-to-br from-slate-900 to-red-800 shadow-xl";

// A friendlier idle message than the lib's bare emptyGame (the state shape is otherwise identical).
const emptyGame: Game = { ...libEmptyGame, message: "Start a new game to deal the cards." };

function CardView({ card, hidden = false, onClick, playable = false, dim = false, style, hiddenStyle, className }: { card?: Card; hidden?: boolean; onClick?: () => void; playable?: boolean; dim?: boolean; style: Record<Color, string>; hiddenStyle?: string; className?: string }) {
  const size = "flex h-28 w-20 shrink-0 flex-col items-center justify-center rounded-xl sm:h-36 sm:w-24";
  if (hidden || !card) return <div className={`${size} ${hiddenStyle ?? defaultHiddenCard}`}><span className="rounded-full border-2 border-white/50 px-2 py-1 text-xs font-black text-white">UNO</span></div>;
  const face = `${size} border-4 border-white/80 shadow-xl transition ${style[card.color]}${className ? ` ${className}` : ""}`;
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
  const [aiDelay, setAiDelay] = useState(5000);
  const [ruleset, setRuleset] = useState<Ruleset>("regular");
  const [mode] = useState<GameMode>("ai");
  const [unoTab, setUnoTab] = useState<"multiplayer" | "local">("multiplayer");
  const [multiplayerName, setMultiplayerName] = useState("");
  const [multiplayerCode, setMultiplayerCode] = useState("");
  const [multiplayerPlayerId, setMultiplayerPlayerId] = useState("");
  const [multiplayerPlayerToken, setMultiplayerPlayerToken] = useState("");
  const [multiplayer, setMultiplayer] = useState<MultiplayerView | null>(null);
  const [multiplayerMessage, setMultiplayerMessage] = useState("");
  const [multiplayerBet, setMultiplayerBet] = useState(25);
  const [multiplayerRuleset, setMultiplayerRuleset] = useState<UnoRuleset>("regular");
  const [multiplayerMaxPlayers, setMultiplayerMaxPlayers] = useState(2);
  const hasSettledMultiplayerRef = useRef(false);
  // One banking settlement per finished round: without this the settle effect re-runs on any
  // state update after a loss (message reset / balance sync) and the bank is credited twice.
  const settledRoundRef = useRef(false);

  // The equipped card skin (if any), resolved from the client-safe catalog so every card we
  // render (hand, top of pile, active color) wears the chosen deck. Default palette otherwise.
  const [cardSkin, setCardSkin] = useState<Record<Color, string> | null>(null);
  const [hiddenCardStyle, setHiddenCardStyle] = useState<string | null>(null);
  const cardStyle = cardSkin ?? defaultCardStyle;

  // The equipped badge and title passes (if any), included whenever we create/join/spectate a room.
  const unoCosmeticPassRef = useRef<string | null>(null);
  const unoTitlePassRef = useRef<string | null>(null);
  useEffect(() => {
    const credentials = getStoredBankingCredentials();
    if (!credentials) return;
    fetch(`/api/cosmetics/pass?username=${encodeURIComponent(credentials.username)}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ pass?: string | null; passes?: Record<string, string | null>; ids?: Record<string, string | null> }>)
      .then((body) => {
        unoCosmeticPassRef.current = body.pass ?? body.passes?.badge ?? null;
        unoTitlePassRef.current = body.passes?.title ?? null;
        const skinId = body.ids?.["uno-card-skin"] ?? null;
        const skin = skinId ? findCosmetic(skinId) : null;
        setCardSkin(skin?.cardStyles as Record<Color, string> | undefined ?? null);
        setHiddenCardStyle(skin?.hiddenStyle ?? null);
      })
      .catch(() => {
        unoCosmeticPassRef.current = null;
      });
  }, []);

  const inProgress = g.started && !g.winner;
  const top = g.discard[g.discard.length - 1];
  const playerTurn = inProgress && g.turn === "player" && !pendingWild;
  const localOpponentTurn = inProgress && g.mode === "local" && g.turn === "ai" && !pendingWild;

  useEffect(() => {
    if (!multiplayerCode || !multiplayerPlayerId) return;
    const source = new EventSource(`/api/uno/room?events=1&code=${encodeURIComponent(multiplayerCode)}&playerToken=${encodeURIComponent(multiplayerPlayerToken)}`);
    source.onmessage = (event) => setMultiplayer(JSON.parse(event.data) as MultiplayerView);
    return () => source.close();
  }, [multiplayerCode, multiplayerPlayerId, multiplayerPlayerToken]);

  useEffect(() => {
    if (!multiplayer?.winner || multiplayer.stake === null || multiplayer.settlementComplete) return;
    if (hasSettledMultiplayerRef.current) return;
    hasSettledMultiplayerRef.current = true;
    const ownPlayer = multiplayer.players.find((player) => player.id === multiplayerPlayerId);
    if (!ownPlayer) return;
    const profit = multiplayer.stake * 0.95;
    const settle = ownPlayer.name === multiplayer.winner
      ? bankingReturn(multiplayer.stake).then(() => bankingPayout(profit))
      : bankingReturn(multiplayer.stake).then(() => bankingLoss(multiplayer.stake!));
    settle.then(() => syncBankingBalance(setBalance)).then(async () => {
      const response = await fetch("/api/uno/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", code: multiplayer.code, playerToken: multiplayerPlayerToken, move: { type: "settle" } }) });
      if (!response.ok) throw new Error("The server could not record the settlement.");
      setMultiplayer(await response.json() as MultiplayerView);
    }).catch((error) => {
      // The banking transfers may already have gone through, so a failed settle must never be
      // retried: another attempt would return and pay out the same stake a second time.
      setMultiplayerMessage(error instanceof Error ? error.message : "The multiplayer settlement failed.");
    });
  }, [multiplayer, multiplayerPlayerId, multiplayerPlayerToken, setBalance]);

  useEffect(() => {
    if (!inProgress || g.mode !== "ai" || g.turn !== "ai") return;
    const id = window.setTimeout(() => setG((current) => aiMoveTactical(current)), aiDelay);
    return () => window.clearTimeout(id);
  }, [g, inProgress, aiDelay]);

  useEffect(() => {
    if (!g.winner || settledRoundRef.current) return;
    settledRoundRef.current = true;
    const stake = g.stake;
    if (g.winner === "You") {
      const profit = stake * WIN_PROFIT_RATE;
      const returned = stake + profit;
      bankingReturn(stake).then(() => bankingPayout(profit)).then(() => syncBankingBalance(setBalance)).then(() => {
        setG((current) => ({ ...current, message: `You win — ${profit.toFixed(2)} profit + ${stake.toFixed(2)} stake returned = ${returned.toFixed(2)} moose bucks credited.` }));
      }).catch((error) => {
        setG((current) => ({ ...current, message: error instanceof Error ? error.message : "Payout failed." }));
      });
    } else {
      setG((current) => ({ ...current, message: `AI wins — ${stake.toFixed(2)} stake lost. Start a new game to try again.` }));
      bankingReturn(stake).then(() => bankingLoss(stake)).then(() => syncBankingBalance(setBalance)).catch((error) => {
        setG((current) => ({ ...current, message: error instanceof Error ? error.message : "Loss could not be recorded." }));
      });
    }
  }, [g.winner, g.stake, g.mode, setBalance]);

  async function startGame() {
    if (inProgress) return;
    if (bet < 1 || bet > MAX_BET || bet > balance) {
      setG((current) => ({ ...current, message: `Choose a bet between 1 and ${MAX_BET} moose bucks within your available balance.` }));
      return;
    }
    try {
      await bankingStake(bet, "uno");
      await syncBankingBalance(setBalance);
    } catch (error) {
      setG((current) => ({ ...current, message: error instanceof Error ? error.message : "Could not place the stake." }));
      return;
    }
    settledRoundRef.current = false;
    setPendingWild(null);
    setPendingWildWho(null);
    setG(newGame(bet, mode, ruleset));
  }

  async function multiplayerRequest(body: { action: "create" | "join" | "spectate" | "move"; code?: string; playerId?: string; playerToken?: string; name?: string; ruleset?: UnoRuleset; maxPlayers?: number; move?: UnoAction; cosmeticPass?: string; titlePass?: string }) {
    const response = await fetch("/api/uno/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string; playerId?: string; playerToken?: string; room?: MultiplayerView };
    if (!response.ok) throw new Error(result.error || "The multiplayer request failed.");
    if (result.playerId) setMultiplayerPlayerId(result.playerId);
    if (result.playerToken) setMultiplayerPlayerToken(result.playerToken);
    if (result.room) {
      setMultiplayerCode(result.room.code);
      setMultiplayer(result.room);
      window.sessionStorage.setItem("alces-uno-room", result.room.code);
      window.sessionStorage.setItem("alces-uno-player", result.playerId ?? multiplayerPlayerId);
      window.sessionStorage.setItem("alces-uno-player-token", result.playerToken ?? multiplayerPlayerToken);
    }
  }

  async function reconnectMultiplayerRoom() {
    const savedCode = window.sessionStorage.getItem("alces-uno-room");
    const savedPlayerId = window.sessionStorage.getItem("alces-uno-player");
    const savedPlayerToken = window.sessionStorage.getItem("alces-uno-player-token");
    if (!savedCode || !savedPlayerId || !savedPlayerToken) {
      setMultiplayerMessage("There is no saved UNO room on this browser.");
      return;
    }
    const response = await fetch(`/api/uno/room?code=${encodeURIComponent(savedCode)}&playerToken=${encodeURIComponent(savedPlayerToken)}`, { cache: "no-store" });
    const result = await response.json() as MultiplayerView | { error?: string };
    if (!response.ok || !("players" in result)) {
      setMultiplayerMessage((result as { error?: string }).error || "That saved room is no longer available.");
      window.sessionStorage.removeItem("alces-uno-room");
      window.sessionStorage.removeItem("alces-uno-player");
      window.sessionStorage.removeItem("alces-uno-player-token");
      return;
    }
    setMultiplayerCode(savedCode);
    setMultiplayerPlayerId(savedPlayerId);
    setMultiplayerPlayerToken(savedPlayerToken);
    setMultiplayer(result);
    setMultiplayerMessage("Reconnected to the saved room.");
  }

  async function createMultiplayerRoom() {
    try { await multiplayerRequest({ action: "create", name: multiplayerName, ruleset: multiplayerRuleset, maxPlayers: multiplayerMaxPlayers, cosmeticPass: unoCosmeticPassRef.current ?? undefined, titlePass: unoTitlePassRef.current ?? undefined }); setMultiplayerMessage(`Room created for up to ${multiplayerMaxPlayers} players. Share the code with your group.`); } catch (error) { setMultiplayerMessage(error instanceof Error ? error.message : "Could not create the room."); }
  }

  async function joinMultiplayerRoom() {
    if (multiplayer && multiplayer.code === multiplayerCode) {
      setMultiplayerMessage("You are already connected to this room.");
      return;
    }
    try { await multiplayerRequest({ action: "join", code: multiplayerCode, playerToken: multiplayerPlayerToken, name: multiplayerName, cosmeticPass: unoCosmeticPassRef.current ?? undefined, titlePass: unoTitlePassRef.current ?? undefined }); setMultiplayerMessage("Joined the room."); } catch (error) { setMultiplayerMessage(error instanceof Error ? error.message : "Could not join the room."); }
  }

  async function spectateMultiplayerRoom() {
    try { await multiplayerRequest({ action: "spectate", code: multiplayerCode, name: multiplayerName, cosmeticPass: unoCosmeticPassRef.current ?? undefined, titlePass: unoTitlePassRef.current ?? undefined }); setMultiplayerMessage("You are spectating this room."); } catch (error) { setMultiplayerMessage(error instanceof Error ? error.message : "Could not join as a spectator."); }
  }

  function leaveMultiplayerRoom() {
    setMultiplayerPendingWild(null);
    setMultiplayerPendingSwitch(null);
    setMultiplayer(null);
    setMultiplayerCode("");
    setMultiplayerPlayerId("");
    setMultiplayerPlayerToken("");
    window.sessionStorage.removeItem("alces-uno-room");
    window.sessionStorage.removeItem("alces-uno-player");
    window.sessionStorage.removeItem("alces-uno-player-token");
    setMultiplayerMessage("You left the room. Create or join another room.");
  }

  async function sendMultiplayerMove(move: UnoAction) {
    if (!multiplayer) return;
    try { await multiplayerRequest({ action: "move", code: multiplayer.code, playerToken: multiplayerPlayerToken, move }); } catch (error) { setMultiplayerMessage(error instanceof Error ? error.message : "That move could not be played."); }
  }

  async function readyMultiplayer() {
    if (!multiplayer || multiplayer.isReady || multiplayerBet < 1 || multiplayerBet > 250) return;
    if (multiplayer.stake !== null && multiplayerBet !== multiplayer.stake) {
      setMultiplayerMessage(`This room requires a ${multiplayer.stake.toFixed(2)} moose buck stake.`);
      return;
    }
    try {
      await bankingStake(multiplayerBet, "uno", multiplayerBet * 1.95);
      await syncBankingBalance(setBalance);
      await sendMultiplayerMove({ type: "ready", stake: multiplayerBet });
    } catch (error) {
      setMultiplayerMessage(error instanceof Error ? error.message : "Could not place the multiplayer stake.");
    }
  }

  const [multiplayerPendingWild, setMultiplayerPendingWild] = useState<UnoCard | null>(null);
  const [multiplayerPendingSwitch, setMultiplayerPendingSwitch] = useState<UnoCard | null>(null);

  function playMultiplayerCard(card: UnoCard) {
  if (!multiplayerCardIsPlayable(card)) return;
  if (card.value === "switch" && multiplayer?.ruleset === "no-mercy") {
    setMultiplayerPendingSwitch(card);
    return;
  }
  if (card.color === "wild") {
    setMultiplayerPendingWild(card);
    return;
  }
  void sendMultiplayerMove({ type: "play", cardId: card.id });
}

function chooseMultiplayerSwitchTarget(targetPlayerId: string) {
  if (!multiplayerPendingSwitch) return;
  void sendMultiplayerMove({ type: "play", cardId: multiplayerPendingSwitch.id, targetPlayerId });
  setMultiplayerPendingSwitch(null);
}

  function multiplayerCardIsPlayable(card: UnoCard) {
    if (!multiplayer?.isYourTurn || multiplayer.winner) return false;
    if (multiplayer.drawnId !== null) return card.id === multiplayer.drawnId;
    if (multiplayer.pendingDrawColor !== null) return false;
    if (multiplayer.pendingDraw > 0) {
      const amount = drawAmount(card.value);
      const topAmount = multiplayer.top ? drawAmount(multiplayer.top.value) : 0;
      return amount > 0 && (multiplayer.ruleset === "no-mercy" ? amount >= topAmount : amount === topAmount);
    }
    return card.color === "wild" || card.color === multiplayer.activeColor || card.value === multiplayer.top?.value;
  }

  function chooseMultiplayerColor(color: PlayColor) {
  if (!multiplayerPendingWild) return;
  void sendMultiplayerMove({ type: "play", cardId: multiplayerPendingWild.id, color });
  setMultiplayerPendingWild(null);
}

  function isPlayable(card: Card, who: Who = "player") {
    const turnIsActive = who === "player" ? playerTurn : localOpponentTurn;
    if (!turnIsActive || !top) return false;
    if (g.drawnId !== null && card.id !== g.drawnId) return false;
    return canPlay(card, top, g.color, g.pendingDraw, g.ruleset, g.pendingDrawColor);
  }

  function handlePlay(card: Card, who: Who = "player") {
    if (!isPlayable(card, who)) return;
    if (card.value === "switch" && g.ruleset === "no-mercy") {
      setG(playCard(g, who, card, g.color));
      return;
    }
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
    if (!playerTurn && !localOpponentTurn) return;
    if (g.drawnId !== null) return;
    if (g.pendingDrawColor !== null) {
      const color = g.pendingDrawColor;
      const result = drawUntilColor(g, who, color);
      const nextState: Game = { ...result.state, pendingDrawColor: null, turn: who === "player" ? "ai" : "player", message: `${who === "player" ? "You" : "The AI"} drew ${result.drawn} cards until finding ${colorLabels[color]}.` };
      if (g.ruleset === "no-mercy" && nextState[who].length >= 25) {
        const winner = who === "player" ? "AI" : "You";
        setG({ ...nextState, winner, message: `${who === "player" ? "You" : "The AI"} reached 25 cards — No Mercy knockout!` });
      } else {
        setG(nextState);
      }
      return;
    }
    const drawCount = g.pendingDraw > 0 ? g.pendingDraw : 1;
    const state = drawCards(g, who, drawCount);
    if (state[who].length === g[who].length) {
      setG({ ...state, pendingDraw: 0, turn: who === "player" ? "ai" : "player", message: who === "player" ? (g.mode === "local" ? "Nothing left to draw — pass the device to Player 2." : "Nothing left to draw — AI's turn.") : "Nothing left to draw — your turn." });
      return;
    }
    if (g.ruleset === "no-mercy" && state[who].length >= 25) {
      const winner = who === "player" ? "AI" : g.mode === "local" ? "Player 2" : "AI";
      setG({ ...state, winner, pendingDraw: 0, message: `${who === "player" ? "You" : "The AI"} reached 25 cards — No Mercy knockout!` });
      return;
    }
    const drawn = state[who][state[who].length - 1];
    const name = who === "player" ? "You" : "Player 2";
    if (g.pendingDraw > 0) {
      setG({ ...state, pendingDraw: 0, turn: who === "player" ? "ai" : "player", message: who === "player" ? (g.mode === "local" ? `You drew ${drawCount} cards. Pass the device to Player 2.` : `You drew ${drawCount} cards. AI is thinking...`) : `Player 2 drew ${drawCount} cards. Your turn.` });
    } else if (canPlay(drawn, top, g.color, 0, g.ruleset)) {
      setG({ ...state, drawnId: drawn.id, message: `${name} drew ${describe(drawn)} — play it, or keep it and pass.` });
    } else {
      setG({
        ...state,
        turn: who === "player" ? "ai" : "player",
        message: who === "player"
          ? (g.mode === "local" ? `You drew ${describe(drawn)}. Pass the device to Player 2.` : `You drew ${describe(drawn)}. AI is thinking...`)
          : `The AI drew ${describe(drawn)}. Your turn.`,
      });
    }
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
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:px-10"><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">UNO game room</p><h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">UNO</h1><p className="mt-2 text-sm text-sky-100/65">Choose a table to play with a friend or locally against the AI.</p></div>
        <div className="mb-8 flex max-w-md rounded-xl border border-white/10 bg-slate-950/40 p-1" role="tablist" aria-label="UNO game mode"><button role="tab" aria-selected={unoTab === "multiplayer"} onClick={() => setUnoTab("multiplayer")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold transition ${unoTab === "multiplayer" ? "bg-emerald-300 text-[#092f2b]" : "text-sky-100/65 hover:bg-white/10 hover:text-white"}`}>Multiplayer</button><button role="tab" aria-selected={unoTab === "local"} onClick={() => setUnoTab("local")} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold transition ${unoTab === "local" ? "bg-sky-400 text-[#071426]" : "text-sky-100/65 hover:bg-white/10 hover:text-white"}`}>Local vs AI</button></div>
        {unoTab === "multiplayer" && <section className="mb-8 rounded-3xl border border-emerald-300/20 bg-[#092f2b]/90 p-5 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Self-hosted multiplayer</p><h2 className="mt-2 font-serif text-2xl font-bold">Play UNO with a friend</h2><p className="mt-2 max-w-xl text-sm text-emerald-100/65">Create a room on this server, share its code, and play regular UNO or UNO No Mercy in real time. Your opponent never receives your hand.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row"><input value={multiplayerName} onChange={(event) => setMultiplayerName(event.target.value)} placeholder="Your name" disabled={!!multiplayer} className="rounded-lg border border-emerald-200/20 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50" /><select value={multiplayerRuleset} onChange={(event) => setMultiplayerRuleset(event.target.value as UnoRuleset)} disabled={!!multiplayer} className="rounded-lg border border-emerald-200/20 bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"><option value="regular">Regular UNO</option><option value="no-mercy">UNO No Mercy</option></select><select value={multiplayerMaxPlayers} onChange={(event) => setMultiplayerMaxPlayers(Number(event.target.value))} disabled={!!multiplayer} aria-label="Maximum players" className="rounded-lg border border-emerald-200/20 bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} players</option>)}</select><button onClick={createMultiplayerRoom} disabled={!!multiplayer || !multiplayerName.trim()} className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-[#092f2b] hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">Create room</button></div>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center"><input value={multiplayerCode} onChange={(event) => setMultiplayerCode(event.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} disabled={!!multiplayer} className="w-full rounded-lg border border-emerald-200/20 bg-slate-950/50 px-3 py-2 font-mono text-sm uppercase tracking-widest text-white outline-none focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-40" /><button onClick={joinMultiplayerRoom} disabled={!multiplayerCode || !multiplayerName.trim() || !!multiplayer} className="rounded-lg border border-emerald-300/50 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40">Join room</button><button onClick={() => void spectateMultiplayerRoom()} disabled={!multiplayerCode || !multiplayerName.trim() || !!multiplayer} className="rounded-lg border border-emerald-300/50 px-4 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40">Spectate</button><button onClick={() => void reconnectMultiplayerRoom()} disabled={!!multiplayer} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-emerald-100/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">Reconnect saved room</button>{multiplayer && <><span className="text-sm text-emerald-100/70">You: <strong className="text-emerald-200">{multiplayer.playerName}</strong> · Room <strong className="font-mono tracking-widest text-emerald-200">{multiplayer.code}</strong> · {multiplayer.players.length}/2 players · {multiplayer.spectators.map((spectator) => <span key={spectator.id}><BadgeIcon badge={spectator.badge} /> {spectator.name}</span>).reduce((parts, part, index) => (index === 0 ? [part] : [...parts, ", ", part]), [] as React.ReactNode[]) || "nobody"} watching</span><button onClick={leaveMultiplayerRoom} className="rounded-lg border border-red-300/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-300/10">Leave room</button></>}</div>
          {multiplayer && multiplayer.players.length >= 2 && <div className="mt-6 rounded-2xl border border-emerald-300/10 bg-[#071f1d]/80 p-5"><div className="flex items-center justify-between text-sm text-emerald-100/70"><span>{multiplayer.role === "spectator" ? <span>Spectating · {multiplayer.spectators.map((spectator) => <span key={spectator.id}><BadgeIcon badge={spectator.badge} /><TitleChip title={spectator.title} /> {spectator.name}</span>).reduce((parts, part, index) => (index === 0 ? [part] : [...parts, ", ", part]), [] as React.ReactNode[]) || "nobody"} watching</span> : multiplayer.opponents.map((opponent) => <span key={opponent.id}><BadgeIcon badge={opponent.badge} /><TitleChip title={opponent.title} /> {opponent.name}: {opponent.cardCount}</span>).reduce((parts, part, index) => (index === 0 ? [part] : [...parts, " · ", part]), [] as React.ReactNode[])}</span><span>{multiplayer.role === "spectator" ? "Spectator view" : multiplayer.winner ? `${multiplayer.settledCount}/${multiplayer.maxPlayers} settled` : multiplayer.bothPlayersReady ? (multiplayer.isYourTurn ? "Your turn" : `${multiplayer.currentTurn}'s turn`) : `${multiplayer.readyCount}/${multiplayer.maxPlayers} ready`}</span></div><div className="mt-3 rounded-lg border border-emerald-300/15 bg-emerald-950/30 px-3 py-2 text-center text-xs text-emerald-100/80">Turn order: {multiplayer.turnOrder.map((name) => { const member = multiplayer.players.find((player) => player.name === name) ?? multiplayer.spectators.find((spectator) => spectator.name === name); return <span key={name}><BadgeIcon badge={member?.badge} /><TitleChip title={member?.title} /> {name}</span>; }).reduce((parts, part, index) => (index === 0 ? [part] : [...parts, multiplayer.direction === 1 ? " → " : " ← ", part]), [] as React.ReactNode[])} · Current turn: <strong className="text-emerald-200"><BadgeIcon badge={(() => { const member = multiplayer.players.find((player) => player.name === multiplayer.currentTurn) ?? multiplayer.spectators.find((spectator) => spectator.name === multiplayer.currentTurn); return member?.badge; })()} /><TitleChip title={(() => { const member = multiplayer.players.find((player) => player.name === multiplayer.currentTurn) ?? multiplayer.spectators.find((spectator) => spectator.name === multiplayer.currentTurn); return member?.title; })()} /> {multiplayer.currentTurn}</strong></div>{multiplayer.role === "player" && !multiplayer.bothPlayersReady && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-300/15 bg-slate-950/25 p-4 sm:flex-row sm:items-end"><div><label htmlFor="multiplayer-bet" className="text-xs font-bold uppercase tracking-wider text-emerald-100/65">{multiplayer.winner ? "Rematch stake" : "Stake"}</label>{multiplayer.stake !== null && <p className="mt-1 text-xs text-emerald-200">Room stake: {multiplayer.stake.toFixed(2)} moose bucks</p>}<div className="mt-2 flex items-center gap-2"><input id="multiplayer-bet" type="number" min="1" max="250" value={multiplayerBet || ""} onChange={(event) => setMultiplayerBet(Number(event.target.value) || 0)} disabled={multiplayer.isReady} className="w-32 rounded-lg border border-emerald-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-emerald-300" /><span className="text-sm text-emerald-100/65">moose bucks</span></div></div><button onClick={() => void readyMultiplayer()} disabled={multiplayer.isReady} className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-bold text-[#092f2b] disabled:cursor-not-allowed disabled:opacity-40">{multiplayer.isReady ? "Stake placed" : multiplayer.winner ? "Play rematch" : "Place stake & ready"}</button></div>}<div className="my-5 flex items-center justify-center gap-4"><CardView hidden style={cardStyle} hiddenStyle={hiddenCardStyle ?? undefined} /><CardView card={multiplayer.top ?? undefined} style={cardStyle} /><div className={`flex h-12 w-12 items-center justify-center rounded-full text-[10px] font-bold uppercase ${cardStyle[multiplayer.activeColor]}`}>{colorLabels[multiplayer.activeColor]}</div></div>            <div className="flex flex-wrap items-end justify-center gap-2">{multiplayer.hand.map((card) => <CardView key={card.id} card={card} onClick={() => playMultiplayerCard(card)} style={cardStyle} playable={multiplayerCardIsPlayable(card) && !multiplayerPendingWild} dim={!multiplayerCardIsPlayable(card)} />)}</div>
            {multiplayerPendingWild && multiplayer.isYourTurn && (
              <div className="mt-6 text-center" role="group" aria-label="Choose a color for your wild card">
                <p className="mb-3 text-sm font-semibold text-emerald-100">Choose a color for your {describe(multiplayerPendingWild)}</p>
                <div className="flex justify-center gap-3">{colors.map((color) => <button key={color} onClick={() => chooseMultiplayerColor(color)} className={`h-12 w-12 rounded-full border-4 border-white/80 text-xs font-bold shadow-lg transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${cardStyle[color]}`} aria-label={colorLabels[color]}>{colorLabels[color][0]}</button>)}</div>
                <button onClick={() => setMultiplayerPendingWild(null)} className="mt-3 text-xs text-emerald-100/65 hover:text-white">Cancel</button>
              </div>
            )}
            {multiplayerPendingSwitch && multiplayer.isYourTurn && (
              <div className="mt-6 rounded-xl border border-amber-300/30 bg-amber-950/30 p-4 text-center" role="group" aria-label="Choose a player to switch hands with">
                <p className="mb-3 text-sm font-semibold text-amber-100">Choose a player to switch hands with</p>
                <div className="flex flex-wrap justify-center gap-2">{multiplayer.opponents.map((opponent) => <button key={opponent.id} onClick={() => chooseMultiplayerSwitchTarget(opponent.id)} className="rounded-lg border border-amber-200/50 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-amber-300/20">{opponent.name} ({opponent.cardCount} cards)</button>)}</div>
                <button onClick={() => setMultiplayerPendingSwitch(null)} className="mt-3 text-xs text-emerald-100/65 hover:text-white">Cancel</button>
              </div>
            )}
            <div className="mt-5 flex justify-center gap-3"><button onClick={() => void sendMultiplayerMove({ type: "draw" })} disabled={multiplayer.role !== "player" || !multiplayer.bothPlayersReady || !multiplayer.isYourTurn || multiplayer.drawnId !== null || !!multiplayer.winner || !!multiplayerPendingWild} className="rounded-lg border border-emerald-300/50 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-40">Draw</button><button onClick={() => void sendMultiplayerMove({ type: "pass" })} disabled={multiplayer.role !== "player" || !multiplayer.bothPlayersReady || !multiplayer.isYourTurn || multiplayer.drawnId === null || !!multiplayer.winner || !!multiplayerPendingWild} className="rounded-lg border border-emerald-300/50 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-40">Pass</button></div><p className="mt-4 text-center text-sm text-emerald-100" aria-live="polite">{multiplayer.winner ? `${multiplayer.winner} wins!` : multiplayer.message}</p></div>}
          {multiplayerMessage && <p className="mt-4 text-sm text-emerald-200" aria-live="polite">{multiplayerMessage}</p>}
        </section>}
        {unoTab === "local" && <section className="rounded-3xl border border-sky-300/20 bg-[#0b2741]/90 p-5 shadow-2xl sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start"><div><p className="text-xs uppercase tracking-wider text-sky-100/55">Banking balance</p><p className="mt-1 text-2xl font-bold text-sky-200">{balance.toFixed(2)} <span className="text-sm font-normal text-sky-100/55">moose bucks</span></p><p className="mt-2 text-xs text-sky-100/55">UNO returns 95% of a winning profit plus your original stake.</p></div><div className="flex items-center gap-3"><div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"><p className="text-xs uppercase tracking-wider text-sky-100/55">AI hand</p><p className="mt-1 text-xl font-bold text-sky-200">{g.ai.length} cards</p></div><button onClick={startGame} disabled={inProgress} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-bold text-[#071426] hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">{inProgress ? "Game in progress" : "New game"}</button></div></div>
          <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="rounded-2xl border border-emerald-300/10 bg-[#0a3a36]/70 p-5 sm:p-8">
            <div className="flex min-h-36 items-center justify-center overflow-hidden">
              <div className="flex -space-x-12 sm:-space-x-14">{g.ai.slice(0, 10).map((card) => <CardView key={card.id} hidden style={cardStyle} hiddenStyle={hiddenCardStyle ?? undefined} />)}</div>
              {g.ai.length === 0 && <div className="flex h-28 w-20 items-center justify-center rounded-xl border border-dashed border-sky-200/30 text-sm text-sky-100/50 sm:h-36 sm:w-24">AI</div>}
            </div>
            <div className="my-8 flex flex-wrap items-center justify-center gap-6 border-y border-white/10 py-8">
              <div className="text-center"><p className="mb-3 text-xs uppercase tracking-widest text-sky-100/55">Draw pile</p><button onClick={drawCard} disabled={(!playerTurn && !localOpponentTurn) || g.drawnId !== null} aria-label="Draw a card" className="group relative block rounded-xl disabled:cursor-not-allowed"><span className="block rounded-xl transition group-enabled:group-hover:-translate-y-1 group-enabled:group-hover:shadow-2xl"><CardView hidden style={cardStyle} hiddenStyle={hiddenCardStyle ?? undefined} /></span><span className="absolute inset-x-0 -bottom-6 text-xs text-sky-100/55">{g.deck.length} left</span></button></div>
              <div className="text-center"><p className="mb-3 text-xs uppercase tracking-widest text-sky-100/55">Discard pile</p>{top ? <CardView card={top} style={cardStyle} /> : <div className="h-28 w-20 rounded-xl border border-dashed border-white/20 sm:h-36 sm:w-24" />}</div>
              <div className="text-center"><p className="mb-3 text-xs uppercase tracking-widest text-sky-100/55">Active color</p><div className={`flex h-16 w-16 items-center justify-center rounded-full text-xs font-bold uppercase shadow-lg ${cardStyle[g.color]}`}>{colorLabels[g.color]}</div></div>
            </div>
            <div className="flex min-h-36 flex-wrap items-end justify-center gap-2">{g.player.map((card) => <CardView key={card.id} card={card} style={cardStyle} onClick={() => handlePlay(card)} playable={isPlayable(card)} dim={playerTurn} />)}</div>
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
                <label htmlFor="uno-ruleset" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Ruleset</label>
                <select id="uno-ruleset" value={ruleset} onChange={(event) => setRuleset(event.target.value as Ruleset)} disabled={inProgress} className="mt-2 w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-sky-400">
                  <option value="regular">Regular UNO</option>
                  <option value="no-mercy">UNO No Mercy</option>
                </select>
                <p className="mt-2 text-xs text-sky-100/45">{ruleset === "no-mercy" ? "Includes +6, +10, hand switch, higher-card stacking, and knockout at 25 cards." : "Classic deck with +2 and +4 stacking."}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Game status</p>
                <p className="mt-2 text-sm text-sky-100/65">{!g.started ? "Waiting to start" : g.winner ? "Game over" : g.turn === "player" ? "Your turn" : "AI turn"} · {g.player.length} cards left · {g.started ? (g.ruleset === "no-mercy" ? "No Mercy" : "Regular") : ruleset === "no-mercy" ? "No Mercy selected" : "Regular selected"}</p>
                <button onClick={pass} disabled={!playerTurn || g.drawnId === null} className="mt-3 w-full rounded-xl border border-sky-300/40 px-5 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-30">Keep &amp; pass</button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <label htmlFor="uno-bet" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">Bet amount</label>
                <div className="mt-2 flex items-center gap-2">                <input id="uno-bet" type="number" min="1" max={MAX_BET} value={bet || ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setBet(Number(event.target.value) || 0)} disabled={inProgress} className="w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-sky-400" /><span className="text-sm text-sky-100/65">moose bucks</span></div><p className="mt-2 text-xs text-sky-100/45">Table limit: {MAX_BET} moose bucks</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <label htmlFor="uno-speed" className="text-xs font-bold uppercase tracking-wider text-sky-100/65">AI speed</label>
                <select id="uno-speed" value={aiDelay} onChange={(event) => setAiDelay(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-sky-200/20 bg-slate-900 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-sky-400">
                  <option value={5000}>Slow — 5s per move</option>
                  <option value={2000}>Normal — 2s per move</option>
                  <option value={1000}>Fast — 1s per move</option>
                </select>
                <p className="mt-2 text-xs text-sky-100/45">How long the AI pauses before each move. Applies immediately, even mid-game.</p>
              </div>
            </aside>
          </div>
        </section>}
      </section>
    </main>
  );
}