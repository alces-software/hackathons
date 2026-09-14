import {
  ASCIIFontRenderable,
  BoxRenderable,
  ImageRenderable,
  NativeImage,
  TextRenderable,
  createCliRenderer,
  createTimeline,
  engine,
  setupAudio,
} from "@opentui/core"


const audio = setupAudio({ autoStart: true })
const soundtrack = await audio.loadSoundFile("soundtrack.mp3")
const gunshot = await audio.loadSoundFile("gunshot.mp3")

async function loadFallenPlayerImage(source: string, angle: 90 | 270) {
  const standingImage = await NativeImage.load(new URL(source, import.meta.url))
  const fallenImage = standingImage.rotate(angle)
  standingImage.dispose()

  return fallenImage
}

const player1FallenImage = await loadFallenPlayerImage("terminalImage.png", 270)
const player2FallenImage = await loadFallenPlayerImage("terminalImage2.png", 90)

if (soundtrack !== null) {
  audio.play(soundtrack, {
    volume: 0.25,
    loop: true,
  })
}

function playGunshot() {
  if (gunshot !== null) {
    audio.play(gunshot, {
      volume: 0.5,
    })
  }
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  backgroundColor: "#f6a66a",
})

engine.attach(renderer)


const wrapperTop = new BoxRenderable(renderer, {
  width: "100%",
  height: 13,
  position: "relative",
  paddingX: 7,
 
  backgroundColor: "#f6a66a",

  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
})


const wrapper = new BoxRenderable(renderer, {
  width: "100%",
  height: 16,
  position: "relative",
 
  backgroundColor: "#8fbd63",

  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "center",
})


const wrapperBottom = new BoxRenderable(renderer, {
  width: "100%",
  height: 5,
  position: "relative",
 
  backgroundColor: "#2f6f35",

  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "center",
})

const PROJECTILE_WIDTH = 2
const LEFT_MUZZLE_OFFSET_X = 34
const RIGHT_MUZZLE_OFFSET_X = 1
const MUZZLE_OFFSET_Y = 5
const INITIAL_PROJECTILE_DURATION = 1800
const PROJECTILE_SPEEDUP_PER_ROUND = 120
const PROJECTILE_SPEEDUP_GROWTH = 35
const MIN_PROJECTILE_DURATION = 650
const JUMP_HEIGHT = -30
const JUMP_DURATION = 1020
const MAX_LIVES = 3

type Direction = "left" | "right"
type Player = 1 | 2
type ActiveProjectile = {
  renderable: TextRenderable
  timeline: ReturnType<typeof createTimeline>
  direction: Direction
  shooter: Player
  targetBlock: BoxRenderable
  top: number
  previousLeft: number
  lastLeft: number
  destroyed: boolean
}

const activeProjectiles: ActiveProjectile[] = []
const jumpingBlocks = new Set<BoxRenderable>()
let player1Lives = MAX_LIVES
let player2Lives = MAX_LIVES
let gameStarted = false
let showingHowToPlay = false
let showingCoinToss = false
let gameOver = false
let currentTurn: Player = 1
let shotInFlight = false
let projectileDuration = INITIAL_PROJECTILE_DURATION
let completedShots = 0

function addScenery(parent: BoxRenderable, content: string, left: number, top: number, fg: string, zIndex = 0) {
  parent.add(
    new TextRenderable(renderer, {
      content,
      fg,
      position: "absolute",
      left,
      top,
      zIndex,
    }),
  )
}

function addSceneryBox(
  parent: BoxRenderable,
  width: number | `${number}%`,
  height: number,
  left: number,
  top: number,
  backgroundColor: string,
  zIndex = 0,
) {
  parent.add(
    new BoxRenderable(renderer, {
      width,
      height,
      position: "absolute",
      left,
      top,
      backgroundColor,
      zIndex,
    }),
  )
}

function addPixelCloud(parent: BoxRenderable, left: number, top: number) {
  const cloud = "#fff1d6"
  const shadow = "#e8d8bf"

  addSceneryBox(parent, 7, 1, left + 4, top, cloud)
  addSceneryBox(parent, 11, 1, left + 1, top + 1, cloud)
  addSceneryBox(parent, 14, 1, left, top + 2, cloud)
  addSceneryBox(parent, 6, 1, left + 9, top + 2, shadow)
}

