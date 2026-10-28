// @ts-nocheck
/**
 * @file index.js
 * @author tuanca
 */

import "./board.css";
import { createSquare, updateSquare } from "./Square.js";

export function createBoard(controller) {
  const view = controller.getView();
  const byPos = new Map(view.pieces.map((p) => [`${p.row},${p.col}`, p]));
  const el = document.createElement("div");
  el.className = "board";
  el.style.gridTemplateColumns = `repeat(${view.cols}, 1fr)`;
  for (let r = 0; r < view.rows; r++) {
    for (let c = 0; c < view.cols; c++) {
      el.appendChild(createSquare(r, c, byPos.get(`${r},${c}`)));
    }
  }
  el.addEventListener("click", (e) => {
    const sq =
      e.target instanceof Element ? e.target.closest(".board-cell") : null;
    if (!(sq instanceof HTMLElement) || !controller.getView().canAct) return;
    // TODO: đổi theo tên action thật
    controller.actions.clickSquare(
      Number(sq.dataset.row),
      Number(sq.dataset.col),
    );
  });
  return el;
}

export function updateBoard(el, view) {
  console.log(view);
  
  el.classList.toggle("locked", !view.canAct);

  const { rows, cols, pieces, selectedId, targets } = view;
  const key = (r, c) => `${r},${c}`;

  const byPos = new Map(pieces.map((p) => [key(p.row, p.col), p]));
  // key -> capture (true: ăn quân, false: nước đi thường)
  const targetMap = new Map(targets.map((t) => [key(t.row, t.col), t.capture]));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = key(r, c);
      updateSquare(el.children[r * cols + c], {
        piece: byPos.get(k),
        selectedId,
        target: targetMap.has(k) ? (targetMap.get(k) ? "capture" : "move") : null,
        check: view.checkedKing && view.checkedKing.row === r && view.checkedKing.col === c
      });
    }
  }
}