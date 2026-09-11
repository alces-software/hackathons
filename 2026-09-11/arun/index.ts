import {
  BoxRenderable,
  createCliRenderer,
} from "@opentui/core"

import {
  ThreeRenderable,
  THREE,
} from "@opentui/three"


// Main background soundtrack
// This plays continuously while the app is running

const music = Bun.spawn([
  "afplay",
  "-v",
  "0.4",
  "assets/space.mp3",
])


// Earth soundtrack
// This will only play while Earth is selected

let earthMusic: ReturnType<typeof Bun.spawn> | null = null


function playEarthMusic() {

  // Don't start another copy if it is already playing

  if (earthMusic) return

  earthMusic = Bun.spawn([
  "afplay",
  "-v",
  "2",
  "assets/earth.mp3",
])
}


function stopEarthMusic() {

  if (!earthMusic) return

  earthMusic.kill()

  earthMusic = null
}


// Planet data

type Planet = {
  name: string,
  color: number,
  radius: number
}

const planets: Planet[] = [
  {
    name: "Sun",
    color: 0xffcc33,
    radius: 2.2,
  },
  {
    name: "Mercury",
    color: 0xa5a5a5,
    radius: 0.38,
  },
  {
    name: "Venus",
    color: 0xd9a066,
    radius: 0.95,
  },
  {
    name: "Earth",
    color: 0x246fba,
    radius: 1,
  },
  {
    name: "Mars",
    color: 0xc1440e,
    radius: 0.53,
  },
  {
    name: "Jupiter",
    color: 0xd2b48c,
    radius: 1.8,
  },
  {
    name: "Saturn",
    color: 0xc9b08a,
    radius: 1.6,
  },
  {
    name: "Uranus",
    color: 0x7fdbff,
    radius: 1.25,
  },
  {
    name: "Neptune",
    color: 0x4169e1,
    radius: 1.2,
  },
]

let currentPlanetIndex = 0

const planetGroup =
  new THREE.Group()

const planetSpacing = 20

let targetGroupX = 0


// Update extra soundtrack depending
// on which planet is currently selected

function updatePlanetMusic() {

  const selectedPlanet =
    planets[currentPlanetIndex]

  if (
    selectedPlanet.name ===
    "Earth"
  ) {

    playEarthMusic()

  } else {

    stopEarthMusic()
  }
}


// Main OpenTUI renderer

const renderer =
  await createCliRenderer({
    targetFps: 30,
  })


// 3D scene

const scene =
  new THREE.Scene()

scene.background =
  new THREE.Color(
    0x000008
  )


// Background stars

const starGeometry =
  new THREE.BufferGeometry()

const starCount = 500

const starPositions =
  new Float32Array(
    starCount * 3
  )

for (
  let i = 0;
  i < starCount;
  i++
) {

  starPositions[i * 3] =
    (Math.random() - 0.5) *
    200

  starPositions[i * 3 + 1] =
    (Math.random() - 0.5) *
    200

  starPositions[i * 3 + 2] =
    (Math.random() - 0.5) *
    200
}

starGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(
    starPositions,
    3
  )
)

const starMaterial =
  new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
  })

const stars =
  new THREE.Points(
    starGeometry,
    starMaterial
  )

scene.add(stars)


// Camera setup

const camera =
  new THREE.PerspectiveCamera(
    45,
    1,
    0.1,
    100
  )

camera.position.z = 5


// Camera light
// This acts like a small torch attached to the camera
// so the planet facing us is always visible

const cameraLight =
  new THREE.DirectionalLight(
    0xffffff,
    1
  )


// Light shines from the camera towards the centre

cameraLight.position.copy(
  camera.position
)

const cameraLightTarget =
  new THREE.Object3D()

cameraLightTarget.position.set(
  0,
  0,
  0
)

scene.add(
  cameraLightTarget
)

cameraLight.target =
  cameraLightTarget

scene.add(
  cameraLight
)


// Mouse tracking

let lastMouseX = 0
let lastMouseY = 0

let yaw = 0
let pitch = 0

let cameraDistance = 5


// Keyboard handling

renderer.keyInput.on(
  "keypress",
  (key) => {

    if (
      key.name ===
      "right"
    ) {

      currentPlanetIndex++

      if (
        currentPlanetIndex >=
        planets.length
      ) {

        currentPlanetIndex = 0
      }

      targetGroupX =
        -(
          currentPlanetIndex *
          planetSpacing
        )

      // Start Earth music if we
      // have just selected Earth

      updatePlanetMusic()
    }


    if (
      key.name ===
      "left"
    ) {

      currentPlanetIndex--

      if (
        currentPlanetIndex < 0
      ) {

        currentPlanetIndex =
          planets.length - 1
      }

      targetGroupX =
        -(
          currentPlanetIndex *
          planetSpacing
        )

      // Start Earth music if we
      // have just selected Earth

      updatePlanetMusic()
    }
  }
)


