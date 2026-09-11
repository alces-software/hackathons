// Run using bun: 
//   bun install
//   bun stui.ts
import { Audio, TextAttributes, BoxRenderable, ImageRenderable, TextRenderable, ASCIIFontRenderable, RGBA, FrameBufferRenderable, createCliRenderer, createTimeline, engine, type Timeline } from "@opentui/core"
import * as THREE from "three"
import { ThreeRenderable, TextureUtils } from "@opentui/three"

// Engines
const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  backgroundColor: RGBA.fromHex("#1131E9"),
})

// Drives timeline animations from the renderer's frame loop
engine.attach(renderer)

const audio = Audio.create({ autoStart: true })
let currentStream: import("@opentui/core").AudioStream | null = null

// Types
type Album = {
  id: number;
  cover: string;
  cover_big: string;
  cover_xl: string;
  title: string;
  release_date: string;
  artist: { name: string };
  genres: { data: { name: string }[] };
  tracks: { data: Track[] };
}

type Track = { id: number; title: string; duration: number; preview: string }

type Recommendation = {
  id: number
  description: string
}

let playing: { title: TextRenderable; track: Track } | null = null

// Find album info with:
//   curl -s 'https://api.deezer.com/search/album?q=ALBUM+NAME' | jq '.data[0] | {id, title, artist: .artist.name}'
const recommendations: Recommendation[] = [
    {id: 548665822, description: "A glorious explosion of chaotic Japanese metalcore."},
    {id: 416951867, description: "The greatest album of the 2010s, pure poetry, emotion and writing structure."},
    {id: 7742233, description: "The best album to run in the background while focusing on technical challenges, 'glitchcore'"},
    {id: 107231, description: 'Pure joy.'},
    { id: 92791162, description: "A guy who sounds like he has lost his voice recalls the time he took too many hallucinegens through the lens of The Wizard of Oz... Yeah"},
    {id: 167512092, description: "I swear they pioneer 'ironic hardcore', who wouldn't want a musical set in Watford?"},
]

// Theme


// Application Title
const title = new ASCIIFontRenderable(renderer, {
  id: "title",
  text: "STUI: A music discovery app",
  font: "slick",
  color: RGBA.fromHex("#EE00CE"),
})

renderer.root.add(title)

// Album Searcher
// https://api.deezer.com/search\?q=album:%22good%20things%22

// Album Metadata Getter
async function getAlbum(albumId: number): Promise<Album> {
  const res = await fetch(`https://api.deezer.com/album/${albumId}`);
  return (await res.json()) as Album;
}

// Set album
let currentAlbumId: number | null = null
let openToken = 0

async function openAlbum(rec: Recommendation) {
  const token = ++openToken
  stopPreview()
  stopPulse() // kill the pulse before the old rows are destroyed
  playing = null // old rows are about to be destroyed — don't let playback state touch them

  const album = await getAlbum(rec.id)
  if (token !== openToken) return // a newer click already superseded this fetch

  currentAlbumId = album.id
  image.source = album.cover_big // old art stays visible until the new one loads
  infoTitle.content = album.title
  infoMeta.content = `${album.artist.name} • ${album.release_date} • ${album.genres?.data?.map(g => g.name).join(", ") ?? "Unknown"}`
  infoDesc.content = `“${rec.description}”`
  // Key off the recommendation id, not album.id — some Deezer ids
  // redirect (e.g. 92791162 → 93319972), so album.id may not match
  // the shelf record's key.
  pluckVinyl(rec.id) // pluck this album's sleeve from the shelf

  for (const row of trackList.getChildren()) row.destroyRecursively()
  for (const track of album.tracks.data) {
      const title = (new TextRenderable(renderer, {
        content: track.title,
        width: "100%",
        selectable: false, // prevent text highlighting
        fg: "#B800A8"
      }))
      const row = new BoxRenderable(renderer, {
        height: 1,
        onMouseDown(event) {
          if (event.button !== 0) return // left button only; wheel/middle have their own events

          // Stop playing preview if playing track clicked
          if (playing?.track.id === track.id) {
            const current = playing
            stopPreview()
            stopPulse()
            current.title.fg = "#B800A8"
            current.title.content = current.track.title
            playing = null
            return
          }

          // Reset any previously selected track to default colour & title
          if (playing) {
            const previous = playing
            stopPulse()
            previous.title.fg = "#B800A8"
            previous.title.content = previous.track.title
          }

          // Select this track and preview it
          title.fg = "#FF44D9"
          title.content = "▶ " + track.title
          playing = { title, track }
          startPulse(title)
          void playPreview(track)
        },
        onMouseOver() { row.backgroundColor = "#00d4ff" },
        onMouseOut() { row.backgroundColor = undefined },
      })

      row.add(title)
      trackList.add(row)
  }
}

