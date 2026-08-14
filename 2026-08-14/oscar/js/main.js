import { otterState } from "./state.js";
import { splashClick, hirePaddler, gatherSplash, polishWand } from "./game.js";
import { refreshOtterBoard } from "./ui.js";

const pawButton = document.querySelector("#click-button");
const buddyButton = document.querySelector("#hire-otter");
const wandButton = document.querySelector("#upgrade-rod");

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
