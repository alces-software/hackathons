export function splashClick(otterState) {
  otterState.kelpCoins += otterState.splashPower;
}

export function hirePaddler(otterState) {
  if (otterState.kelpCoins < otterState.denFee) {
    return false;
  }

  otterState.kelpCoins -= otterState.denFee;
  otterState.pebbles++;

  otterState.denFee = Math.ceil(otterState.denFee * 1.1);

  otterState.inventory.push("🦦");

  return true;
}

export function gatherSplash(otterState) {
  otterState.kelpCoins += otterState.pawYield * otterState.happiness;
}

export function polishWand(otterState) {
  if (otterState.kelpCoins < otterState.whiskerPrice) {
    return false;
  }

  otterState.kelpCoins -= otterState.whiskerPrice;
  otterState.paddleLevel++;
  otterState.splashPower++;

  otterState.whiskerPrice = Math.ceil(otterState.whiskerPrice * 1.4);

  otterState.inventory.push("🎣");

  return true;
}

export function collectPretty(otterState) {
  if (otterState.kelpCoins < otterState.prettyToll) {
    return false;
  }

  otterState.kelpCoins -= otterState.prettyToll;
  otterState.happiness++;
  otterState.prettyToll = Math.ceil(otterState.prettyToll * 1.1);

  otterState.inventory.push("🪨");

  return true;
}
