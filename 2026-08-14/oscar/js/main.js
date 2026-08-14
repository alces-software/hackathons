import { otterState, SAVED_KEY } from "./state.js";
import { splashClick, hirePaddler, gatherSplash, polishWand, collectPretty } from "./game.js";
import { refreshOtterBoard } from "./ui.js";

const pawButton = document.querySelector("#click-button");
const buddyButton = document.querySelector("#hire-otter");
const wandButton = document.querySelector("#upgrade-rod");
const prettyButton = document.querySelector("#collect-rock");
const resetButton = document.querySelector("#reset-button");

resetButton.addEventListener("click", () => {
  localStorage.removeItem(SAVED_KEY);
  location.reload();
});

pawButton.addEventListener("click", () => {
  splashClick(otterState);
  refreshOtterBoard(otterState);
});

buddyButton.addEventListener("click", () => {
  const snappedUp = hirePaddler(otterState);

  if (snappedUp) {
    refreshOtterBoard(otterState);
  }
});

wandButton.addEventListener("click", () => {
  const snappedUp = polishWand(otterState);

  if (snappedUp) {
    refreshOtterBoard(otterState);
  }
});

prettyButton.addEventListener("click", () => {
  const snappedUp = collectPretty(otterState);

  if (snappedUp) {
    refreshOtterBoard(otterState);
  }
});

function startOtterProduction() {
  if (otterState.pebbles === 0) {
    setTimeout(startOtterProduction, 100);
    return;
  }

  const driftGap = otterState.riverLag / otterState.pebbles;

  setTimeout(() => {
    gatherSplash(otterState);
    refreshOtterBoard(otterState);

    startOtterProduction();
  }, driftGap);
}

startOtterProduction();

refreshOtterBoard(otterState);
