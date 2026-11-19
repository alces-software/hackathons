// Self-contained UNO engine + local-game AI. The React page (app/uno/page.tsx) renders the
// states this module produces; lib is kept UI-free so the local AI can be simulated in tests.
export type Color = "red" | "yellow" | "green" | "blue" | "wild";
export type PlayColor = Exclude<Color, "wild">;
export type Value = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "skip" | "reverse" | "draw2" | "wild" | "draw4" | "draw6" | "draw10" | "switch" | "discardColor" | "drawColor";
export type Card = { id: number; color: Color; value: Value };
export type Who = "player" | "ai";
export type GameMode = "ai" | "local";
export type Ruleset = "regular" | "no-mercy";
export type Game = {
  deck: Card[];
  player: Card[];
  ai: Card[];
  discard: Card[];
  color: PlayColor; // the colour currently in play (differs from the top card after a wild)
  turn: Who;
  started: boolean;
  winner: "You" | "AI" | "Player 2" | null;
  drawnId: number | null; // after drawing a playable card, only that card may be played (or you pass)
  pendingDraw: number;
  pendingDrawColor: PlayColor | null;
  message: string;
  stake: number;
  mode: GameMode;
  ruleset: Ruleset;
};

export const colors: PlayColor[] = ["red", "yellow", "green", "blue"];
export const colorLabels: Record<Color, string> = { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue", wild: "Wild" };
export const valueNames: Record<Value, string> = { "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", skip: "Skip", reverse: "Reverse", draw2: "+2", wild: "", draw4: "+4", draw6: "+6", draw10: "+10", switch: "Hand switch", discardColor: "Discard a color", drawColor: "Draw to a color" };

export const emptyGame: Game = {
  deck: [], player: [], ai: [], discard: [], color: "blue", turn: "player", started: false,
  winner: null, drawnId: null, pendingDraw: 0, message: "", stake: 0,
  mode: "ai", ruleset: "regular", pendingDrawColor: null,
};

export function shuffle(cards: Card[]) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

export function makeDeck(ruleset: Ruleset) {
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
    if (ruleset === "no-mercy") {
      deck.push(
        { id: id++, color: "wild", value: "draw6" },
        { id: id++, color: "wild", value: "draw10" },
        { id: id++, color: "wild", value: "drawColor" },
      );
      colors.forEach((color) => deck.push({ id: id++, color, value: "discardColor" }));
      colors.forEach((color) => deck.push({ id: id++, color, value: "switch" }));
    }
  }
  return shuffle(deck);
}

export function describe(card: Card) {
  return card.color === "wild" ? `Wild${drawAmount(card.value) > 0 ? ` +${drawAmount(card.value)}` : ` ${valueNames[card.value]}`}` : `${colorLabels[card.color]} ${valueNames[card.value]}`;
}

export function drawAmount(value: Value) {
  return value === "draw2" ? 2 : value === "draw4" ? 4 : value === "draw6" ? 6 : value === "draw10" ? 10 : 0;
}

export function drawUntilColor(g: Game, who: Who, color: PlayColor) {
  let state = g;
  let drawn = 0;
  while (state.deck.length > 0) {
    state = drawCards(state, who, 1);
    drawn++;
    const hand = state[who];
    if (hand[hand.length - 1]?.color === color) break;
  }
  return { state, drawn };
}

export function canPlay(card: Card, top: Card, activeColor: PlayColor, pendingDraw = 0, ruleset: Ruleset = "regular", pendingDrawColor: PlayColor | null = null) {
  if (pendingDrawColor !== null) return false;
  if (pendingDraw > 0) {
    const amount = drawAmount(card.value);
    const topAmount = drawAmount(top.value);
    return amount > 0 && (ruleset === "no-mercy" ? amount >= topAmount : amount === topAmount);
  }
  return card.color === "wild" || card.color === activeColor || card.value === top.value;
}