// Mouse handler / main container

const container =
  new BoxRenderable(
    renderer,
    {
      width: "100%",
      height: "100%",

      onMouseDown(event) {

        lastMouseX =
          event.x

        lastMouseY =
          event.y
      },


      onMouseScroll(event) {

        if (!event.scroll) {
          return
        }

        if (
          event.scroll.direction ===
          "down"
        ) {

          cameraDistance +=
            0.5

        } else {

          cameraDistance -=
            0.5
        }

        cameraDistance =
          Math.max(
            2,
            Math.min(
              12,
              cameraDistance
            )
          )

        camera.position.x =
          cameraDistance *
          Math.cos(pitch) *
          Math.sin(yaw)

        camera.position.y =
          cameraDistance *
          Math.sin(pitch)

        camera.position.z =
          cameraDistance *
          Math.cos(pitch) *
          Math.cos(yaw)

        camera.lookAt(
          0,
          0,
          0
        )

        // Move the camera light with the camera

        cameraLight.position.copy(
          camera.position
        )
      },


      onMouseDrag(event) {

        const deltaX =
          event.x -
          lastMouseX

        const deltaY =
          event.y -
          lastMouseY

        yaw -=
          deltaX * 0.05

        pitch -=
          deltaY * 0.05


        // Stop the camera flipping over the top/bottom

        pitch =
          Math.max(
            -Math.PI / 2 + 0.1,
            Math.min(
              Math.PI / 2 - 0.1,
              pitch
            )
          )

        camera.position.x =
          cameraDistance *
          Math.cos(pitch) *
          Math.sin(yaw)

        camera.position.y =
          cameraDistance *
          Math.sin(pitch)

        camera.position.z =
          cameraDistance *
          Math.cos(pitch) *
          Math.cos(yaw)

        camera.lookAt(
          0,
          0,
          0
        )

        // Move the camera light with the camera

        cameraLight.position.copy(
          camera.position
        )

        lastMouseX =
          event.x

        lastMouseY =
          event.y
      },
    }
  )


// Three.js renderer inside OpenTUI

const three =
  new ThreeRenderable(
    renderer,
    {
      id: "three",
      width: "100%",
      height: "100%",
      scene,
      camera,
    }
  )

container.add(
  three
)

renderer.root.add(
  container
)


// Earth geometry
// Earth uses vertex colours instead of separate green meshes.
// This means the ocean and land are part of the same sphere.

function createEarthGeometry(
  radius: number
) {

  const geometry =
    new THREE.SphereGeometry(
      radius,
      48,
      24
    )

  const positions =
    geometry.attributes.position

  const colors:
    number[] = []

  const ocean =
    new THREE.Color(
      0x246fba
    )

  const land =
    new THREE.Color(
      0x4f8f3a
    )

  for (
    let i = 0;
    i < positions.count;
    i++
  ) {

    const x =
      positions.getX(i)

    const y =
      positions.getY(i)

    const z =
      positions.getZ(i)


    // Combine a few simple waves to make irregular
    // continent-like shapes around the sphere

    const landNoise =
      Math.sin(x * 5) +
      Math.sin(y * 7) +
      Math.cos(z * 6) +
      Math.sin(
        (x + y + z) *
        4
      )

    const color =
      landNoise > 1.1
        ? land
        : ocean

    colors.push(
      color.r,
      color.g,
      color.b
    )
  }

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      colors,
      3
    )
  )

  return geometry
}


// Jupiter geometry
// Jupiter also uses vertex colours,
// but this time the colours are based on latitude
// to create horizontal cloud bands.

