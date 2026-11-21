/**
 * @file index.js
 * @author tuanca
 */
import { createBoard, updateBoard } from "./Board/index.js";
import { createPromotion } from "./Overlay/Promotion.js";

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
  /** @type {ReturnType<typeof createPromotion> | null} */ let overlay = null;

  const render = () => {
    const view = controller.getView();
    if (!mounted || view === lastView) return;
    lastView = view;
    updateBoard(board, view);

    overlay?.destroy();
    overlay = null;
    if (view.promotion && view.canAct) {
      overlay = createPromotion(view.promotion, {
        timeoutMs: 10000,
        onPick: (/** @type {any} */ type) => controller.actions.promote(type),
      });
      root.appendChild(overlay.el);
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
    overlay?.destroy();
    for (const off of offs) {
      if (typeof off === "function") off();
    }
    root.remove();
  };
}
