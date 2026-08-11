"use client";

import { useEffect, useState } from "react";

const SIZE = 8;
const MINE_COUNT = 10;
const CELLS = SIZE * SIZE;

type GameStatus = "ready" | "playing" | "won" | "lost";

function neighbors(index: number) {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const result: number[] = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (
        (rowOffset !== 0 || columnOffset !== 0) &&
        nextRow >= 0 && nextRow < SIZE && nextColumn >= 0 && nextColumn < SIZE
      ) result.push(nextRow * SIZE + nextColumn);
    }
  }
  return result;
}

function placeMines(safeIndex: number) {
  const available = Array.from({ length: CELLS }, (_, index) => index).filter(index => index !== safeIndex);
  for (let index = available.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
  }
  return new Set(available.slice(0, MINE_COUNT));
}

function revealArea(start: number, mines: Set<number>, revealed: Set<number>) {
  const next = new Set(revealed);
  const queue = [start];
  while (queue.length) {
    const index = queue.shift()!;
    if (next.has(index) || mines.has(index)) continue;
    next.add(index);
    const nearby = neighbors(index);
    if (!nearby.some(cell => mines.has(cell))) {
      nearby.forEach(cell => {
        if (!next.has(cell) && !mines.has(cell)) queue.push(cell);
      });
    }
  }
  return next;
}

export function MiniMinesweeper() {
  // Deliberately component-local: this state is never passed to the shared run
  // or QuickLink, so every browser/tab always gets its own private board.
  const [open, setOpen] = useState(false);
  const [mines, setMines] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<GameStatus>("ready");
  const [flagMode, setFlagMode] = useState(false);

  const reset = () => {
    setMines(new Set());
    setRevealed(new Set());
    setFlagged(new Set());
    setStatus("ready");
    setFlagMode(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const toggleFlag = (index: number) => {
    if (revealed.has(index) || status === "won" || status === "lost") return;
    setFlagged(current => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else if (next.size < MINE_COUNT) next.add(index);
      return next;
    });
  };

  const reveal = (index: number) => {
    if (flagMode) {
      toggleFlag(index);
      return;
    }
    if (flagged.has(index) || revealed.has(index) || status === "won" || status === "lost") return;
    const activeMines = status === "ready" ? placeMines(index) : mines;
    if (status === "ready") {
      setMines(activeMines);
      setStatus("playing");
    }
    if (activeMines.has(index)) {
      setRevealed(new Set([...revealed, ...activeMines]));
      setStatus("lost");
      return;
    }
    const nextRevealed = revealArea(index, activeMines, revealed);
    setRevealed(nextRevealed);
    if (nextRevealed.size === CELLS - MINE_COUNT) setStatus("won");
  };

  const message = status === "won" ? "Cleared!" : status === "lost" ? "Kaboom." : status === "ready" ? "First click is safe" : "Tread carefully";

  return <>
    <button className="mine-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open mini Minesweeper" title="Tiny Minesweeper">💣</button>
    {open && <div className="mine-layer" role="presentation" data-quicklink-isolated="true" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="mine-dialog" role="dialog" aria-modal="true" aria-labelledby="mine-title" onClick={event => event.stopPropagation()}>
        <header>
          <div><small>SECRET BREAK TIME · LOCAL ONLY</small><h2 id="mine-title">Tiny Minesweeper</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close Minesweeper">×</button>
        </header>
        <div className="mine-status"><span>{message}</span><b>{Math.max(0, MINE_COUNT - flagged.size)} 💣</b></div>
        <div className="mine-board" role="grid" aria-label="8 by 8 Minesweeper board">
          {Array.from({ length: CELLS }, (_, index) => {
            const isRevealed = revealed.has(index);
            const isMine = mines.has(index);
            const isFlagged = flagged.has(index);
            const count = isRevealed && !isMine ? neighbors(index).filter(cell => mines.has(cell)).length : 0;
            const label = isFlagged ? "Flagged cell" : isRevealed ? (isMine ? "Mine" : `${count} neighboring mines`) : "Hidden cell";
            return <button
              key={index}
              type="button"
              role="gridcell"
              aria-label={label}
              className={`mine-cell${isRevealed ? " revealed" : ""}${isMine && isRevealed ? " exploded" : ""}${count ? ` count-${count}` : ""}`}
              onClick={() => reveal(index)}
              onContextMenu={event => { event.preventDefault(); toggleFlag(index); }}
            >{isFlagged && !isRevealed ? "⚑" : isMine && isRevealed ? "✹" : count || ""}</button>;
          })}
        </div>
        <div className="mine-actions">
          <button className={flagMode ? "active" : ""} type="button" onClick={() => setFlagMode(value => !value)} aria-pressed={flagMode}>⚑ Flag mode</button>
          <button type="button" onClick={reset}>New board</button>
        </div>
        <p>Left-click to reveal · Right-click to flag</p>
      </section>
    </div>}
  </>;
}