function addDawnScenery() {
  addSceneryBox(wrapperTop, "100%", 4, 0, 0, "#f08b61")
  addSceneryBox(wrapperTop, "100%", 4, 0, 4, "#f6b36f")
  addSceneryBox(wrapperTop, "100%", 5, 0, 8, "#c9d59b")

  addSceneryBox(wrapperTop, 12, 3, 88, 8, "#f8d46c")
  addSceneryBox(wrapperTop, 16, 2, 86, 11, "#d49b51")

  addPixelCloud(wrapperTop, 10, 1)
  addPixelCloud(wrapperTop, 44, 2)
  addPixelCloud(wrapperTop, 118, 1)

  addScenery(wrapper, "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░", 8, 2, "#dbe3d0", 1)
  addScenery(wrapper, "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░", 54, 5, "#eef0df", 1)
  addScenery(wrapper, "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░", 28, 8, "#d8dfc9", 1)

  addSceneryBox(wrapper, "100%", 3, 0, 13, "#6da850")
  addSceneryBox(wrapper, 38, 2, 0, 11, "#5f9a4d")
  addSceneryBox(wrapper, 44, 2, 86, 10, "#5a9347")
  addScenery(wrapper, "^^^^^^^^^^^^^^^^^^^^", 12, 12, "#4f7f3b", 2)
  addScenery(wrapper, "^^^^^^^^^^^^^^^^^^^^^^^^^^^^", 106, 12, "#4a7838", 2)

  addSceneryBox(wrapperBottom, "100%", 1, 0, 0, "#4d8e3d")
  addSceneryBox(wrapperBottom, "100%", 2, 0, 1, "#386f34")
  addSceneryBox(wrapperBottom, "100%", 2, 0, 3, "#254f2b")
  addScenery(wrapperBottom, "▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙▟▙", 4, 1, "#315f2d", 2)
  addScenery(wrapperBottom, "▁▂▁▁▂▁▂▁▁▂▁▁▂▁▂▁▁▂▁▁▂▁▂▁▁▂▁", 58, 4, "#bfa47a", 2)
}



// FIRE
function fireProjectile(shooter: Player) {
  if (!gameStarted || gameOver || shotInFlight || currentTurn !== shooter) {
    return
  }

  const shooterBlock = shooter === 1 ? leftBlock : rightBlock
  if (jumpingBlocks.has(shooterBlock)) {
    return
  }

  shotInFlight = true
  updateTurnDisplay()
  playGunshot()

  const direction: Direction = shooter === 1 ? "right" : "left"
  const muzzleOffsetX = direction === "right" ? LEFT_MUZZLE_OFFSET_X : RIGHT_MUZZLE_OFFSET_X
  const startLeft = getBlockLeft(shooterBlock) + muzzleOffsetX
  const endLeft = direction === "right" ? renderer.width : -PROJECTILE_WIDTH
  const top = getBlockTop(shooterBlock) + MUZZLE_OFFSET_Y
  const targetBlock = direction === "right" ? rightBlock : leftBlock
  const projectile = new TextRenderable(renderer, {
    content: "▅",
    fg: "#ff6a00",

    position: "absolute",
    left: startLeft,
    top,
    zIndex: 10,
  })

  wrapper.add(projectile)

  let activeProjectile: ActiveProjectile
  const timeline = createTimeline({
    duration: projectileDuration,
    autoplay: false,

    onComplete: () => {
      removeProjectile(activeProjectile)
    },
  })

  timeline.add(projectile, {
    left: endLeft,
    duration: projectileDuration,
    ease: "linear",
    onUpdate: () => {
      activeProjectile.previousLeft = activeProjectile.lastLeft
      activeProjectile.lastLeft = getProjectileLeft(activeProjectile)
      detectBlockCollision(activeProjectile)
    },
  })

  activeProjectile = {
    renderable: projectile,
    timeline,
    direction,
    shooter,
    targetBlock,
    top,
    previousLeft: startLeft,
    lastLeft: startLeft,
    destroyed: false,
  }
  activeProjectiles.push(activeProjectile)

  timeline.play()
}

function getProjectileLeft(projectile: ActiveProjectile) {
  return typeof projectile.renderable.left === "number" ? projectile.renderable.left : projectile.lastLeft
}

function getBlockLeft(block: BoxRenderable) {
  return block.x - wrapper.x
}

function getBlockTop(block: BoxRenderable) {
  return block.y - wrapper.y
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start <= b.end && b.start <= a.end
}