// Album Artwork Renderer
const image = new ImageRenderable(renderer, {
  id: "cover",
  width: 60,
  height: 30,
  fit: "cover",
  protocol: "blocks",
  onError: console.error,
})

// Playback
function stopPreview() {
  currentStream?.dispose()
  currentStream = null
}

// Colour helper (RGBA channels are 0..1 floats)
function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return RGBA.fromValues(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  )
}

// Pulse animation for the previewing track title
const PULSE_BASE = RGBA.fromHex("#FF44D9")
const PULSE_HOT = RGBA.fromHex("#FFE9F7")

let pulse: { timeline: Timeline; title: TextRenderable } | null = null

function stopPulse() {
  if (!pulse) return
  engine.unregister(pulse.timeline)
  pulse.title.fg = "#B800A8"
  pulse = null
}

function startPulse(title: TextRenderable) {
  stopPulse()
  const state = { t: 0 }
  const timeline = createTimeline({ loop: true, duration: 1e9 })
  timeline.add(state, {
    t: 1,
    duration: 340,
    ease: "inOutSine",
    loop: true,
    alternate: true,
    onUpdate() {
      // state.t is mutated by the timeline (0→1→0 with alternate)
      title.fg = lerpColor(PULSE_BASE, PULSE_HOT, state.t)
    },
  })
  pulse = { timeline, title }
}

async function playPreview(track: Track) {
  stopPreview() // no overlapping chaos
  currentStream = await audio.playStreamUrl(track.preview, { volume: 0.8 })
  // When the preview finishes (or fails) on its own, settle the title to a
  // solid "selected" colour and stop the pulse.
  const settle = () => {
    if (playing?.track.id === track.id) {
      stopPulse()
      playing.title.fg = "#FF44D9"
    }
    stopPreview()
  }
  currentStream.on("ended", settle)
  currentStream.on("error", settle)
}

// Waveform visualizer (fed by the audio engine's output tap)
const WAVE_HEIGHT = 7
const WAVE_BG = RGBA.fromHex("#1a1a2e")
const WAVE_CY = Math.floor((WAVE_HEIGHT - 1) / 2)
const WAVE_COLD = RGBA.fromHex("#00d4ff")
const WAVE_HOT = RGBA.fromHex("#FF44D9")

const wave = new FrameBufferRenderable(renderer, {
  id: "waveform",
  width: 60,
  height: WAVE_HEIGHT,
})

let tapEnabled = false
function ensureTap() {
  if (!tapEnabled) tapEnabled = audio.enableTap(32768)
}
ensureTap()
// Without an "error" listener the process would throw on audio engine errors
audio.on("error", (err) => console.error(err))

const waveLevels: number[] = []

function drawWaveform() {
  const fb = wave.frameBuffer
  const w = fb.width
  while (waveLevels.length > w) waveLevels.shift()
  while (waveLevels.length < w) waveLevels.unshift(0)
  fb.clear(WAVE_BG)
  for (let x = 0; x < w; x++) {
    const level = waveLevels[x] ?? 0
    const reach = level * (WAVE_CY + 0.5)
    const fg = lerpColor(WAVE_COLD, WAVE_HOT, x / Math.max(1, w - 1))
    for (let y = 0; y < WAVE_HEIGHT; y++) {
      const d = Math.abs(y - WAVE_CY)
      let ch = " "
      if (d + 0.5 <= reach) ch = "█"
      else if (d - 0.5 < reach) ch = y < WAVE_CY ? "▀" : y > WAVE_CY ? "▄" : "─"
      if (ch !== " ") fb.setCell(x, y, ch, fg, WAVE_BG)
    }
  }
  wave.requestRender()
}

const WAVE_INTERVAL_MS = 50
setInterval(() => {
  let amp = 0
  if (tapEnabled) {
    try {
      const frameCount = Math.max(1, Math.round(audio.sampleRate * (WAVE_INTERVAL_MS / 1000)))
      const tap = audio.readTapFrames(frameCount, 2)
      if (tap && tap.framesRead > 0) {
        const data = tap.frames
        let sum = 0
        const n = tap.framesRead * 2
        for (let i = 0; i < n; i++) {
          const sample = data[i]!
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / n)
        amp = Math.min(1, rms * 3.4) // gain: map typical RMS up to the full bar
      }
    } catch {
      // audio engine not ready yet
    }
  }
  const last = waveLevels[waveLevels.length - 1] ?? 0
  const smoothed = Math.max(amp, last * 0.6) // brief peak hold while decaying
  waveLevels.push(smoothed)
  if (waveLevels.length > wave.frameBuffer.width) waveLevels.shift()
  drawWaveform()
}, WAVE_INTERVAL_MS)

