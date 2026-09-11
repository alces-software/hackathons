import { BoxRenderable, TextRenderable, type RenderContext } from '@opentui/core';

export default class Cell extends BoxRenderable {
   private bomb: boolean;
   private content: BoxRenderable;
   private text: TextRenderable;
   private highlighted = false;
   private flagged = false;
   private danger: number | null = null;
   private readonly baseColor = '#334155';
   private readonly contentColor = '#64748B';
   private readonly column: number;
   private readonly row: number;
   private revealed = false;

   getCell: (column: number, row: number) => Cell | null;
   handleLoose: () => void;
   incrementFlags: () => void;
   decrementFlags: () => void;
   flags: () => number;

   constructor(
      renderer: RenderContext,
      bomb: boolean,
      x: number,
      y: number,
      getCell: (column: number, row: number) => Cell | null,
      setCursor: (x: number, y: number) => void,
      handleReveal: (cell: Cell) => void,
      handleLoose: () => void,
      incrementFlags: () => void,
      decrementFlags: () => void,
      flags: () => number
   ) {
      super(renderer, {
         width: 9,
         height: 5,
         justifyContent: 'center',
         alignItems: 'center',
         backgroundColor: '#334155',
         onMouseOver: () => {
            setCursor(x, y);
         },
         onMouseDown: () => {
            handleReveal(this);
         }
      });

      this.content = new BoxRenderable(renderer, {
         width: 5,
         height: 3,
         justifyContent: 'center',
         alignItems: 'center',
         backgroundColor: '#64748B'
      });

      this.text = new TextRenderable(renderer, {
         content: ''
      });

      this.content.add(this.text);
      this.add(this.content);

      this.column = x;
      this.row = y;
      this.bomb = bomb;
      this.getCell = getCell;
      this.handleLoose = handleLoose;
      this.incrementFlags = incrementFlags;
      this.decrementFlags = decrementFlags;
      this.flags = flags;
   }

   private lighten(hex: string, amount: number): string {
      const value = parseInt(hex.slice(1), 16);

      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;

      const newR = Math.min(255, Math.round(r + (255 - r) * amount));
      const newG = Math.min(255, Math.round(g + (255 - g) * amount));
      const newB = Math.min(255, Math.round(b + (255 - b) * amount));

      return `#${((newR << 16) | (newG << 8) | newB).toString(16).padStart(6, '0')}`;
   }

   private applyColors() {
      let innerColor = this.contentColor;

      if (this.flagged) {
         innerColor = '#68F527';
      }
      if (this.revealed) {
         innerColor = this.bomb ? '#EF4444' : '#3B82F6';
      }

      if (this.highlighted) {
         this.backgroundColor = this.lighten(this.baseColor, 0.15);
         innerColor = this.lighten(innerColor, 0.15);
      } else {
         this.backgroundColor = this.baseColor;
      }

      this.content.backgroundColor = innerColor;
   }

   private getNeighbors() {
      const x = this.column;
      const y = this.row;
      return [
         { x: x - 1, y: y - 1 },
         { x, y: y - 1 },
         { x: x + 1, y: y - 1 },
         { x: x - 1, y },
         { x: x + 1, y },
         { x: x - 1, y: y + 1 },
         { x, y: y + 1 },
         { x: x + 1, y: y + 1 }
      ];
   }

   private calculateDanger() {
      const neighbors = this.getNeighbors();

      return neighbors.reduce((count, pos) => {
         const cell = this.getCell(pos.x, pos.y);

         if (!cell) {
            return count;
         }

         const isBomb = cell.isBomb();

         return count + (isBomb ? 1 : 0);
      }, 0);
   }

   digNeighbors() {
      const neighbors = this.getNeighbors();

      neighbors.forEach((pos) => {
         const cell = this.getCell(pos.x, pos.y);
         if (cell && !cell.revealed) {
            cell.reveal();
         }
      });
   }

   highlight() {
      this.highlighted = true;
      this.applyColors();
   }

   unHighlight() {
      this.highlighted = false;
      this.applyColors();
   }

   toggleFlag() {
      if (this.flagged) {
         this.incrementFlags();
      } else {
         if (this.flags() <= 0 || this.revealed) return;
         this.decrementFlags();
      }
      this.flagged = !this.flagged;
      this.applyColors();
   }

   isBomb() {
      return this.bomb;
   }

   isRevealed() {
      return this.revealed;
   }

   inputReveal(firstClick: boolean) {
      if (firstClick) {
         this.bomb = false;
      }
      if (this.revealed) {
         this.digNeighbors();
      } else {
         this.reveal();
      }
   }

   reveal() {
      if (this.revealed || this.flagged) return;
      this.revealed = true;

      if (this.bomb) {
         this.handleLoose();
      }

      this.danger = this.calculateDanger();

      if (this.danger === 0) {
         this.digNeighbors();
      }

      this.text.content = this.danger === 0 || this.bomb ? '' : String(this.danger);
      this.applyColors();
   }
}