export function newGame(stake: number, mode: GameMode, ruleset: Ruleset): Game {
  const shuffled = makeDeck(ruleset);
  const rest = shuffled.slice(14);
  // Start on a plain number card so no action card has to be resolved before the first turn.
  const [start] = rest.splice(rest.findIndex((card) => /^\d$/.test(card.value)), 1);
  return { ...emptyGame, deck: rest, player: shuffled.slice(0, 7), ai: shuffled.slice(7, 14), discard: [start], color: start.color as PlayColor, started: true, stake, mode, ruleset, message: "Your turn — play a matching card or draw." };
}

// Moves cards from the deck to a hand, reshuffling the discard pile (keeping its top card) if the deck runs out.
export function drawCards(g: Game, who: Who, count: number): Game {
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

// Plays a card for either side and applies the selected ruleset's action cards.
export function playCard(g: Game, who: Who, card: Card, chosen?: PlayColor): Game {
  const other: Who = who === "player" ? "ai" : "player";
  const opponentLabel = g.mode === "local" ? "Player 2" : "AI";
  const actor = who === "player" ? "You" : opponentLabel;
  const victim = who === "player" ? opponentLabel : "You";
  const hand = g[who].filter((item) => item.id !== card.id);
  const color: PlayColor = card.color === "wild" ? chosen ?? "blue" : card.color;
  let next: Game = { ...g, discard: [...g.discard, card], color, drawnId: null, pendingDrawColor: null };
  next = who === "player" ? { ...next, player: hand } : { ...next, ai: hand };
  const label = describe(card) + (card.color === "wild" ? `, choosing ${colorLabels[color]}` : "");
  if (hand.length === 0) return { ...next, winner: actor, message: `${actor} played ${label} and went out.` };

  let text = `${actor} played ${label}.`;
  let skip = false;
  if (card.value === "draw2" || card.value === "draw4" || card.value === "draw6" || card.value === "draw10") {
    const amount = drawAmount(card.value);
    next = { ...next, pendingDraw: g.pendingDraw + amount };
    text += ` ${victim} must stack a ${valueNames[card.value]} or draw ${next.pendingDraw}.`;
  } else if (card.value === "switch" && g.ruleset === "no-mercy") {
    next = who === "player"
      ? { ...next, player: g.ai, ai: hand }
      : { ...next, player: hand, ai: g.player };
    text += ` ${actor} switched hands with ${victim}.`;
  } else if (card.value === "discardColor" && g.ruleset === "no-mercy") {
    const targetHand = who === "player" ? next.player : next.ai;
    const kept = targetHand.filter((item) => item.color !== color);
    next = who === "player" ? { ...next, player: kept } : { ...next, ai: kept };
    text += ` ${actor} discarded all ${colorLabels[color]} cards.`;
    // Playing the last discardColor for a wiped colour wins, same as any other empty hand.
    if (kept.length === 0) return { ...next, winner: actor, message: `${actor} discarded all ${colorLabels[color]} cards and went out.` };
  } else if (card.value === "drawColor" && g.ruleset === "no-mercy") {
    next = { ...next, pendingDrawColor: color };
    text += ` ${victim} must draw until finding a ${colorLabels[color]} card.`;
  } else if (card.value === "skip" || card.value === "reverse") {
    skip = true;
    text += ` ${victim} ${victim === "You" ? "are" : "is"} skipped.`;
  }
  const turn: Who = skip ? who : other;
  return { ...next, turn, message: `${text} ${turn === "player" ? "Your turn." : g.mode === "local" ? "Pass the device to Player 2." : "AI is thinking..."}` };
}

// How strong each AI tactic is, 0–100. Tuned so a greedy human-level player wins about half
// the games; raise the difficulty by weighting the tactical heuristics higher.
export type AiTactics = {
  winOut: number; // play the go-out card
  stackContinuation: number; // keep draw-stacks going
  punishNearUno: number; // draw/skip weight as the opponent nears UNO
  skipReverse: number; // base weight for skip/reverse
  colorMomentum: number; // weight per card in the colour we hold most of
  numberBurn: number; // weight per pip on number cards
  hoardWild: number; // penalty for playing wilds/draw4s early
  endgameWild: number; // bonus for wilds/draw4s when the opponent is close to going out
  discardColorMass: number; // weight per own-colour card behind a discardColor
  switchAdvantage: number; // weight for switching to the bigger hand
};

export const DEFAULT_TACTICS: AiTactics = {
  winOut: 100,
  stackContinuation: 100,
  punishNearUno: 100,
  skipReverse: 100,
  colorMomentum: 100,
  numberBurn: 100,
  hoardWild: 100,
  endgameWild: 100,
  discardColorMass: 100,
  switchAdvantage: 100,
};

export function aiMoveTactical(g: Game, tactics: AiTactics = DEFAULT_TACTICS): Game {
  if (!g.started || g.winner || g.turn !== "ai") return g;
  const top = g.discard[g.discard.length - 1];
  let state = g;
  const hand = g.ai.filter((card) => {
    if (!canPlay(card, top, g.color, g.pendingDraw, g.ruleset, g.pendingDrawColor)) return false;
    return card.value !== "switch" || g.ai.length > g.player.length;
  });
  if (hand.length === 0) {
    if (g.pendingDrawColor !== null) {
      const colorDraw = drawUntilColor(g, "ai", g.pendingDrawColor);
      state = { ...colorDraw.state, pendingDrawColor: null, turn: "player", message: `The AI drew ${colorDraw.drawn} cards until finding ${colorLabels[g.pendingDrawColor]}. Your turn.` };
      if (state.ai.length >= 25 && g.ruleset === "no-mercy") return { ...state, winner: "You", message: "The AI reached 25 cards — No Mercy knockout!" };
      return state;
    }
    const drawCount = g.pendingDraw > 0 ? g.pendingDraw : 1;
    state = drawCards(g, "ai", drawCount);
    if (state.ai.length === g.ai.length) return { ...state, turn: "player", message: "The deck is empty — your turn." };
    if (g.ruleset === "no-mercy" && state.ai.length >= 25) return { ...state, winner: "You", pendingDraw: 0, message: "The AI reached 25 cards — No Mercy knockout!" };
    const drawn = state.ai[state.ai.length - 1];
    if (g.pendingDraw > 0) return { ...state, turn: "player", pendingDraw: 0, message: `The AI drew ${drawCount} cards. Your turn.` };
    if (!canPlay(drawn, top, g.color, 0, g.ruleset)) return { ...state, turn: "player", pendingDraw: 0, message: "The AI drew a card. Your turn." };
    // Keep the AI turn active so the drawn card is visible before its next move.
    return { ...state, turn: "ai", message: g.pendingDraw > 0 ? "AI drew a playable card to stack..." : "AI drew a playable card..." };
  }
  // Tactical play: take an instant win, ride the colour we hold most of, dump expensive number
  // cards early, punish the player as they near UNO, and bank wilds for the endgame.
  const colorCounts = new Map<PlayColor, number>(colors.map((color) => [color, g.ai.filter((card) => card.color === color).length]));
  const playerCount = g.player.length;
  const score = (card: Card): number => {
    if (g.pendingDrawColor === null && g.ai.length === 1) return 1_000_000 * (tactics.winOut / 100);
    if (canPlay(card, top, g.color, g.pendingDraw, g.ruleset, g.pendingDrawColor) && g.ai.length === 1) return 1_000_000 * (tactics.winOut / 100);
    let value = 0;
    const ownColor = colorCounts.get(card.color as PlayColor) ?? 0;
    if (card.color !== "wild") value += ownColor * 2 * (tactics.colorMomentum / 100);
    const numeric = Number(card.value);
    if (Number.isFinite(numeric)) value += numeric * 0.3 * (tactics.numberBurn / 100);
    const amount = drawAmount(card.value);
    if (g.pendingDraw > 0) {
      value += amount * 10 * (tactics.stackContinuation / 100);
      if (card.color === "wild") value -= 8 * (tactics.stackContinuation / 100);
    } else if (amount > 0) {
      // Reserve big draw punishment for the endgame; otherwise the AI draws the player every
      // turn and no-mercy's draw10/drawColor make mid-game too oppressive (player win rate).
      // Regular keeps its mild mid-game draw weight.
      value += playerCount <= 2 ? (18 + amount * 4) * (tactics.punishNearUno / 100) : g.ruleset === "no-mercy" ? 2 : 7 + amount * (tactics.punishNearUno / 100);
    }
    if (card.value === "skip" || card.value === "reverse") value += (playerCount <= 2 ? 14 : 6) * (tactics.skipReverse / 100);
    if (card.value === "switch") value += (4 + Math.max(0, g.ai.length - playerCount) * 3) * (tactics.switchAdvantage / 100);
    if (card.value === "discardColor") value += (ownColor >= 3 ? 10 + ownColor * 3 : ownColor === 2 ? 4 : -6) * (tactics.discardColorMass / 100);
    if (card.value === "drawColor") value += 5 + ownColor * 2;
    if (card.color === "wild" && card.value === "wild") value += playerCount <= 3 ? 20 * (tactics.endgameWild / 100) : -40 * (tactics.hoardWild / 100);
    if (card.color === "wild" && card.value === "draw4") value += playerCount <= 3 ? 26 * (tactics.endgameWild / 100) : -25 * (tactics.hoardWild / 100);
    return value;
  };
  const chosen = [...hand].sort((a, b) => score(b) - score(a))[0];
  let wildColor: PlayColor | undefined;
  if (chosen.color === "wild") {
    // Choose the colour we hold most of; break ties toward heavier number cards to keep playing.
    const weights = new Map<PlayColor, number>();
    for (const color of colors) {
      const own = g.ai.filter((card) => card.color === color);
      weights.set(color, own.length * 10 + own.reduce((sum, card) => sum + (Number(card.value) || 0), 0));
    }
    wildColor = [...weights.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? colors[0];
  }
  return playCard(state, "ai", chosen, wildColor);
}

// Playable-card choice for the local hotseat player. Baseline is the same greedy the page used
// before the AI got tactical: prefer action cards (draw > skip/reverse > discardColor > drawColor)
// then the highest number, with switch gated to when it helps.
export function playerBaselineMove(g: Game): Game {
  if (!g.started || g.winner || g.turn !== "player" || g.drawnId !== null) return g;
  const top = g.discard[g.discard.length - 1];
  if (!top) return g;
  if (g.pendingDrawColor !== null) {
    // Draw-to-colour has no alternative action in no-mercy, so resolve it like the page does.
    return drawPlayer(g);
  }
  if (g.pendingDraw > 0) {
    // A real player stacks: play the biggest available draw card onto the pending stack.
    const stackHand = g.player.filter((card) => canPlay(card, top, g.color, g.pendingDraw, g.ruleset, g.pendingDrawColor));
    if (stackHand.length === 0) return drawPlayer(g);
    const chosen = [...stackHand].sort((a, b) => drawAmount(b.value) - drawAmount(a.value))[0];
    if (chosen.color === "wild") {
      const weights = colors.map((color) => [color, g.player.filter((card) => card.color === color).length] as const);
      const best = weights.sort((a, b) => b[1] - a[1])[0]?.[0] ?? colors[0];
      return playCard(g, "player", chosen, best);
    }
    return playCard(g, "player", chosen);
  }
  const ownCounts = new Map<PlayColor, number>(colors.map((color) => [color, g.player.filter((card) => card.color === color).length]));
  const hand = g.player.filter((card) => canPlay(card, top, g.color, 0, g.ruleset) && (card.value !== "switch" || g.player.length <= g.ai.length));
  if (hand.length === 0) return drawPlayer(g);
  // Greedy "decent player": favour draw cards, then ride the colour they hold most of and shed
  // heavy number cards, preferring skip/reverse to keep control.
  const score = (card: Card): number => {
    if (g.player.length === 1) return 1000;
    let value = 0;
    if (card.color === "wild" && (card.value === "wild" || card.value === "draw4")) {
      return g.player.length <= 4 ? 30 : -5;
    }
    if (card.color !== "wild") value += (ownCounts.get(card.color as PlayColor) ?? 0) * 2;
    const d = drawAmount(card.value);
    if (d > 0) value += 20 + d * 6; // always punish when able; small extra for bigger draws
    if (card.value === "skip" || card.value === "reverse") value += 10;
    if (card.value === "discardColor") value += (ownCounts.get(card.color as PlayColor) ?? 0) >= 3 ? 22 : 2;
    if (card.value === "drawColor") value += 5 + (ownCounts.get(card.color as PlayColor) ?? 0) * 2;
    if (card.value === "switch") value += 4 + Math.max(0, g.player.length - g.ai.length) * 3;
    const n = Number(card.value);
    if (Number.isFinite(n)) value += n * 0.6;
    return value;
  };
  const chosen = [...hand].sort((a, b) => score(b) - score(a))[0];
  if (chosen.color === "wild") {
    const weights = colors.map((color) => [color, g.player.filter((card) => card.color === color).length] as const);
    const best = weights.sort((a, b) => b[1] - a[1])[0]?.[0] ?? colors[0];
    return playCard(g, "player", chosen, best);
  }
  return playCard(g, "player", chosen);
}

// Resolves the player's pending draw exactly like the page's draw button: pull the stack or
// draw-to-colour, then pass the turn (a fresh playable card is not auto-played).
function drawPlayer(g: Game): Game {
  const top = g.discard[g.discard.length - 1];
  if (g.pendingDrawColor !== null) {
    const color = g.pendingDrawColor;
    const result = drawUntilColor(g, "player", color);
    const state: Game = { ...result.state, pendingDrawColor: null, turn: "ai", message: `You drew ${result.drawn} cards until finding ${colorLabels[color]}.` };
    if (g.ruleset === "no-mercy" && state.player.length >= 25) {
      return { ...state, winner: "AI", message: "You reached 25 cards — No Mercy knockout!" };
    }
    return state;
  }
  const drawCount = g.pendingDraw > 0 ? g.pendingDraw : 1;
  const state = drawCards(g, "player", drawCount);
  if (state.player.length === g.player.length) return { ...state, pendingDraw: 0, turn: "ai", message: "Nothing left to draw — AI's turn." };
  if (g.ruleset === "no-mercy" && state.player.length >= 25) {
    return { ...state, winner: "AI", pendingDraw: 0, message: "You reached 25 cards — No Mercy knockout!" };
  }
  const drawn = state.player[state.player.length - 1];
  if (g.pendingDraw > 0) return { ...state, pendingDraw: 0, turn: "ai", message: `You drew ${drawCount} cards. AI is thinking...` };
  if (canPlay(drawn, top, g.color, 0, g.ruleset)) {
    return { ...state, drawnId: drawn.id, message: `You drew ${describe(drawn)} — play it, or keep it and pass.` };
  }
  return { ...state, turn: "ai", message: `You drew ${describe(drawn)}. AI is thinking...` };
}

// Runs the local game to completion: the player side plays the greedy baseline, the AI side its
// tactical AI. Used for win-rate simulation (and handy for debugging tactical regressions).
export function simulateGame(start: Game, tactics: AiTactics = DEFAULT_TACTICS, maxTurns = 400): "You" | "AI" | "Player 2" | "stalemate" {
  let state = start;
  for (let i = 0; i < maxTurns; i += 1) {
    if (state.winner) return state.winner;
    if (state.drawnId !== null) {
      // Both sides play a freshly drawn playable card (the AI's timer auto-plays; a human
      // almost always does), unless a pending stack keeps the turn (player passes then,
      // as they can only stack or draw, and the baseline resolves those immediately).
      if (state.turn === "player" && state.pendingDraw === 0) {
        const card = state.player.find((c) => c.id === state.drawnId);
        if (card) {
          const weights = colors.map((color) => [color, state.player.filter((c) => c.color === color).length] as const);
          const best = [...weights].sort((a, b) => b[1] - a[1])[0]?.[0] ?? colors[0];
          state = card.color === "wild" || card.value === "draw4"
            ? playCard(state, "player", card, best)
            : playCard(state, "player", card);
          continue;
        }
      }
      state = { ...state, drawnId: null, turn: state.turn === "player" ? "ai" : "player" };
      continue;
    }
    state = state.turn === "player" ? playerBaselineMove(state) : aiMoveTactical(state, tactics);
  }
  return "stalemate";
}
