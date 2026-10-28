// @ts-nocheck

/**
 * @file Square.js
 * @author tuanca
 */

import "./square.css";
import { createPiece } from "./Piece.js";

export function createSquare(row, col, piece = null) {
  const el = document.createElement("div");
  const isLight = (row + col) % 2 === 0;
  el.className = `board-cell board-cell--${isLight ? "light" : "dark"}`;
  el.dataset.row = String(row);
  el.dataset.col = String(col);
  if (piece) el.appendChild(createPiece(piece));
  return el;
}

export function updateSquare(el, { piece, selectedId, target ,check}) {
  const current = el.querySelector(".piece");
  const currentId = current ? current.dataset.id : null;
  const nextId = piece ? String(piece.id) : null;

  if (currentId !== nextId) {
    current?.remove();
    if (piece) el.appendChild(createPiece(piece));
  }
  el.classList.toggle("selected", !!piece && piece.id === selectedId);
  el.classList.toggle("target", target === "move");
  el.classList.toggle("capture", target === "capture");
  el.classList.toggle("check", check);
}
