# OS Ascension

A dark fantasy Phaser platformer built from the Phaser Next.js template. Level 0 has seven computer basics lessons represented by glowing archive cards. Answer all seven correctly to unlock a computer at the far right. Interacting with it opens a practical task for inspecting your Linux VM. Level 1 has a distinct eclipse arena and six Linux setup lessons. Completing them unlocks an Ubuntu installation challenge. The Continue button on that page opens Level 2, which has seven infrastructure automation lessons in a third arena. Completing those lessons unlocks the Chapter 3 automation practical.

## Run it

From the `os-game` directory:

```bash
npm install
npm run dev-nolog
```

Open http://localhost:8080.

## Controls

- Move: left/right arrows or A/D
- Jump: up arrow, W, or Space
- Interact with a nearby numbered object: E, or click the object
- Close a lesson: Escape or the close button
- After completing Level 0, interact with the computer at the far right to open the practical task page and Terminal.app
- After completing Level 1, interact with the installation gate at the far right to open the Ubuntu installation challenge
- After completing Level 2, interact with the automation gate at the far right to open the Chapter 3 practical

The level lesson texts, questions, accepted answers, and object positions are in `src/game/lessons.ts`. The practical questions and accepted answers are in `src/game/practicalQuestions.ts`. The level and movement are in `src/game/scenes/Game.ts`. Physics and the game size are configured in `src/game/main.ts`.

The original arena artwork is in `public/assets/arena-level0.png`, `public/assets/arena-level1.png`, and `public/assets/arena-level2.png`. The cards, platforms, player silhouette, effects, and menus are drawn or styled in code.

The practical task page opens Terminal.app on this Mac when the game is run locally with `npm run dev-nolog`. Connect to the Linux VM with the credentials shown on the page, then use the listed commands to inspect it. The page also has a button to reopen Terminal.app. Answer all seven practical questions correctly to unlock Level 1.

The Chapter 2 installation page shows the SSH tunnel command and a VNC link. Its Continue button is available immediately; it does not check the VM installation before opening Level 2.

The Chapter 3 practical page shows the original `virt-install` command and explains every option. It then guides the player to SSH into `ravage`, remove the `level1-test` VM and disk, verify their removal, and consult the official Ubuntu autoinstall quickstart and reference. The page opens Terminal.app locally and displays the commands for the player to run; it does not execute the VM cleanup itself.
# os-tutorial
