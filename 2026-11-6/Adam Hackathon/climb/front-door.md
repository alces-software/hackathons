# Front door — sacct-reporter climb

1. **The box:** run `./climb/env-check.sh` — green banner says go. (It verifies the tarball and the tools. Nothing else. No zlib, no hints.)
2. **The find:** `tar -xzf sacct-reporter-1.0.tar.gz` — someone left this source and its README behind. Read the README like a *suspect*, not documentation.
3. **The ladder:** open `climb/climb-log.md`, then climb rungs 0–5. Each rung's card tells you the win; `./climb/check.sh <n>` proves it. Take hints freely — they never cost you state.
4. **The log:** every gate, every stall, every hint — in `climb/climb-log.md`. The debrief reads it.

Reset, any time, no exceptions: `./climb/reset-sandbox.sh` — back to rung 0, nothing carried over.

**Six lies are planted in that README. One per rung. Catching each is the rung's engine, not an obstacle.**
