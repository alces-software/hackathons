import {
  BoxRenderable,
  TextRenderable,
  createCliRenderer,
  MouseButton,
  ScrollBoxRenderable,
} from "@opentui/core"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  backgroundColor: "#1131E9",
  useMouse: true,
})

let money = 0
let moneyPerClick = 1
let moneyPerSecond = 0
let globalmult =1
let eventActive = false
let eventType = "none"
let eventTimeout: ReturnType<typeof setTimeout> | null = null
let moneyInterval: ReturnType<typeof setInterval> | null = null
let randomEventInterval: ReturnType<typeof setInterval> | null = null
let exiting = false
let totalClicks = 0
let totalFishEarned = 0
let totalEvents = 0
let totalChallengesWon = 0
let biggestCatch = 0
let startTime = Date.now()
let eventMultiplier = 1
let eventClicks = 0
let eventTarget = 0
let criticalChance = 0.05
let criticalMultiplier = 5
let totalCriticalClicks = 0
let criticalTextTimeout: ReturnType<typeof setTimeout> | null = null
let upgrade1Purchased = false
let upgrade2Purchased = false
let upgrade3Purchased = false
let upgrade4Purchased = false
let upgrade5Purchased = false
let upgrade6Purchased = false
let upgrade7Purchased = false
let upgrade8Purchased = false
let upgrade9Purchased = false

type Building = {
  name: string
  description: string
  baseCost: number
  costMultiplier: number
  fishPerSecond: number
  count: number
}

const buildings: Building[] = [
  {
    name: "Ice Fishing Hut",
    description: "+5 fish/sec",
    baseCost: 500,
    costMultiplier: 1.15,
    fishPerSecond: 5,
    count: 0,
  },
  {
    name: "Fish Farm",
    description: "+25 fish/sec",
    baseCost: 2_500,
    costMultiplier: 1.18,
    fishPerSecond: 25,
    count: 0,
  },
  {
    name: "Penguin Fishing Boat",
    description: "+100 fish/sec",
    baseCost: 10_000,
    costMultiplier: 1.20,
    fishPerSecond: 100,
    count: 0,
  },
  {
    name: "Arctic Factory",
    description: "+500 fish/sec",
    baseCost: 50_000,
    costMultiplier: 1.22,
    fishPerSecond: 500,
    count: 0,
  },
  {
    name: "Penguin Megafarm",
    description: "+2,500 fish/sec",
    baseCost: 250_000,
    costMultiplier: 1.25,
    fishPerSecond: 2_500,
    count: 0,
  },
  {
    name: "Deep Sea Trawler",
    description: "+12,500 fish/sec",
    baseCost: 1_250_000,
    costMultiplier: 1.28,
    fishPerSecond: 12_500,
    count: 0,
  },
  {
    name: "Glacial Drilling Rig",
    description: "+60,000 fish/sec",
    baseCost: 6_500_000,
    costMultiplier: 1.30,
    fishPerSecond: 60_000,
    count: 0,
  },
  {
    name: "Oceanic Clone Vault",
    description: "+300,000 fish/sec",
    baseCost: 35_000_000,
    costMultiplier: 1.32,
    fishPerSecond: 300_000,
    count: 0,
  },
  {
    name: "Sub-zero Teleporter",
    description: "+1,500,00 fish/sec",
    baseCost: 200_000_000,
    costMultiplier: 1.35,
    fishPerSecond: 1_500_000,
    count: 0,
  },
  {
    name: "Penguin Overlord Citadel",
    description: "+8,000,000 fish/sec",
    baseCost: 1_000_000_000,
    costMultiplier: 1.40,
    fishPerSecond: 8_000_0000,
    count: 0,
  }
]

function getBuildingCost(building: Building): number {
  return Math.floor(
    building.baseCost *
    Math.pow(building.costMultiplier, building.count)
  )
}

type RandomEvent = {
  name: string
  description: string
  duration: number
  multiplier: number
  type: "click" | "passive" | "all" | "instant" | "lose" | "challenge"
}

moneyInterval = setInterval(() => {
  if (exiting) return

  if (moneyPerSecond > 0) {
    let amount = moneyPerSecond * globalmult

    if (eventActive) {
      if (eventType === "passive" || eventType === "all") {
        amount *= eventMultiplier
      }
    }

    money += amount

totalFishEarned += amount

if (amount > biggestCatch) {
  biggestCatch = amount
}

updateMoney()
  }
}, 1000)
randomEventInterval = setInterval(() => {
  if (exiting) return

  if (!eventActive && Math.random() < 0.35) {
    startRandomEvent()
  }
}, 30_000)

