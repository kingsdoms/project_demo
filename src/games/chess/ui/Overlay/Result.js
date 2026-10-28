// @ts-nocheck
/**
 * @file Result.js
 * @author tuanca
 */

import "./result.css";

const SIDE = { WHITE: "Trắng", BLACK: "Đen" };

const REASONS = {
  CHECKMATE: "Chiếu hết",
  STALEMATE: "Hết nước đi (hòa cờ)",
  RESIGN: "Đầu hàng",
  TIMEOUT: "Hết giờ",
  DRAW: "Hòa",
};

/**
 * @param {{ winner?: string | null, reason?: string }} result  view.result
 * @param {{ onClose?: () => void }} [opts]
 */
export function createResult(result, opts = {}) {
  const { winner, reason } = result;

  const el = document.createElement("div");
  el.className = "result";

  const dialog = document.createElement("div");
  dialog.className = "result-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const title = document.createElement("div");
  title.className = "result-title";
  title.textContent = winner ? `${SIDE[winner] ?? winner} thắng` : "Hòa";

  const detail = document.createElement("div");
  detail.className = "result-reason";
  detail.textContent = REASONS[reason] ?? reason ?? "";

  dialog.append(title, detail);

  if (opts.onClose) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "result-close";
    btn.textContent = "Đóng";
    btn.addEventListener("click", opts.onClose);
    dialog.appendChild(btn);
  }

  el.appendChild(dialog);
  return { el, destroy: () => el.remove() };
}