function detectBlockCollision(projectile: ActiveProjectile) {
  if (projectile.destroyed) {
    return
  }

  const currentLeft = getProjectileLeft(projectile)
  const projectilePath = {
    start: Math.min(projectile.previousLeft, currentLeft),
    end: Math.max(projectile.previousLeft, currentLeft) + PROJECTILE_WIDTH - 1,
  }

  const targetLeft = getBlockLeft(projectile.targetBlock)
  const targetTop = getBlockTop(projectile.targetBlock)
  const targetRange = {
    start: targetLeft,
    end: targetLeft + projectile.targetBlock.width - 1,
  }
  const hitsTargetY = projectile.top >= targetTop && projectile.top < targetTop + projectile.targetBlock.height

  if (hitsTargetY && rangesOverlap(projectilePath, targetRange)) {
    decrementLives(projectile.targetBlock)
    removeProjectile(projectile)
  }
}

function decrementLives(hitBlock: BoxRenderable) {
  if (gameOver) {
    return
  }

  if (hitBlock === leftBlock) {
    player1Lives = Math.max(0, player1Lives - 1)
  }

  if (hitBlock === rightBlock) {
    player2Lives = Math.max(0, player2Lives - 1)
  }

  updateLivesDisplay()
  checkForWinner()
}

function getLivesText(player: 1 | 2, lives: number) {
  return `Player ${player} lives: ${"♥ ".repeat(lives)}${"- ".repeat(MAX_LIVES - lives)}`
}

function updateLivesDisplay() {
  player1LivesText.content = getLivesText(1, player1Lives)
  player2LivesText.content = getLivesText(2, player2Lives)
}

function updateTurnDisplay() {
  turnText.content = shotInFlight ? "Shot fired..." : `Player ${currentTurn}'s turn`
}

function makeNextShotFaster() {
  completedShots += 1

  const speedup = PROJECTILE_SPEEDUP_PER_ROUND + completedShots * PROJECTILE_SPEEDUP_GROWTH
  projectileDuration = Math.max(MIN_PROJECTILE_DURATION, projectileDuration - speedup)
}

function startGame() {
  gameStarted = true
  titleOverlay.visible = false
  titleStack.visible = false
  howToPlayStack.visible = false
  coinTossStack.visible = false
  updateTurnDisplay()
}

function showHowToPlay() {
  showingHowToPlay = true
  titleStack.visible = false
  howToPlayStack.visible = true
}

function showCoinToss() {
  showingHowToPlay = false
  showingCoinToss = true
  currentTurn = Math.random() < 0.5 ? 1 : 2

  howToPlayStack.visible = false
  coinTossWinnerText.content =
    currentTurn === 1
      ? "The coin favours the gentleman on the left."
      : "The coin favours the gentleman on the right."
  coinTossTurnText.content = `Player ${currentTurn} shall fire first.`
  coinTossStack.visible = true
}

function checkForWinner() {
  if (player1Lives === 0) {
    endGame("PLAYER TWO WINS!", 1)
  }

  if (player2Lives === 0) {
    endGame("PLAYER ONE WINS!", 2)
  }
}

function endGame(message: string, fallenPlayer: Player) {
  if (gameOver) {
    return
  }

  gameOver = true
  fallPlayer(fallenPlayer)
  winMessage.content = message
  winOverlay.visible = true
  turnText.content = "Duel complete"
}

function fallPlayer(player: Player) {
  const block = player === 1 ? leftBlock : rightBlock
  const image = player === 1 ? leftPlayerImage : rightPlayerImage
  const fallenImage = player === 1 ? player1FallenImage : player2FallenImage

  jumpingBlocks.delete(block)
  block.top = 0
  image.source = fallenImage
}

function removeProjectile(projectile: ActiveProjectile) {
  if (projectile.destroyed) {
    return
  }

  projectile.destroyed = true
  projectile.timeline.pause()
  projectile.renderable.destroy()
  engine.unregister(projectile.timeline)

  const index = activeProjectiles.indexOf(projectile)
  if (index !== -1) {
    activeProjectiles.splice(index, 1)
  }

  if (!gameOver) {
    makeNextShotFaster()
    currentTurn = projectile.shooter === 1 ? 2 : 1
    shotInFlight = false
    updateTurnDisplay()
  }
}