function exitGame() {
  if (exiting) return

  exiting = true

  if (moneyInterval) {
    clearInterval(moneyInterval)
    moneyInterval = null
  }

  if (randomEventInterval) {
    clearInterval(randomEventInterval)
    randomEventInterval = null
  }

  if (eventTimeout) {
    clearTimeout(eventTimeout)
    eventTimeout = null
  }

  if (criticalTextTimeout) {
    clearTimeout(criticalTextTimeout)
    criticalTextTimeout = null
  }

  renderer.destroy()
}



const Money = new TextRenderable(renderer, {
  id: "Money",
  content: "Fish  0",
  fg: "#2980B9", 
})

function formatMoney(value: number): string {
    if (value >= 1_000_000_000_000_000) {
        return `${(value / 1_000_000_000_000_000).toFixed(2)}Q`
    }
    if (value >= 1_000_000_000_000) {
        return `${(value / 1_000_000_000_000).toFixed(2)}T`
    }
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(2)}B`
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2)}M`
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(2)}K`
    }
    return value.toString()
}

function updateMoney() {
  Money.content = `Fish  ${formatMoney(money)}`
}



  const events: RandomEvent[] = [
  {
    name: "FISH FRENZY",
    description: "2x fish from clicking!",
    duration: 10_000,
    multiplier: 2,
    type: "click",
  },

  {
    name: "PENGUIN RUSH",
    description: "3x passive fish!",
    duration: 15_000,
    multiplier: 3,
    type: "passive",
  },

  {
    name: "GOLDEN FISH",
    description: "A golden fish appeared!",
    duration: 0,
    multiplier: 1,
    type: "instant",
  },

  {
    name: "BIG WAVE",
    description: "Everything is worth 2x!",
    duration: 10_000,
    multiplier: 2,
    type: "all",
  },

  {
    name: "SEAL THIEF",
    description: "The seals stole some fish!",
    duration: 0,
    multiplier: 1,
    type: "lose",
  },


  {
    name: "FISH MIGRATION",
    description: "The fish are everywhere! 4x passive fish!",
    duration: 20_000,
    multiplier: 4,
    type: "passive",
  },

  {
    name: "ICE STORM",
    description: "Clicks are worth 5x!",
    duration: 8_000,
    multiplier: 5,
    type: "click",
  },

  {
    name: "KING PENGUIN",
    description: "Everything is worth 5x!",
    duration: 8_000,
    multiplier: 5,
    type: "all",
  },

  {
    name: "FISH MARKET",
    description: "The fish market is booming! 3x fish!",
    duration: 15_000,
    multiplier: 3,
    type: "all",
  },

  {
    name: "WHALE SIGHTING",
    description: "A giant whale appeared!",
    duration: 0,
    multiplier: 1,
    type: "instant",
  },

  {
    name: "FISHING CHALLENGE",
    description: "Catch 20 fish with clicks!",
    duration: 15_000,
    multiplier: 1,
    type: "challenge",
  },
]


  function startRandomEvent() {
  if (eventActive) return

  const event = events[Math.floor(Math.random() * events.length)]
  totalEvents++

  eventActive = true
  eventType = event.type
  eventMultiplier = event.multiplier

  eventText.content = `${event.name} - ${event.description}`

  if (eventTimeout) {
    clearTimeout(eventTimeout)
    eventTimeout = null
  }

  if (event.name === "GOLDEN FISH") {
    const reward = Math.max(
      100,
      moneyPerClick * 25
    )

    money += reward
    updateMoney()

    eventText.content =
      `GOLDEN FISH! +${formatMoney(reward)} fish!`

    eventTimeout = setTimeout(() => {
      endEvent()
    }, 5_000)

    return
  }

  if (event.name === "WHALE SIGHTING") {
    const reward = Math.max(
      500,
      moneyPerSecond * 100,
      moneyPerClick * 100
    )

    money += reward
    updateMoney()

    eventText.content =
      `WHALE SIGHTING! +${formatMoney(reward)} fish!`

    eventTimeout = setTimeout(() => {
      endEvent()
    }, 5_000)

    return
  }


  if (event.name === "SEAL THIEF") {
    const stolen = Math.floor(money * 0.10)

    money = Math.max(0, money - stolen)

    updateMoney()

    eventText.content =
      `SEAL THIEF! -${formatMoney(stolen)} fish!`

    eventTimeout = setTimeout(() => {
      endEvent()
    }, 5_000)

    return
  }


  if (event.type === "challenge") {
    eventClicks = 0
    eventTarget = 20

    eventText.content =
      `CHALLENGE: 0/${eventTarget} catches!`

    eventTimeout = setTimeout(() => {

      if (eventClicks >= eventTarget) {
        totalChallengesWon++
        const reward = moneyPerClick * 50

        money += reward

        updateMoney()

        eventText.content =
          `CHALLENGE COMPLETE! +${formatMoney(reward)} fish!`
      } else {
        eventText.content =
          `CHALLENGE FAILED! ${eventClicks}/${eventTarget}`
      }

      eventTimeout = setTimeout(() => {
        endEvent()
      }, 3_000)

    }, event.duration)

    return
  }


  eventTimeout = setTimeout(() => {
    endEvent()
  }, event.duration)
}
function endEvent() {
  eventActive = false
  eventType = "none"
  eventMultiplier = 1
  eventClicks = 0
  eventTarget = 0

  if (eventTimeout) {
    clearTimeout(eventTimeout)
    eventTimeout = null
  }

  if (exiting) return

  eventText.content = "No event currently"
}

const clickerView = new BoxRenderable(renderer, {
  left: 0,
  top: 0,
  width: 50,
  height: 18,
  backgroundColor: "#E6F2FF",  
  borderColor: "#2C3E50",       
  padding: 1,
  flexDirection: "column",
  gap: 1,
  alignItems: "center",
  visible: true,
  onMouseDown(event) {
  if (event.button === MouseButton.LEFT) {
    totalClicks++

    let amount = moneyPerClick * globalmult

    if (eventActive) {
  if (
    eventType === "click" ||
    eventType === "all"
  ) {
    amount *= eventMultiplier
  }
}

// Critical click
const isCritical = Math.random() < criticalChance

if (isCritical) {
  amount *= criticalMultiplier
  totalCriticalClicks++

  criticalText.content =
    `💥 CRITICAL CATCH! +${formatMoney(amount)} fish!`

  if (criticalTextTimeout) {
    clearTimeout(criticalTextTimeout)
  }

  criticalTextTimeout = setTimeout(() => {
    criticalText.content = ""
    criticalTextTimeout = null
  }, 1000)
}

    money += amount

totalFishEarned += amount

if (amount > biggestCatch) {
  biggestCatch = amount
}

    if (
      eventActive &&
      eventType === "challenge"
    ) {
      eventClicks++

      eventText.content =
        `CHALLENGE: ${eventClicks}/${eventTarget}!`

      if (eventClicks >= eventTarget) {
        const reward = moneyPerClick * 50

        money += reward

        updateMoney()

        eventText.content =
          `CHALLENGE COMPLETE! +${formatMoney(reward)} fish!`

        eventActive = false
        eventType = "none"
        eventMultiplier = 1

        if (eventTimeout) {
          clearTimeout(eventTimeout)
          eventTimeout = null
        }

        eventTimeout = setTimeout(() => {
          eventText.content = "No event currently"
        }, 3_000)

        return
      }
    }

    updateMoney()
  }
},
})

clickerView.add(
  new TextRenderable(renderer, {
    content: "🐧 PENGUIN CLICKER",
    fg: "#1A252F",              
  }),
)

clickerView.add(Money)

const perClickText = new TextRenderable(renderer, {
  content: "🐟 +1 fish per scoop",
  fg: "#2980B9",                
})
clickerView.add(perClickText)

const perSecondText = new TextRenderable(renderer, {
  content: "🐟 +0 fish/sec",
  fg: "#7F8C8D",                
})
clickerView.add(perSecondText)

const multText = new TextRenderable(renderer, {
    content: "✖️  multiplier 1",
    fg: "#2980B9",   
})

clickerView.add(multText)

const criticalText = new TextRenderable(renderer, {
    content: "",
    fg: "#E67E22"
})

clickerView.add(criticalText)

const eventText = new TextRenderable(renderer, {
  content: "No event currently",
  fg: "#2980B9",
})

clickerView.add(eventText)

clickerView.add(
  new TextRenderable(renderer, {
    content: "Click the ice to dive for fish!",
    fg: "#E67E22",              
  }),
)

// ─────────────────────────────────────────────
// Upgrades View
// ─────────────────────────────────────────────

const upgradesView = new BoxRenderable(renderer, {
  left: 0,
  top: 0,
  width: 50,
  height: 18,
  backgroundColor: "#FFFFFF", 
  borderColor: "#E0F4FF",    
  padding: 1,
  alignItems: "center",
  visible: false,
})

const upgradesScroll = new ScrollBoxRenderable(renderer, {
  width: 48,
  height: 15,
  gap: 1,
  backgroundColor: "#F0F9FF", 
})

upgradesView.add(upgradesScroll)


// ─────────────────────────────────────────────
// Upgrade 1
// ─────────────────────────────────────────────

const upgrade1Status = new TextRenderable(renderer, {
  content: "Click to buy",
  fg: "#AEBBFF",
})

const upgrade1 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade1Purchased){
            upgrade1Status.content = "Already purchased"
            return
        }
      if (money >= 10) {
        money -= 10
        moneyPerClick += 1
        upgrade1Purchased = true

        updateMoney()
        perClickText.content = `+${moneyPerClick} fish per click`

        upgrade1Status.content = "Purchased!"
      } else {
        upgrade1Status.content = `Need ${10 - money} more fish`
      }
    }
  },
})

upgrade1.add(
  new TextRenderable(renderer, {
    content: "Faster Flipper  |  10 fish  |  +1/click",
    fg: "#FFFFFF",
  }),
)

upgrade1.add(upgrade1Status)

upgradesScroll.add(upgrade1)

// ─────────────────────────────────────────────
// Upgrade 2
// ─────────────────────────────────────────────

const upgrade2Status = new TextRenderable(renderer, {
  content: "Click to buy",
  fg: "#AEBBFF",
})

const upgrade2 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade2Purchased){
            upgrade2Status.content = "Already purchased"
            return
        }
      if (money >= 50) {
        money -= 50
        moneyPerClick += 5
        upgrade2Purchased = true

        updateMoney()
        perClickText.content = `+${moneyPerClick} fish per click`

        upgrade2Status.content = "Purchased!"
      } else {
        upgrade2Status.content = `Need ${50 - money} more fish`
      }
    }
  },
})

upgrade2.add(
  new TextRenderable(renderer, {
    content: "Golden Fish  |  50 fish  |  +5/click",
    fg: "#FFFFFF",
  }),
)

upgrade2.add(upgrade2Status)

upgradesScroll.add(upgrade2)

// ─────────────────────────────────────────────
// Upgrade 3
// ─────────────────────────────────────────────

const upgrade3Status = new TextRenderable(renderer, {
  content: "Click to buy",
  fg: "#AEBBFF",
})

const upgrade3 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade3Purchased){
            upgrade3Status.content = "Already purchased"
            return
        }
      if (money >= 200) {
        money -= 200
        moneyPerClick += 25
        upgrade3Purchased = true

        updateMoney()
        perClickText.content = `+${moneyPerClick} fish per click`

        upgrade3Status.content = "Purchased!"
      } else {
        upgrade3Status.content = `Need ${200 - money} more fish`
      }
    }
  },
})

upgrade3.add(
  new TextRenderable(renderer, {
    content: "Penguin Colony  |  200 fish  |  +25/click",
    fg: "#FFFFFF",
  }),
)

upgrade3.add(upgrade3Status)

upgradesScroll.add(upgrade3)

// ─────────────────────────────────────────────
// Upgrade 4
// ─────────────────────────────────────────────
const upgrade4Status = new TextRenderable(renderer, {
  content: "Click to buy",
  fg: "#AEBBFF",
})

const upgrade4 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    if (event.button === MouseButton.LEFT) {
        event.preventDefault()
        if (upgrade4Purchased){
            upgrade4Status.content = "Already purchased"
            return
        }
      if (money >= 500) {
        money -= 500
        moneyPerSecond += 1
        upgrade4Purchased = true

        updateMoney()
        perSecondText.content = `+${moneyPerSecond} fish/sec`

        upgrade4Status.content = "Purchased!"
      } else {
        upgrade4Status.content = `Need ${500 - money} more fish`
      }
    }
  },
})

upgrade4.add(
  new TextRenderable(renderer, {
    content: "Baby Penguin  |  500 fish  |  +1/sec",
    fg: "#FFFFFF",
  }),
)

upgrade4.add(upgrade4Status)

upgradesScroll.add(upgrade4)

// Upgrade 5
const upgrade5Status = new TextRenderable(renderer, {
  content: "Click to buy",
  fg: "#AEBBFF",
})

const upgrade5 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade5Purchased){
            upgrade5Status.content = "Already purchased"
            return
        }
      if (money >= 2000) {
        money -= 2000
        moneyPerSecond += 3
        upgrade5Purchased = true

        updateMoney()
        perSecondText.content = `+${moneyPerSecond} fish/sec`

        upgrade5Status.content = "Purchased!"
      } else {
        upgrade5Status.content = `Need ${2000 - money} more fish`
      }
    }
  },
})

upgrade5.add(
  new TextRenderable(renderer, {
    content: "Penguin Pebble  |  2,000 fish  |  +3/sec",
    fg: "#FFFFFF",
  }),
)

upgrade5.add(upgrade5Status)

upgradesScroll.add(upgrade5)

//upgrade 6
const upgrade6Status = new TextRenderable(renderer, {
    content: "Click to buy",
    fg: "#AEBBFF",
})

const upgrade6 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade6Purchased) {
            upgrade6Status.content = "Already purchased"
            return
        }
      if (money >= 6000) {
        money -= 6000
        globalmult += 1
        upgrade6Purchased = true

        updateMoney()
        multText.content = `✖️  multiplier ${globalmult}`

        upgrade6Status.content = "Purchased!"
      } else {
        upgrade6Status.content = `Need ${6000 - money} more fish`
      }
    }
  },
})

upgrade6.add(
  new TextRenderable(renderer, {
    content: "Penguin Egg  |  6,000 fish  |  mult +1",
    fg: "#FFFFFF",
  }),
)

upgrade6.add(upgrade6Status)

upgradesScroll.add(upgrade6)

//upgrade 7
const upgrade7Status = new TextRenderable(renderer, {
    content: "Click to buy",
    fg: "#AEBBFF",
})

const upgrade7 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade7Purchased) {
            upgrade7Status.content = "Already purchased"
            return
        }
      if (money >= 10000) {
        money -= 10000
        moneyPerSecond += 10
        upgrade7Purchased = true

        updateMoney()
        perSecondText.content = `+${moneyPerSecond} fish/sec`

        upgrade7Status.content = "Purchased!"
      } else {
        upgrade7Status.content = `Need ${10000 - money} more fish`
      }
    }
  },
})

upgrade7.add(
  new TextRenderable(renderer, {
    content: "Penguin Fishing Boat  |  10,000 fish  |  +10/sec",
    fg: "#FFFFFF",
  }),
)

upgrade7.add(upgrade7Status)

upgradesScroll.add(upgrade7)

// upgrade 8
const upgrade8Status = new TextRenderable(renderer, {
    content: "Click to buy",
    fg: "#AEBBFF",
})

const upgrade8 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade8Purchased) {
            upgrade8Status.content = "Already purchased"
            return
        }
      if (money >= 13_000) {
        money -= 13_000
        moneyPerClick += 50
        upgrade8Purchased = true

        updateMoney()
        perClickText.content = `+${moneyPerClick} fish per click`

        upgrade8Status.content = "Purchased!"
      } else {
        upgrade8Status.content = `Need ${13_000 - money} more fish`
      }
    }
  },
})

upgrade8.add(
  new TextRenderable(renderer, {
    content: "Penguin  Nest |  13,000 fish  |  +50/click",
    fg: "#FFFFFF",
  }),
)

upgrade8.add(upgrade8Status)

upgradesScroll.add(upgrade8)

// upgrade 9

const upgrade9Status = new TextRenderable(renderer, {
    content: "Click to buy",
    fg: "#AEBBFF",
})

const upgrade9 = new BoxRenderable(renderer, {
  width: 45,
  height: 4,
  marginBottom: 1,
  backgroundColor: "#0B1D3A",
  alignItems: "center",
  justifyContent: "center",

  onMouseDown(event) {
    event.preventDefault()
    if (event.button === MouseButton.LEFT) {
        if (upgrade9Purchased) {
            upgrade9Status.content = "Already purchased"
            return
        }
      if (money >= 17_000) {
        money -= 17_000
        moneyPerSecond += 50
        upgrade9Purchased = true

        updateMoney()
        perSecondText.content = `+${moneyPerSecond} fish/sec`

        upgrade9Status.content = "Purchased!"
      } else {
        upgrade9Status.content = `Need ${17_000 - money} more fish`
      }
    }
  },
})

upgrade9.add(
  new TextRenderable(renderer, {
    content: "Penguin Town |  17,000 fish  | +50/sec ",
    fg: "#FFFFFF",
  }),
)

upgrade9.add(upgrade9Status)

upgradesScroll.add(upgrade9)

// ---------------------------------------------
// Buildings View
// ---------------------------------------------
const buildingsView = new BoxRenderable(renderer, {
  left: 0,
  top: 0,
  width: 50,
  height: 18,
  backgroundColor: "#FFFFFF",
  borderColor: "#E0F4FF",
  padding: 1,
  alignItems: "center",
  visible: false,
})

const buildingsScroll = new ScrollBoxRenderable(renderer, {
  width: 48,
  height: 15,
  gap: 1,
  backgroundColor: "#F0F9FF",
})

buildingsView.add(buildingsScroll)

function createBuildingCard(building: Building) {
  const statusText = new TextRenderable(renderer, {
    content: "",
    fg: "#AEBBFF",
  })

  const costText = new TextRenderable(renderer, {
    content: "",
    fg: "#FFD700",
  })

  const countText = new TextRenderable(renderer, {
    content: "",
    fg: "#7FDBFF",
  })

  const buildingBox = new BoxRenderable(renderer, {
    width: 45,
    height: 5,
    marginBottom: 1,
    backgroundColor: "#0B1D3A",
    alignItems: "center",
    justifyContent: "center",

    onMouseDown(event) {
      event.preventDefault()

      if (event.button !== MouseButton.LEFT) {
        return
      }

      const cost = getBuildingCost(building)

      if (money < cost) {
        statusText.content =
          `Need ${formatMoney(cost - money)} more fish`
        return
      }

      money -= cost

      building.count++

      moneyPerSecond += building.fishPerSecond

      updateMoney()

      perSecondText.content =
        `+${formatMoney(moneyPerSecond)} fish/sec`

      statusText.content = "Purchased!"

      updateBuildingUI()
    },
  })

  function updateBuildingUI() {
    const cost = getBuildingCost(building)

    costText.content =
      `Cost: ${formatMoney(cost)} fish`

    countText.content =
      `Owned: ${building.count}`

    statusText.content = building.count > 0
      ? `+${formatMoney(building.count * building.fishPerSecond)} fish/sec`
      : "Click to buy"
  }

  buildingBox.add(
    new TextRenderable(renderer, {
      content: building.name,
      fg: "#FFFFFF",
    }),
  )

  buildingBox.add(
    new TextRenderable(renderer, {
      content: building.description,
      fg: "#AEBBFF",
    }),
  )

  buildingBox.add(costText)
  buildingBox.add(countText)
  buildingBox.add(statusText)

  updateBuildingUI()

  buildingsScroll.add(buildingBox)
}

for (const building of buildings) {
  createBuildingCard(building)
}

// ─────────────────────────────────────────────
// Statistics View
// ─────────────────────────────────────────────

const statisticsView = new BoxRenderable(renderer, {
  left: 0,
  top: 0,
  width: 50,
  height: 18,
  backgroundColor: "#FFFFFF",
  borderColor: "#E0F4FF",
  padding: 1,
  flexDirection: "column",
  gap: 1,
  alignItems: "center",
  visible: false,
})

const statisticsTitle = new TextRenderable(renderer, {
  content: "STATISTICS",
  fg: "#1A252F",
})

const statisticsText = new TextRenderable(renderer, {
  content: "",
  fg: "#2980B9",
})

statisticsView.add(statisticsTitle)
statisticsView.add(statisticsText)

function updateStatistics() {
  const secondsPlayed = Math.floor(
    (Date.now() - startTime) / 1000
  )

  const hours = Math.floor(secondsPlayed / 3600)
  const minutes = Math.floor((secondsPlayed % 3600) / 60)
  const seconds = secondsPlayed % 60

  statisticsText.content =
`Total Fish Earned: ${formatMoney(totalFishEarned)}