function createJupiterGeometry(
  radius: number
) {

  const geometry =
    new THREE.SphereGeometry(
      radius,
      48,
      32
    )

  const positions =
    geometry.attributes.position

  const colors:
    number[] = []

  const lightCream =
    new THREE.Color(
      0xead9b8
    )

  const cream =
    new THREE.Color(
      0xd8c39f
    )

  const tan =
    new THREE.Color(
      0xb9946c
    )

  const brown =
    new THREE.Color(
      0x8f6244
    )

  const rust =
    new THREE.Color(
      0xb46f4c
    )

  for (
    let i = 0;
    i < positions.count;
    i++
  ) {

    const y =
      positions.getY(i)

    // Convert the vertical position into
    // a latitude value between roughly -1 and 1

    const latitude =
      y / radius

    let color =
      cream


    // Different latitude ranges create
    // Jupiter's recognisable horizontal stripes

    if (
      latitude > 0.72
    ) {

      color =
        lightCream

    } else if (
      latitude > 0.55
    ) {

      color =
        tan

    } else if (
      latitude > 0.38
    ) {

      color =
        lightCream

    } else if (
      latitude > 0.2
    ) {

      color =
        brown

    } else if (
      latitude > 0.02
    ) {

      color =
        cream

    } else if (
      latitude > -0.15
    ) {

      color =
        rust

    } else if (
      latitude > -0.32
    ) {

      color =
        lightCream

    } else if (
      latitude > -0.5
    ) {

      color =
        tan

    } else if (
      latitude > -0.68
    ) {

      color =
        cream

    } else {

      color =
        lightCream
    }

    colors.push(
      color.r,
      color.g,
      color.b
    )
  }

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      colors,
      3
    )
  )

  return geometry
}


// Planet stuff

function createPlanets() {

  planets.forEach(
    (
      planet,
      index
    ) => {

      // Earth gets custom geometry so its land
      // is built into the surface of the sphere
      // Jupiter gets custom geometry for its horizontal cloud bands

      const geometry =
        planet.name ===
        "Earth"

          ? createEarthGeometry(
              planet.radius
            )

          : planet.name ===
            "Jupiter"

            ? createJupiterGeometry(
                planet.radius
              )

            : new THREE.SphereGeometry(
                planet.radius,
                32,
                16
              )


      // Sun gets its own glowing material
      // Earth uses vertex colours for oceans and land
      // Jupiter uses vertex colours for its cloud bands
      // Saturn gets a rough material so it looks less shiny/plastic
      // Other planets use the normal Phong material

      const material =
        planet.name ===
        "Earth"

          ? new THREE.MeshPhongMaterial({
              vertexColors:
                true,

              emissive:
                0x071a0d,

              emissiveIntensity:
                0.05,
            })

          : planet.name ===
            "Jupiter"

            ? new THREE.MeshPhongMaterial({
                vertexColors:
                  true,

                emissive:
                  0x24160d,

                emissiveIntensity:
                  0.04,
              })

            : planet.name ===
              "Sun"

              ? new THREE.MeshPhongMaterial({
                  color:
                    planet.color,

                  emissive:
                    planet.color,

                  emissiveIntensity:
                    1,
                })

              : planet.name ===
                "Saturn"

                ? new THREE.MeshStandardMaterial({
                    color:
                      0xb89b70,

                    roughness:
                      0.9,

                    metalness:
                      0,
                  })

                : new THREE.MeshPhongMaterial({
                    color:
                      planet.color,

                    emissive:
                      planet.color,

                    emissiveIntensity:
                      0.05,
                  })


      const planetMesh =
        new THREE.Mesh(
          geometry,
          material
        )


      // Saturn rings

      if (
        planet.name ===
        "Saturn"
      ) {

        const ringGeometry =
          new THREE.RingGeometry(
            planet.radius *
            1.3,

            planet.radius *
            2.1,

            64
          )

        const ringMaterial =
          new THREE.MeshBasicMaterial({
            color:
              0xb8a78c,

            side:
              THREE.DoubleSide,

            transparent:
              true,

            opacity:
              0.8,
          })

        const rings =
          new THREE.Mesh(
            ringGeometry,
            ringMaterial
          )


        // Tilt the rings so they are visible from the camera

        rings.rotation.x =
          Math.PI / 2.5

        planetMesh.add(
          rings
        )
      }


      planetMesh.position.x =
        index *
        planetSpacing

      planetGroup.add(
        planetMesh
      )
    }
  )
}


// Lighting

// Small amount of light everywhere so planets aren't completely black

const ambientLight =
  new THREE.AmbientLight(
    0xffffff,
    0.15
  )

scene.add(
  ambientLight
)


// Main light source - attached to the Sun

const sunLight =
  new THREE.PointLight(
    0xffffff,
    6000
  )

sunLight.position.set(
  0,
  0,
  0
)

planetGroup.add(
  sunLight
)


// Add the whole solar system group to the scene

scene.add(
  planetGroup
)


// Load current planet

createPlanets()


// Animate group toward selected planet

renderer.setFrameCallback(
  async (deltaTime) => {

    planetGroup.position.x +=
      (
        targetGroupX -
        planetGroup.position.x
      ) * 0.1
  }
)


// Start rendering

renderer.start()