function jumpBlock(block: BoxRenderable) {
  if (!gameStarted || gameOver) {
    return
  }

  if (jumpingBlocks.has(block)) {
    return
  }

  jumpingBlocks.add(block)

  const timeline = createTimeline({
    duration: JUMP_DURATION,
    autoplay: false,

    onComplete: () => {
      block.top = 0
      jumpingBlocks.delete(block)
      engine.unregister(timeline)
    },
  })

  timeline.add(block, {
    top: JUMP_HEIGHT,
    duration: 760,
    ease: "outQuad",
  })

  timeline.add(
    block,
    {
      top: 0,
      duration: 760,
      ease: "inQuad",
    },
    160,
  )

  timeline.play()
}

// Left block
const leftBlock = new BoxRenderable(renderer, {
  width: 36,
  height: 14,
  position: "relative",
  top: 0,
  zIndex: 5,
  backgroundColor: "transparent",

  alignItems: "center",
  justifyContent: "center",
})

const leftPlayerImage = new ImageRenderable(renderer, {
  source: "terminalImage.png",
  width: 34,
  height: 14,
  fit: "fit",
})

leftBlock.add(leftPlayerImage)

// Right block
const rightBlock = new BoxRenderable(renderer, {
  width: 36,
  height: 14,
  position: "relative",
  top: 0,
  zIndex: 5,
  backgroundColor: "transparent",

  alignItems: "center",
  justifyContent: "center",
})

const rightPlayerImage = new ImageRenderable(renderer, {
  source: "terminalImage2.png",
  width: 34,
  height: 14,
  fit: "fit",
})

rightBlock.add(rightPlayerImage)

renderer.keyInput.on("keypress", (key) => {
  if (key.name === "q") {
    renderer.destroy()
    return
  }

  if (!gameStarted) {
    if (showingCoinToss) {
      startGame()
      return
    }

    if (showingHowToPlay) {
      showCoinToss()
      return
    }

    showHowToPlay()
    return
  }

  if (key.name === "d") {
    fireProjectile(1)
    return
  }

  if (key.name === "w") {
    jumpBlock(leftBlock)
    return
  }

  if (key.name === "left") {
    fireProjectile(2)
    return
  }

  if (key.name === "up") {
    jumpBlock(rightBlock)
    return
  }
})

addDawnScenery()

wrapper.add(leftBlock)

const winOverlay = new BoxRenderable(renderer, {
  width: "100%",
  height: "100%",
  position: "absolute",
  left: 0,
  top: 0,
  zIndex: 30,
  visible: false,

  alignItems: "center",
  justifyContent: "center",
})

const winBlock = new BoxRenderable(renderer, {
  width: 42,
  height: 7,
  position: "relative",
  backgroundColor: "#f3dfae",
  border: true,
  borderStyle: "double",
  borderColor: "#6f4a1f",
  title: " DECREE ",
  titleColor: "#6f4a1f",
  titleAlignment: "center",
  bottomTitle: " PRESS Q TO QUIT ",
  bottomTitleAlignment: "center",

  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
})

function addCenteredWinLine(content: string, fg: string) {
  const line = new BoxRenderable(renderer, {
    width: "100%",
    height: 1,
    alignItems: "center",
    justifyContent: "center",
  })

  const text = new TextRenderable(renderer, {
    content,
    fg,
  })

  line.add(text)
  winBlock.add(line)

  return text
}

addCenteredWinLine("~ THE PRONOUNCEMENT ~", "#6f4a1f")

const winMessage = addCenteredWinLine("", "#2f2416")

addCenteredWinLine("==============================", "#9b6a2f")

winOverlay.add(winBlock)

wrapper.add(winOverlay)

wrapper.add(rightBlock)

renderer.root.add(wrapperTop)
renderer.root.add(wrapper)
renderer.root.add(wrapperBottom)

const player1LivesText = new TextRenderable(renderer, {
  width: 22,
  height: 1,
  position: "relative",
  content: getLivesText(1, player1Lives),
  fg: "#FFFFFF",
  zIndex: 5,
})

const player2LivesText = new TextRenderable(renderer, {
  width: 22,
  height: 1,
  position: "relative",
  content: getLivesText(2, player2Lives),
  fg: "#FFFFFF",
  zIndex: 5,
})

const turnText = new TextRenderable(renderer, {
  width: 22,
  height: 1,
  position: "relative",
  content: `Player ${currentTurn}'s turn`,
  fg: "#2f2416",
  zIndex: 5,
})

wrapperTop.add(player1LivesText)
wrapperTop.add(turnText)
wrapperTop.add(player2LivesText)

