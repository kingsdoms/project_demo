/**
 * @file index.js
 * @author tuanca
 */
import { createBoard, updateBoard } from "./Board/index.js";
import { createPromotion } from "./Overlay/Promotion.js";
import { createResult } from "./Overlay/Result.js";

/**
 * Gắn UI vào container. Trả về hàm hủy.
 * @param {HTMLElement} container Phần tử chứa (#ui-host).
 * @param {any} controller Controller do create() trả về. TODO: thay `any` bằng type thật.
 */
export function mount(container, controller) {
  const root = document.createElement("div");
  root.className = "chess-root";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.width = "100%";
  root.style.height = "100%";

  const board = createBoard(controller);

  root.append(board);
  container.replaceChildren(root);

  // ── Lắng nghe controller ──
  let mounted = true;
  /** @type {any} */ let lastView = null;

  const render = () => {
    const view = controller.getView();
    if (!mounted || view === lastView) return;
    updateBoard(board, view);

    if (view.promotion && view.canAct) {
      const { el, destroy } = createPromotion(view.promotion, {
        timeoutMs: 10000,
        onPick: (/** @type {any} */ type) => controller.actions.promote(type),
      });
      root.appendChild(el);
    }

    if (view.result) {
      root.appendChild(createResult(view.result).el);
      controller.destroy();
    }
  };

  const offs = [
    controller.subscribe(render),
    controller.onError((/** @type {any} */ e) => {
      console.error(e);
    }),
  ];

  render(); // vẽ lần đầu

  return function unmount() {
    if (!mounted) return;
    mounted = false;
    for (const off of offs) {
      if (typeof off === "function") off();
    }
    root.remove();
  };
}
