declare module "minesweeper" {
  export const BoardStateEnum: { PRISTINE: number; IN_PROGRESS: number; LOST: number; WON: number };
  export const CellStateEnum: { CLOSED: number; OPEN: number };
  export const CellFlagEnum: { NONE: number; EXCLAMATION: number; QUESTION: number };
  export type Cell = { x: number; y: number; isMine: boolean; numAdjacentMines: number; state: number; flag: number };
  export class Board {
    constructor(mineArray: boolean[][]);
    grid(): Cell[][];
    state(): number;
    openCell(x: number, y: number): void;
    cycleCellFlag(x: number, y: number): void;
  }
  export function generateMineArray(options: { rows: number; cols: number; mines: number }): boolean[][];
}