const titleOverlay = new BoxRenderable(renderer, {
  width: "100%",
  height: 40,
  position: "absolute",
  left: 0,
  top: 0,
  zIndex: 50,
  backgroundColor: "#262727",

  alignItems: "center",
  justifyContent: "center",
})

const titleStack = new BoxRenderable(renderer, {
  width: 86,
  height: 19,

  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
})

const howToPlayStack = new BoxRenderable(renderer, {
  width: 86,
  height: 20,

  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
})

const coinTossStack = new BoxRenderable(renderer, {
  width: 86,
  height: 14,

  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
})

function addCenteredAsciiTitleLine(content: string) {
  const text = new ASCIIFontRenderable(renderer, {
    text: content,
    font: "block",
    color: "#f3dfae",
    backgroundColor: "#262727",
    selectable: false,
  })

  titleStack.add(text)
}

function addCenteredTitleLine(content: string, fg: string) {
  const line = new BoxRenderable(renderer, {
    width: "100%",
    height: 1,
    alignItems: "center",
    justifyContent: "center",
  })
  const text = new TextRenderable(renderer, {
    content,
    fg,
  })

  line.add(text)
  titleStack.add(line)
}

addCenteredAsciiTitleLine("A POLITE")
addCenteredAsciiTitleLine("EXCHANGE")
addCenteredAsciiTitleLine("OF BULLETS")
addCenteredTitleLine("", "#f3dfae")

addCenteredTitleLine("", "#f3dfae")
addCenteredTitleLine("Press any key to continue", "#f3dfae")

function addHowToPlayAsciiLine(content: string) {
  const text = new ASCIIFontRenderable(renderer, {
    text: content,
    font: "tiny",
    color: "#f3dfae",
    backgroundColor: "#262727",
    selectable: false,
  })

  howToPlayStack.add(text)
}

function addHowToPlayLine(content: string, fg = "#f3dfae") {
  const line = new BoxRenderable(renderer, {
    width: "100%",
    height: 1,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  })
  const text = new TextRenderable(renderer, {
    content,
    fg,
  })

  line.add(text)
  howToPlayStack.add(line)
}

function addCoinTossAsciiLine(content: string) {
  const text = new ASCIIFontRenderable(renderer, {
    text: content,
    font: "tiny",
    color: "#f3dfae",
    backgroundColor: "#262727",
    selectable: false,
  })

  coinTossStack.add(text)
}

function addCoinTossLine(content: string, fg = "#f3dfae") {
  const line = new BoxRenderable(renderer, {
    width: "100%",
    height: 1,
    alignItems: "flex-start",
    justifyContent: "flex-start",
  })
  const text = new TextRenderable(renderer, {
    content,
    fg,
  })

  line.add(text)
  coinTossStack.add(line)

  return text
}

addHowToPlayAsciiLine("DUEL RULES")
addHowToPlayLine("")
addHowToPlayLine("THE RULES OF THE EXCHANGE", "#ffffff")
addHowToPlayLine("")
addHowToPlayLine("I.   The gentleman on the left:  W to leap, D to fire.")
addHowToPlayLine("II.  The gentleman on the right: Up to leap, Left Arrow to fire.")
addHowToPlayLine("")
addHowToPlayLine("III. A gentleman may discharge his pistol only upon the ground.")
addHowToPlayLine("IV.  One bullet is exchanged at a time; await your opponent's reply.")
addHowToPlayLine("V.   Leap the incoming shot, preserve your hearts, and remain courteous.")
addHowToPlayLine("")
addHowToPlayLine("Press any key to begin the affair.", "#ffffff")

addCoinTossAsciiLine("COIN TOSS")
addCoinTossLine("")
addCoinTossLine("A silver coin is produced with suitable ceremony.", "#ffffff")
addCoinTossLine("It catches the dawn, turns once, and declares the honour.")
addCoinTossLine("")
const coinTossWinnerText = addCoinTossLine("")
const coinTossTurnText = addCoinTossLine("", "#ffffff")
addCoinTossLine("")
addCoinTossLine("Press any key to take your mark.", "#ffffff")

titleOverlay.add(titleStack)
titleOverlay.add(howToPlayStack)
titleOverlay.add(coinTossStack)
titleStack.visible = false
howToPlayStack.visible = false
coinTossStack.visible = false
renderer.root.add(titleOverlay)

setTimeout(() => {
  if (!gameStarted && !showingHowToPlay) {
    titleStack.visible = true
  }
}, 1250)
