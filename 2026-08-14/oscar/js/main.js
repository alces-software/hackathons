import { otterState, SAVED_KEY } from "./state.js";
import { splashClick, hirePaddler, gatherSplash, polishWand, collectPretty, hireCrab, crabSplash } from "./game.js";
import { refreshOtterBoard } from "./ui.js";

// const pawButton = document.querySelector("#click-button");
const buddyButton = document.querySelector("#hire-otter");
const wandButton = document.querySelector("#upgrade-rod");
const prettyButton = document.querySelector("#collect-rock");
const crabButton = document.querySelector("#hire-crab");
const resetButton = document.querySelector("#reset-button");
const startFishingButton = document.querySelector("#start-fishing-button");
const pondMusic = document.querySelector("#pond-music");
const pond = document.querySelector("#pond");
const pondFish = document.querySelectorAll(".pond-fish");



resetButton.addEventListener("click", () => {
  localStorage.removeItem(SAVED_KEY);
  location.reload();
});



// pawButton.addEventListener("click", () => {
//   splashClick(otterState);
//   refreshOtterBoard(otterState);
// });

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

crabButton.addEventListener("click", () => {
  const snappedUp = hireCrab(otterState);

  if (snappedUp) {
    refreshOtterBoard(otterState);
  }
});

startFishingButton.addEventListener("click", () => {
  pond.classList.remove("is-hidden");
  pondMusic.play();
  pondFish.forEach(randomiseFish);
  startFishingButton.style.display = "none";
});

function randomiseFish(fish) {
  fish.style.left = `${Math.random() * 80 + 10}%`;
  fish.style.top = `${Math.random() * 65 + 15}%`;
}

pondFish.forEach((fish) => {
  fish.addEventListener("click", () => {
    splashClick(otterState);
    refreshOtterBoard(otterState);
    randomiseFish(fish);
  });
});

setInterval(() => {
  if (!pond.classList.contains("is-hidden")) {
    pondFish.forEach(randomiseFish);
  }
}, 1500);

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

setInterval(() => {
  if (!otterState.crabActive) {
    return;
  }

  if (Date.now() >= otterState.crabEndTime) {
    otterState.crabActive = false;
    refreshOtterBoard(otterState);
    return;
  }

  crabSplash(otterState);
  refreshOtterBoard(otterState);
}, 2000);

refreshOtterBoard(otterState);

const fishingRod = document.querySelector("#fishing-rod");

pond.addEventListener("mousemove", (event) => {
  const pondBox = pond.getBoundingClientRect();
  const x = event.clientX - pondBox.left;
  const y = event.clientY - pondBox.top;

  fishingRod.style.transform = `translate(${x}px, ${y}px) translate(-20%, -10%) rotate(-25deg)`;
});

pond.addEventListener("mouseleave", () => {
  fishingRod.style.display = "none";
});

pond.addEventListener("mouseenter", () => {
  fishingRod.style.display = "block";
});