// ─── 3D Vinyl Shelf ─────────────────────────────────────────────
// A shelf of record sleeves, one per recommendation. The currently
// open album's cover art is "plucked" off the shelf and floats up,
// centred, to be viewed.

const VINYL_HOME_Y = 1.07 // sleeve centre height resting on the shelf
const VINYL_PULLED = { x: 0, y: 1.2, z: 3.15, ry: 0.08, rx: -0.03, rz: 0 } // artwork, centred
const vinylPalette = ["#FF44D9", "#00d4ff", "#44E4FF", "#B800A8", "#7cff6b", "#ffb347"]

type VinylRecord = {
  id: number
  sleeve: THREE.Mesh
  sleeveMat: THREE.MeshBasicMaterial // unlit: cover art in its true colours
  homeX: number
  homeLean: number
  clock: number
  pulled: boolean
}

let vinylScene: THREE.Scene | null = null
let vinylCamera: THREE.PerspectiveCamera | null = null
const vinylRecords = new Map<number, VinylRecord>()
const coverTextures = new Map<number, THREE.Texture>()

function buildVinylScene(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 50)
  camera.position.set(0, 1.5, 6.6)
  camera.lookAt(0, 1.05, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(2.5, 6, 6)
  scene.add(key)
  const pink = new THREE.PointLight(0xffffff, 10, 16)
  pink.position.set(-3.2, 2.2, 3)
  scene.add(pink)
  const cyan = new THREE.PointLight(0xffffff, 10, 16)
  cyan.position.set(3.2, 2.2, 3)
  scene.add(cyan)

  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.22, 2.4),
    new THREE.MeshStandardMaterial({ color: "#3a2817", roughness: 0.85 }),
  )
  shelf.position.set(0, 0, 0)
  scene.add(shelf)

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 6),
    new THREE.MeshStandardMaterial({ color: "#141428", roughness: 1 }),
  )
  wall.position.set(0, 2, -1.4)
  scene.add(wall)

  return { scene, camera }
}

function makeVinyl(id: number, index: number, total: number): VinylRecord {
  const scene = vinylScene!
  const accent = new THREE.Color(vinylPalette[index % vinylPalette.length]!)

  // Sleeve: the square cover. Unlit material so the artwork shows
  // exactly its own colours (no light tinting).
  const sleeveMat = new THREE.MeshBasicMaterial({ color: accent })
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(1.92, 1.92, 0.1), sleeveMat)

  const homeX = -((total - 1) * 1.08) / 2 + index * 1.08
  const homeLean = index % 2 === 0 ? -0.05 : 0.05
  sleeve.position.set(homeX, VINYL_HOME_Y, 0)
  sleeve.rotation.z = homeLean
  scene.add(sleeve)

  const rec: VinylRecord = {
    id,
    sleeve,
    sleeveMat,
    homeX,
    homeLean,
    clock: 0,
    pulled: false,
  }
  return rec
}

function pluckVinyl(albumId: number) {
  for (const rec of vinylRecords.values()) rec.pulled = rec.id === albumId
}

function updateVinyl(rec: VinylRecord, dt: number) {
  rec.clock += dt

  // The artwork plucks off the shelf and floats, centred, to be viewed
  const sleeveTarget = rec.pulled
    ? VINYL_PULLED
    : { x: rec.homeX, y: VINYL_HOME_Y, z: 0, ry: 0, rx: 0, rz: rec.homeLean }
  const k = 1 - Math.exp(-dt * 5.5)
  const sleeve = rec.sleeve
  sleeve.position.x += (sleeveTarget.x - sleeve.position.x) * k
  sleeve.position.z += (sleeveTarget.z - sleeve.position.z) * k
  const bob = rec.pulled ? Math.sin(rec.clock * 2.4) * 0.03 : 0
  sleeve.position.y = sleeve.position.y * (1 - k) + (sleeveTarget.y + bob) * k
  sleeve.rotation.y += (sleeveTarget.ry - sleeve.rotation.y) * k
  sleeve.rotation.x += (sleeveTarget.rx - sleeve.rotation.x) * k
  sleeve.rotation.z += (sleeveTarget.rz - sleeve.rotation.z) * k
}

