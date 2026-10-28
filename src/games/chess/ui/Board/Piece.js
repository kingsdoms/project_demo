// @ts-nocheck
/**
 * @file Piece.js
 * @author tuanca
 */
import "./piece.css";

const GLYPHS = {
  king: "\u265A",
  queen: "\u265B",
  rook: "\u265C",
  bishop: "\u265D",
  knight: "\u265E",
  pawn: "\u265F\uFE0E",
};

export function createPiece(piece) {
  const color = String(piece.side).toLowerCase();
  const type = String(piece.type).toLowerCase();

  const el = document.createElement("div");
  el.className = `piece piece--${color} piece--${type}`;
  el.dataset.id = String(piece.id);
  el.textContent = GLYPHS[type] ?? "?";
  return el;
}
