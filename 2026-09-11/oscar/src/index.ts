import { BoxRenderable, createCliRenderer, TextRenderable } from '@opentui/core';
import Board from './lib/board';
import type Cell from './lib/cell';

const x = 15;
const y = 9;
const bombs = 20;

let firstClick = true;
let startTime: number | null = null;
let finishTime: number | null = null;

const renderer = await createCliRenderer({
   exitOnCtrlC: true
});

const setCursorPosition = (x: number, y: number) => {
   grid.get(cursor.x, cursor.y)!.unHighlight();
   cursor.x = x;
   cursor.y = y;
   grid.get(cursor.x, cursor.y)!.highlight();
};

const handleReveal = (cell: Cell) => {
   if (firstClick) {
      startTime = Date.now();
      firstClick = false;
   }

   cell.inputReveal(false);

   if (grid.hasWon()) {
      finishTime = Date.now();
      handleWin();
   }
};

const handleWin = () => {
   renderer.root.remove(grid.root);

   const elapsedMs = (finishTime ?? Date.now()) - (startTime ?? Date.now());
   const elapsedSeconds = Math.floor(elapsedMs / 1000);

   const minutes = Math.floor(elapsedSeconds / 60);
   const seconds = elapsedSeconds % 60;

   const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

   const winScreen = new BoxRenderable(renderer, {
      width: 60,
      height: 20,
      position: 'absolute',
      left: 10,
      top: 4,
      borderStyle: 'double',
      borderColor: '#66cc66',
      backgroundColor: '#0d0d0d',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
   });

   const banner = new TextRenderable(renderer, {
      content: `
   ██     ██ ██ ███    ██
   ██     ██ ██ ████   ██
   ██  █  ██ ██ ██ ██  ██
   ██ ███ ██ ██ ██  ██ ██
    ███ ███  ██ ██   ████
`,
      fg: '#66cc66',
      attributes: 1
   });

   const cleared = new TextRenderable(renderer, {
      content: '\nM I N E F I E L D   C L E A R',
      fg: '#eeeeee',
      attributes: 1
   });

   const time = new TextRenderable(renderer, {
      content: `\n\nTIME: ${formattedTime}`,
      fg: '#66cc66',
      attributes: 1
   });

   const divider = new TextRenderable(renderer, {
      content: '\n\n────────────────────────────────────────',
      fg: '#333333'
   });

   const status = new TextRenderable(renderer, {
      content: '\n\nALL MINES IDENTIFIED',
      fg: '#66cc66',
      attributes: 1
   });

   const message = new TextRenderable(renderer, {
      content: '\n\nYOU WIN',
      fg: '#eeeeee',
      attributes: 1
   });

   const footer = new TextRenderable(renderer, {
      content: '\n\nPress q to quit',
      fg: '#555555'
   });

   winScreen.add(banner);
   winScreen.add(cleared);
   winScreen.add(divider);
   winScreen.add(status);
   winScreen.add(message);
   winScreen.add(time);
   winScreen.add(footer);

   renderer.root.add(winScreen);

   renderer.keyInput.on('keypress', (key) => {
      if (key.name === 'q') {
         renderer.destroy();
      }
   });
};

const handleLose = () => {
   renderer.root.remove(grid.root);

   const loseScreen = new BoxRenderable(renderer, {
      width: 60,
      height: 20,
      position: 'absolute',
      left: 10,
      top: 4,
      borderStyle: 'double',
      borderColor: '#cc3333',
      backgroundColor: '#0d0d0d',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
   });

   const banner = new TextRenderable(renderer, {
      content: `
   ███    ███  ██ ███    ██ ███████
   ████  ████  ██ ████   ██ ██
   ██ ████ ██  ██ ██ ██  ██ █████
   ██  ██  ██  ██ ██  ██ ██ ██
   ██      ██  ██ ██   ████ ███████
`,
      fg: '#cc3333',
      attributes: 1
   });

   const detonated = new TextRenderable(renderer, {
      content: '\nM I N E   D E T O N A T E D',
      fg: '#eeeeee',
      attributes: 1
   });

   const divider = new TextRenderable(renderer, {
      content: '\n\n────────────────────────────────────────',
      fg: '#333333'
   });

   const status = new TextRenderable(renderer, {
      content: '\n\nCONFIRMED',
      fg: '#cc3333',
      attributes: 1
   });

   const message = new TextRenderable(renderer, {
      content: '\n\nLOSE',
      fg: '#eeeeee',
      attributes: 1
   });

   const footer = new TextRenderable(renderer, {
      content: '\n\nPress q to quit',
      fg: '#555555'
   });

   loseScreen.add(banner);
   loseScreen.add(detonated);
   loseScreen.add(divider);
   loseScreen.add(status);
   loseScreen.add(message);
   loseScreen.add(footer);

   renderer.root.add(loseScreen);
   renderer.keyInput.on('keypress', (key) => {
      if (key.name === 'q') {
         renderer.destroy();
      }
   });
};

const grid = new Board(renderer, x, y, bombs, setCursorPosition, handleReveal, handleLose);

const cursor = {
   x: 0,
   y: 0
};

const moveCursor = ((x: number, y: number) => {
   return (dx: number, dy: number) => {
      const newX = cursor.x + dx;
      const newY = cursor.y + dy;

      if (newX >= 0 && newX < x && newY >= 0 && newY < y) {
         grid.get(cursor.x, cursor.y)!.unHighlight();

         cursor.x = newX;
         cursor.y = newY;

         grid.get(cursor.x, cursor.y)!.highlight();
      }
   };
})(x, y);

const directions: Record<string, [number, number]> = {
   right: [1, 0],
   left: [-1, 0],
   up: [0, -1],
   down: [0, 1]
};

grid.get(cursor.x, cursor.y)!.highlight();

renderer.keyInput.on('keypress', (key) => {
   const direction = directions[key.name];

   if (direction) {
      moveCursor(...direction);
   } else if (key.name === 'space') {
      handleReveal(grid.get(cursor.x, cursor.y)!);
   } else if (key.name === 'f') {
      grid.get(cursor.x, cursor.y)!.toggleFlag();
   }
});
