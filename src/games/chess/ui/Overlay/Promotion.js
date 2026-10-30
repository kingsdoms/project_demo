// @ts-nocheck
/**
 * @file Promotion.js
 * @author tuanca
 */


import "./promotion.css";
import { createPiece } from "../Board/Piece.js";

const DEFAULT_TIMEOUT_MS = 10000;


export function createPromotion(promotion, opts = {}) {
  const { side, options } = promotion;
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onPick } = opts;

  let done = false;
  const deadline = Date.now() + timeoutMs;

  const el = document.createElement("div");
  el.className = "promotion";

  const dialog = document.createElement("div");
  dialog.className = "promotion-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Chọn quân phong cấp");
  dialog.style.setProperty("--promotion-count", String(options.length));
  dialog.style.setProperty("--promotion-duration", `${timeoutMs}ms`);

  const title = document.createElement("div");
  title.className = "promotion-title";
  title.textContent = "Phong cấp tốt thành:";

  const list = document.createElement("div");
  list.className = "promotion-options";

  for (const type of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "promotion-option";
    btn.dataset.type = type;
    btn.title = type;
    btn.setAttribute("aria-label",  type);
    btn.appendChild(createPiece({ id: `${side}-${type}`, color: side, type }));
    btn.addEventListener("click", () => finish(type));
    list.appendChild(btn);
  }

  const timer = document.createElement("div");
  timer.className = "promotion-timer";
  const timerText = document.createElement("span");
  timerText.className = "promotion-timer-text";
  const timerBar = document.createElement("div");
  timerBar.className = "promotion-timer-bar";
  timer.append(timerText, timerBar);

  dialog.append(title, list, timer);
  el.appendChild(dialog);

  // đếm ngược: setTimeout quyết định hết giờ, interval chỉ cập nhật số giây
  const updateText = () => {
    const s = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    timerText.textContent = `${s}s`;
  };
  updateText();
  const intervalId = setInterval(updateText, 250);
  const timeoutId = setTimeout(() => {
    const random = options[Math.floor(Math.random() * options.length)];
    finish(random);
  }, timeoutMs);

  function destroy() {
    clearTimeout(timeoutId);
    clearInterval(intervalId);
    el.remove();
  }

  function finish(type) {
    if (done) return; // chặn bấm + hết giờ cùng lúc
    done = true;
    destroy();
    onPick?.(type);
  }

  // đưa focus vào nút đầu tiên để dùng được bàn phím
  queueMicrotask(() => list.firstElementChild?.focus());

  return { el, destroy };
}