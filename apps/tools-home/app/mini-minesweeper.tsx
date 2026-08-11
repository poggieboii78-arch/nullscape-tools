"use client";

import { useState } from "react";
import * as minesweeper from "minesweeper";

const ROWS = 8;
const COLS = 8;
const MINE_COUNT = 10;

type Board = InstanceType<typeof minesweeper.Board>;

function makeBoard(safe?: { x: number; y: number }) {
  let board: Board;
  do {
    board = new minesweeper.Board(minesweeper.generateMineArray({ rows: ROWS, cols: COLS, mines: MINE_COUNT }));
  } while (safe && board.grid()[safe.y][safe.x].isMine);
  return board;
}

export function MiniMinesweeper() {
  // The MIT-licensed `minesweeper` package owns all game logic. This component
  // only renders it; the board stays local and never enters QuickLink state.
  const [game, setGame] = useState(() => ({ board: makeBoard(), revision: 0 }));
  const [open, setOpen] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const newBoard = () => {
    setGame(current => ({ board: makeBoard(), revision: current.revision + 1 }));
    setFlagMode(false);
  };
  const play = (x: number, y: number) => {
    let activeBoard = game.board;
    if (flagMode) activeBoard.cycleCellFlag(x, y);
    else {
      if (activeBoard.state() === minesweeper.BoardStateEnum.PRISTINE) activeBoard = makeBoard({ x, y });
      activeBoard.openCell(x, y);
    }
    setGame(current => ({ board: activeBoard, revision: current.revision + 1 }));
  };
  const flag = (x: number, y: number) => {
    game.board.cycleCellFlag(x, y);
    setGame(current => ({ board: game.board, revision: current.revision + 1 }));
  };

  const state = game.board.state();
  const grid = game.board.grid();
  const flags = grid.flat().filter(cell => cell.flag === minesweeper.CellFlagEnum.EXCLAMATION).length;
  const message = state === minesweeper.BoardStateEnum.WON ? "Cleared!" : state === minesweeper.BoardStateEnum.LOST ? "Kaboom." : state === minesweeper.BoardStateEnum.PRISTINE ? "First click is safe" : "Tread carefully";

  return <section className={`mine-corner${open ? " open" : ""}`} data-quicklink-isolated="true" aria-label="Minesweeper easter egg">
    {open && <div className="mine-inline">
      <header>
        <div><small>LOCAL ONLY · OPEN SOURCE</small><h2>Minesweeper</h2></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close Minesweeper">×</button>
      </header>
      <div className="mine-status"><b>{String(Math.max(0, MINE_COUNT - flags)).padStart(3, "0")}</b><button type="button" onClick={newBoard} aria-label="New board">{state === minesweeper.BoardStateEnum.LOST ? "😵" : state === minesweeper.BoardStateEnum.WON ? "😎" : "🙂"}</button><b>000</b></div>
      <div className="mine-board-scroll">
        <div className="mine-board" role="grid" aria-label="8 by 8 Minesweeper board">
          {grid.flatMap((row, y) => row.map((cell, x) => {
            const revealed = cell.state === minesweeper.CellStateEnum.OPEN;
            const flagged = cell.flag === minesweeper.CellFlagEnum.EXCLAMATION;
            const count = revealed && !cell.isMine ? cell.numAdjacentMines : 0;
            const label = flagged ? "Flagged cell" : revealed ? (cell.isMine ? "Mine" : `${count} neighboring mines`) : "Hidden cell";
            return <button key={`${x}-${y}`} type="button" role="gridcell" aria-label={label}
              className={`mine-cell${revealed ? " revealed" : ""}${revealed && cell.isMine ? " exploded" : ""}${count ? ` count-${count}` : ""}`}
              onClick={() => play(x, y)} onContextMenu={event => { event.preventDefault(); flag(x, y); }}>
              {flagged && !revealed ? "⚑" : revealed && cell.isMine ? "✹" : count || ""}
            </button>;
          }))}
        </div>
      </div>
      <div className="mine-actions">
        <button className={flagMode ? "active" : ""} type="button" onClick={() => setFlagMode(value => !value)} aria-pressed={flagMode}>⚑ Flag mode</button>
        <button type="button" onClick={newBoard}>New board</button>
      </div>
      <div className="mine-message">{message}</div>
      <p>Game logic by <a href="https://github.com/binaryluke/Minesweeper" target="_blank" rel="noreferrer">binaryluke/Minesweeper</a> · MIT License</p>
    </div>}
    <button className="mine-launcher" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={open ? "Close tiny Minesweeper" : "Open tiny Minesweeper"} title="Tiny open-source Minesweeper">💣</button>
  </section>;
}
