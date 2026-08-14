export function refreshOtterBoard(otterState) {
  document.querySelector("#fish").textContent = otterState.kelpCoins;
  document.querySelector("#otter-count").textContent = otterState.pebbles;
  document.querySelector("#otter-cost").textContent = otterState.denFee;
  document.querySelector("#rod-level").textContent = otterState.paddleLevel;
  document.querySelector("#rod-price").textContent = otterState.whiskerPrice;
}
