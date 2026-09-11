import { BoxRenderable, TextRenderable, createCliRenderer } from '@opentui/core';
import Cell from './cell';

export default class Board {
   readonly x: number;
   readonly y: number;
   readonly cells: Cell[][];
   readonly root: BoxRenderable;

   private flagsLeft: number;
   private flagsText: TextRenderable;

   constructor(
      private renderer: Awaited<ReturnType<typeof createCliRenderer>>,
      x: number,
      y: number,
      bombs: number,
      setCursor: (x: number, y: number) => void,
      handleReveal: (cell: Cell) => void,
      handleLoose: () => void
   ) {
      this.x = x;
      this.y = y;
      this.flagsLeft = bombs;

      this.root = new BoxRenderable(renderer, {
         flexDirection: 'column'
      });

      this.flagsText = new TextRenderable(renderer, {
         content: `Flags: ${this.flagsLeft} • Arrow keys: move • Space: dig • F: flag • Mouse: supported`
      });

      this.root.add(this.flagsText);

      // Create a shuffled list of bomb positions
      const bombPositions = new Set(
         Array.from({ length: x * y }, (_, i) => i)
            .sort(() => Math.random() - 0.5)
            .slice(0, bombs)
      );

      this.cells = Array.from({ length: x }, (_, column) =>
         Array.from({ length: y }, (_, row) => {
            const index = column * y + row;
            const bomb = bombPositions.has(index);

            return new Cell(
               renderer,
               bomb,
               column,
               row,
               (column, row) => this.get(column, row),
               (column, row) => setCursor(column, row),
               (cell) => handleReveal(cell),
               () => handleLoose(),
               () => this.incrementFlags(),
               () => this.decrementFlags(),
               () => this.flags
            );
         })
      );

      this.build();

      renderer.root.add(this.root);
   }

   hasWon(): boolean {
      return this.cells.flat().every((cell) => cell.isBomb() || cell.isRevealed());
   }

   get flags(): number {
      return this.flagsLeft;
   }

   incrementFlags(): void {
      this.flagsLeft++;
      this.updateFlagsText();
   }

   decrementFlags(): void {
      if (this.flagsLeft <= 0) {
         return;
      }

      this.flagsLeft--;
      this.updateFlagsText();
   }

   private updateFlagsText(): void {
      this.flagsText.content = `Flags: ${this.flagsLeft}`;
   }

   private build() {
      for (let row = 0; row < this.y; row++) {
         const rowContainer = new BoxRenderable(this.renderer, {
            flexDirection: 'row'
         });

         for (let column = 0; column < this.x; column++) {
            rowContainer.add(this.cells[column]![row]!);
         }

         this.root.add(rowContainer);
      }
   }

   get(column: number, row: number): Cell | null {
      if (column < 0 || column >= this.x || row < 0 || row >= this.y) {
         return null;
      }

      return this.cells[column]![row]!;
   }
}