async function loadCoverTexture(albumId: number, url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return
    const buf = await res.arrayBuffer()
    const path = `/tmp/stui-cover-${albumId}.jpg`
    await Bun.write(path, buf)
    const tex = await TextureUtils.fromFile(path)
    if (!tex) return
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    coverTextures.set(albumId, tex)
    const rec = vinylRecords.get(albumId)
    if (rec) {
      rec.sleeveMat.map = tex
      rec.sleeveMat.color.set("#ffffff")
      rec.sleeveMat.needsUpdate = true
    }
  } catch (err) {
    console.error("cover texture failed:", err)
  }
}

// Probe for WebGPU before committing to the 3D view; fall back to the
// plain 2D cover image if the native WebGPU library can't be loaded.
let threeView: ThreeRenderable | null = null
let use3D = false
try {
  const { setupGlobals, createWebGPUDevice } = await import("bun-webgpu")
  setupGlobals()
  const device = await Promise.race([
    createWebGPUDevice(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("webgpu probe timed out")), 5000)),
  ])
  use3D = !!device
} catch (err) {
  console.error("WebGPU unavailable, using 2D cover art:", err)
}

if (use3D) {
  const built = buildVinylScene()
  vinylScene = built.scene
  vinylCamera = built.camera

  recommendations.forEach((rec, i) => {
    const v = makeVinyl(rec.id, i, recommendations.length)
    vinylRecords.set(rec.id, v)
  })

  threeView = new ThreeRenderable(renderer, {
    id: "vinyl-shelf",
    scene: vinylScene,
    camera: vinylCamera!,
    width: 60,
    height: 30,
    renderer: { backgroundColor: RGBA.fromHex("#1a1a2e") },
  })

  // Drive the vinyl animation from the renderer's frame loop
  renderer.setFrameCallback(async (deltaTime) => {
    if (!vinylScene) return
    const dt = Math.min(0.05, deltaTime / 1000)
    for (const rec of vinylRecords.values()) updateVinyl(rec, dt)
  })

  // Pull in cover art for every shelf record in the background
  void Promise.all(
    recommendations.map(async (rec) => {
      try {
        const album = await getAlbum(rec.id)
        if (album.cover_big) await loadCoverTexture(rec.id, album.cover_big)
      } catch {
        // sleeve keeps its accent colour
      }
    }),
  )
}

// Row for tools
const toolrow = new BoxRenderable(renderer, {
    flexDirection: "row",
    gap: 2,
    alignItems: "flex-start",
    padding: 1,
})

const discoverBtn = new BoxRenderable(renderer, {
  paddingX: 1,
  flexShrink: 0, // Don't get squashed (not having this means button text overlaps border)
  border: true,
  onMouseDown(event) {
    if (event.button !== 0) return
    const pool = recommendations.filter(r => r.id !== currentAlbumId)
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? recommendations[0]
    if (pick) void openAlbum(pick)
  },
  onMouseOver() { discoverBtn.backgroundColor = "#2a3f8f" },
  onMouseOut() { discoverBtn.backgroundColor = undefined },
})

discoverBtn.add(new TextRenderable(renderer, { content: "Discover an Album", fg: '#B800A8'}))
toolrow.add(discoverBtn)


// Row for album
const albumrow = new BoxRenderable(renderer, {
  flexDirection: "row",   // side by side, not stacked
  gap: 2,                 // breathing room between image and text
  alignItems: "flex-start", // top-align the text block; "center" to centre it
  padding: 1,
})

albumrow.add(use3D && threeView ? threeView : image)

const info = new BoxRenderable(renderer, {
  flexDirection: "column", // text lines stack inside this side panel
  flexGrow: 1,             // grab all remaining width
  gap: 1,
})

const infoTitle = (new TextRenderable(renderer, { content: '', fg: "#FFFFFF", attributes: TextAttributes.BOLD }))
info.add(infoTitle)
const infoMeta = (new TextRenderable(renderer, { content: '', fg: "#999999" }))
info.add(infoMeta)
const reviewsLabel = (new TextRenderable(renderer, {
  content: "── Stu's Reviews ──",
  fg: "#FF44D9",
  attributes: TextAttributes.BOLD,
}))
info.add(reviewsLabel)
const infoDesc = (new TextRenderable(renderer, { content: '', fg: '#44E4FF', attributes: TextAttributes.UNDERLINE }))
info.add(infoDesc)

// Track List
const trackList = new BoxRenderable(renderer, {
  flexDirection: "column",
  flexGrow: 1,
})

info.add(trackList)

albumrow.add(info)

// App Layout & Launch
renderer.root.add(toolrow)
renderer.root.add(albumrow)
renderer.root.add(wave)
renderer.setBackgroundColor(RGBA.fromHex("#1a1a2e"))

const firstRec = recommendations[0]
if (firstRec) await openAlbum(firstRec)
await image.loadPromise
