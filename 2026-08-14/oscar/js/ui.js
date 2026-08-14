import { SAVED_KEY } from "./state.js";

const FISH_TIERS = [
  { emoji: "🐋", per: 2500 },
  { emoji: "🐠", per: 50 },
  { emoji: "🐟", per: 1 },
];

function renderFishInventory(count) {
  const parts = [];
  let remaining = count;
  for (const tier of FISH_TIERS) {
    const n = Math.floor(remaining / tier.per);
    remaining -= n * tier.per;
    if (n) parts.push(Array.from({ length: n }, () => tier.emoji).join(" "));
  }
  return parts.join(" ");
}

export function refreshOtterBoard(otterState) {
  document.querySelector("#fish").textContent = otterState.kelpCoins;
  document.querySelector("#otter-count").textContent = otterState.pebbles;
  document.querySelector("#otter-cost").textContent = otterState.denFee;
  document.querySelector("#rod-level").textContent = otterState.paddleLevel;
  document.querySelector("#rod-price").textContent = otterState.whiskerPrice;
  document.querySelector("#rock-count").textContent = otterState.happiness;
  document.querySelector("#rock-toll").textContent = otterState.prettyToll;
  document.querySelector("#fish-inventory").textContent = renderFishInventory(otterState.kelpCoins);
  document.querySelector("#purchases-inventory").textContent = otterState.inventory.join(" ");

  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(otterState));
  } catch {
  }
}