Total Clicks: ${totalClicks}

Fish Per Click: ${formatMoney(moneyPerClick)}

Fish Per Second: ${formatMoney(moneyPerSecond)}

Events Triggered: ${totalEvents}

Challenges Won: ${totalChallengesWon}

Biggest Catch: ${formatMoney(biggestCatch)}

Time Played: ${hours}h ${minutes}m ${seconds}s`
}



// ─────────────────────────────────────────────
// Clickable Tab Bar
// ─────────────────────────────────────────────

const tabBar = new BoxRenderable(renderer, {
  left: 0,
  top: 0,
  width: 50,
  height: 3,
  flexDirection: "row",
  backgroundColor: "#0B1D3A",
})

function switchTab(index: number) {
  clickerTab.backgroundColor =
    index === 0 ? "#2980B9" : "#0B1D3A"

  upgradesTab.backgroundColor =
    index === 1 ? "#2980B9" : "#0B1D3A"

  buildingsTab.backgroundColor =
    index === 2 ? "#2980B9" : "#0B1D3A"

  statisticsTab.backgroundColor =
    index === 3 ? "#2980B9" : "#0B1D3A"

  if (index === 0) {
    clickerView.visible = true
    upgradesView.visible = false
    buildingsView.visible = false
    statisticsView.visible = false
  }

  if (index === 1) {
    clickerView.visible = false
    upgradesView.visible = true
    buildingsView.visible = false
    statisticsView.visible = false
  }

  if (index === 2) {
    clickerView.visible = false
    upgradesView.visible = false
    buildingsView.visible = true
    statisticsView.visible = false
  }

  if (index === 3) {
    clickerView.visible = false
    upgradesView.visible = false
    buildingsView.visible = false
    statisticsView.visible = true

    updateStatistics()
  }

  if (index === 4) {
    exitGame()
  }
}


const buildingsTab = new BoxRenderable(renderer, {
  width: 10,
  height: 3,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#0B1D3A",

  onMouseDown(event) {
    if (event.button === MouseButton.LEFT) {
      event.preventDefault()
      switchTab(2)
    }
  },
})

buildingsTab.add(
  new TextRenderable(renderer, {
    content: "Buildings",
    fg: "#FFFFFF",
  }),
)


const statisticsTab = new BoxRenderable(renderer, {
  width: 10,
  height: 3,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#0B1D3A",

  onMouseDown(event) {
    if (event.button === MouseButton.LEFT) {
      event.preventDefault()
      switchTab(3)
    }
  },
})

statisticsTab.add(
  new TextRenderable(renderer, {
    content: "Stats",
    fg: "#FFFFFF",
  }),
)


const clickerTab = new BoxRenderable(renderer, {
  width: 10,
  height: 3,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#2980B9",

  onMouseDown(event) {
    if (event.button === MouseButton.LEFT) {
      event.preventDefault()
      switchTab(0)
    }
  },
})

clickerTab.add(
  new TextRenderable(renderer, {
    content: "Clicker",
    fg: "#FFFFFF",
  }),
)

const upgradesTab = new BoxRenderable(renderer, {
  width: 10,
  height: 3,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#0B1D3A",

  onMouseDown(event) {
    if (event.button === MouseButton.LEFT) {
      event.preventDefault()
      switchTab(1)
    }
  },
})

upgradesTab.add(
  new TextRenderable(renderer, {
    content: "Upgrades",
    fg: "#FFFFFF",
  }),
)

const exitTab = new BoxRenderable(renderer, {
  width: 10,
  height: 3,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#8B1E1E",

  onMouseDown(event) {
    if (event.button === MouseButton.LEFT) {
      event.preventDefault()
      switchTab(4)
    }
  },
})

exitTab.add(
  new TextRenderable(renderer, {
    content: "✕ Exit",
    fg: "#FFFFFF",
  }),
)

tabBar.add(clickerTab)
tabBar.add(upgradesTab)
tabBar.add(buildingsTab)
tabBar.add(statisticsTab)
tabBar.add(exitTab)


// ─────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────

renderer.root.add(clickerView)
renderer.root.add(upgradesView)
renderer.root.add(buildingsView)
renderer.root.add(statisticsView)
renderer.root.add(tabBar)
