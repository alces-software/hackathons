export const SAVED_KEY = "otterState";

const defaults = {
  kelpCoins: 0,

  splashPower: 1,

  pebbles: 0,

  paddleLevel: 1,
  whiskerPrice: 100,

  denFee: 25,
  denBaseFee: 25,
  riverLag: 5000,
  pawYield: 1,
  prettyToll: 150,
  happiness: 1,

  crabCost: 300,
  crabActive: false,
  crabEndTime: 0,

  inventory: [],
};

export const otterState = (() => {
  try {
    const saved = localStorage.getItem(SAVED_KEY);
    return saved ? { ...defaults, ...JSON.parse(saved) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
})();
