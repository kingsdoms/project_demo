/**
 * @file index.js
 * @author tuanca
 */

// Những chỗ đánh dấu TODO là mình đoán; hãy đổi theo đúng tên/shape thật trong controller của bạn.
 
const STYLE_ID = "chess-ui-style";
const CSS = `
.chess-ui { display: inline-flex; flex-direction: column; gap: 8px; font-family: system-ui, sans-serif; }
.chess-ui .board { display: grid; border: 2px solid #444; user-select: none; }
.chess-ui .board.locked { opacity: .7; pointer-events: none; }
.chess-ui .sq { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;
  font-size: 38px; line-height: 1; cursor: pointer; position: relative; }
.chess-ui .sq.light { background: #f0d9b5; }
.chess-ui .sq.dark { background: #b58863; }
.chess-ui .sq.selected { outline: 3px solid #2f80ed; outline-offset: -3px; }
.chess-ui .sq.check { background: #e85d5d; }
.chess-ui .sq.target::after { content: ""; width: 16px; height: 16px; border-radius: 50%;
  background: rgba(0, 0, 0, .35); position: absolute; }
.chess-ui .promo { display: flex; gap: 6px; }
.chess-ui .error { color: #b00020; min-height: 1.2em; }
`;
 
/** Chèn CSS đúng 1 lần (HTML không nạp CSS riêng cho UI). */
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}
 
/**
 * Gắn UI vào container. Trả về hàm hủy.
 * @param {HTMLElement} container Phần tử chứa (#ui-host).
 * @param {any} controller Controller do create() trả về. TODO: thay `any` bằng type thật.
 * @returns {() => void} Hàm unmount.
 */
export function mount(container, controller) {
  injectStyle();
 
  // Enum lấy qua controller, UI không cần import code game.
  const { Side, PieceType } = controller.enums;
  const GLYPHS = {
    [PieceType.KING]: { [Side.WHITE]: "♔", [Side.BLACK]: "♚" },
    [PieceType.QUEEN]: { [Side.WHITE]: "♕", [Side.BLACK]: "♛" },
    [PieceType.ROOK]: { [Side.WHITE]: "♖", [Side.BLACK]: "♜" },
    [PieceType.BISHOP]: { [Side.WHITE]: "♗", [Side.BLACK]: "♝" },
    [PieceType.KNIGHT]: { [Side.WHITE]: "♘", [Side.BLACK]: "♞" },
    [PieceType.PAWN]: { [Side.WHITE]: "♙", [Side.BLACK]: "♟" },
  };
 
  // ── Dựng khung 1 lần ──
  const root = document.createElement("div");
  root.className = "chess-ui";
  const status = document.createElement("div");
  const board = document.createElement("div");
  board.className = "board";
  const promo = document.createElement("div");
  promo.className = "promo";
  const error = document.createElement("div");
  error.className = "error";
  root.append(status, board, promo, error);
  container.replaceChildren(root);
 
  // ── Vẽ: đọc view rồi cập nhật DOM ──
  /** @type {any} */
  let lastView = null;
  const render = () => {
    const view = controller.getView();
    if (view === lastView) return; // cùng tham chiếu = không có gì đổi
    lastView = view;
 
    status.textContent = view.result
      ? "Ván đã kết thúc" // TODO: hiển thị theo shape thật của view.result
      : `Lượt: ${view.turn}`;
 
    board.classList.toggle("locked", !view.canAct);
    board.style.gridTemplateColumns = `repeat(${view.cols}, auto)`;
 
    /** @type {Map<string, any>} */
    const byPos = new Map(view.pieces.map((/** @type {any} */ p) => [`${p.row},${p.col}`, p]));
    // TODO: đoán targets là mảng {row, col}
    const targets = new Set(view.targets.map((/** @type {any} */ t) => `${t.row},${t.col}`));
 
    const squares = [];
    for (let row = 0; row < view.rows; row++) {
      for (let col = 0; col < view.cols; col++) {
        const key = `${row},${col}`;
        const piece = byPos.get(key);
        const sq = document.createElement("div");
        sq.className = `sq ${(row + col) % 2 ? "dark" : "light"}`;
        sq.dataset.row = String(row);
        sq.dataset.col = String(col);
        if (piece) sq.textContent = GLYPHS[piece.type][piece.side];
        if (piece && piece.id === view.selectedId) sq.classList.add("selected");
        if (targets.has(key)) sq.classList.add("target");
        // TODO: đoán checkedKing là quân vua đang bị chiếu (có row/col) hoặc null
        if (view.checkedKing && view.checkedKing.row === row && view.checkedKing.col === col) {
          sq.classList.add("check");
        }
        squares.push(sq);
      }
    }
    board.replaceChildren(...squares);
 
    // Chọn quân khi phong cấp
    const choices = view.promotion
      ? [PieceType.QUEEN, PieceType.ROOK, PieceType.BISHOP, PieceType.KNIGHT]
      : [];
    promo.replaceChildren(
      ...choices.map((type) => {
        const btn = document.createElement("button");
        btn.textContent = GLYPHS[type][view.turn] ?? type;
        btn.dataset.promote = type;
        return btn;
      }),
    );
  };
 
  // ── Người dùng thao tác -> chỉ gọi actions, KHÔNG tự đổi DOM ──
  board.addEventListener("click", (e) => {
    const sq = e.target instanceof Element ? e.target.closest(".sq") : null;
    if (!(sq instanceof HTMLElement) || !controller.getView().canAct) return;
    // TODO: đổi theo tên action thật
    controller.actions.clickSquare(Number(sq.dataset.row), Number(sq.dataset.col));
  });
  promo.addEventListener("click", (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest("button") : null;
    if (btn) controller.actions.promote(btn.dataset.promote); // TODO: đổi theo tên action thật
  });
 
  // ── Lắng nghe controller ──
  let errorTimer = 0;
  const offs = [
    controller.subscribe(render), // controller đổi -> UI tự vẽ lại
    controller.onError((/** @type {any} */ err) => {
      error.textContent = String(err?.message ?? err);
      clearTimeout(errorTimer);
      errorTimer = window.setTimeout(() => (error.textContent = ""), 3000);
    }),
  ];
  render(); // vẽ lần đầu
 
  // ── Dọn dẹp: gỡ listener + xóa DOM. Không gọi controller.destroy() (của nơi tạo ra controller) ──
  return function unmount() {
    offs.forEach((off) => off());
    clearTimeout(errorTimer);
    container.replaceChildren();
  };
}