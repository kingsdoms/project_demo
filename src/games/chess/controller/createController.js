/**
 * @file createController.js
 * @author tuanca
 */

import { Action } from "../core/models/Action.js";
import { GameError } from "../utils/GameError.js";
import { EMPTY, click, syncInteraction } from "./interaction.js";
import { toView } from "./toview.js";
import { MoveKind } from "../core/constants/MoveKind.js";
import { PieceType } from "../core/constants/PieceType.js";
import { findMove } from "../core/moves/index.js";
/**
 * @typedef {import("../core/engine/room.js").Room} Room
 * @typedef {import("../core/constants/Side.js").SideValue} SideValue
 * @typedef {import("../core/models/Game.js").Game} Game
 * @typedef {Readonly<{
 *   selectedId: string | null
 * }>} Interaction
 * @typedef {import("./toview.js").HistoryEntry} HistoryEntry
 */

/** @type {readonly HistoryEntry[]} */
const EMPTY_HISTORY = Object.freeze([]);

/**
 * A move preserves every untouched Piece object, even though a moved piece's ID
 * changes. A restart builds a fresh board with no moved pieces.
 * @param {Game} before
 * @param {Game} after
 * @param {readonly HistoryEntry[]} history
 */
function updateHistory(before, after, history) {
  if (before.board === after.board) return history;

  const { pieces: oldPieces } = before.board;
  const { pieces: newPieces } = after.board;
  const oldSet = new Set(oldPieces);
  const arrived = newPieces.filter((piece) => !oldSet.has(piece));
  if (!arrived.some((piece) => piece.hasMoved)) return EMPTY_HISTORY;

  if (before.pendingPromotion !== null) {
    const pawn = before.board.pieceById(before.pendingPromotion);
    const latest = history.at(-1);
    if (
      !pawn || !latest || latest.to.row !== pawn.row || latest.to.col !== pawn.col
    ) return history;

    const promoted = after.board.pieceAt(pawn.row, pawn.col);
    if (!promoted) return history;

    return Object.freeze([
      ...history.slice(0, -1),
      Object.freeze({ ...latest, promotion: promoted.type }),
    ]);
  }

  // Castling moves two pieces; the king is the move's source and destination.
  const to = arrived.length === 2
    ? arrived.find((piece) => piece.type === PieceType.KING)
    : arrived[0];
  if (!to) return history;

  const newSet = new Set(newPieces);
  const from = oldPieces.find(
    (piece) => piece.side === before.turn && piece.type === to.type && !newSet.has(piece),
  );
  if (!from) return history;

  return Object.freeze([...history, Object.freeze({
    side: from.side,
    from: Object.freeze({ row: from.row, col: from.col }),
    to: Object.freeze({ row: to.row, col: to.col }),
    pieceType: from.type,
    promotion: null,
    kind: findMove(before, from, to.row, to.col)?.kind ?? MoveKind.NORMAL,
    capture: newPieces.length < oldPieces.length,
  })]);
}

/**
 * controller phục vụ UI,
 * Tạo controller để điều phối tương tác với phòng chơi.
 *
 * @param {object} options
 * @param {Room} options.room - Phòng chơi mà controller quản lý.
 * @param {SideValue[]} options.sides - Các bên được điều khiển bởi người chơi.
 * @param {() => void} [options.dispose=() => {}] - Hàm dọn dẹp tài nguyên khi controller kết thúc.
 */
export function createController({ room, sides, dispose = () => {} }) {
  const listeners = new Set();
  const errorListeners = new Set();
  const ctx = {
    canAct: (/** @type {Game} game */ game) =>
      game.result == null && sides.includes(game.turn),
  };

  let alive = true;
  let ix = EMPTY;
  let history = EMPTY_HISTORY;
  /** @type {any} */ let view = null;
  /** @type {Game | null} */ let seenGame = null;
  /** @type {Interaction | null} */ let seenIx = null;

  /**
   * Phát sự kiện đến tất cả listeners đã đăng ký.
   * Listener bị lỗi sẽ không ảnh hưởng đến các listener còn lại.
   *
   * @param {Set<Function>} set - Tập hợp các listeners.
   * @param {...any} args - Các đối số truyền vào mỗi listener.
   * @returns {void}
   */
  const emit = (set, ...args) => {
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (e) {
        console.error(e); // một listener lỗi không làm hỏng các listener khác
      }
    }
  };

  // Idempotent: gọi bao nhiêu lần cũng được, chỉ dựng view và báo khi game hoặc ix đổi.
  function refresh() {
    if (!alive) return;
    const game = room.getState();
    if (seenGame && game !== seenGame) {
      history = updateHistory(seenGame, game, history);
      if (history === EMPTY_HISTORY) ix = EMPTY;
    }
    ix = syncInteraction(ix, game);
    if (game === seenGame && ix === seenIx) return;
    seenGame = game;
    seenIx = ix;
    view = toView(game, ix, ctx.canAct, history);
    emit(listeners);
  }

  /**
   * Gửi action và trả về kết quả dispatch.
   * Action không hợp lệ (GameError) sẽ được thông báo qua onError,
   * không ném exception ra ngoài.
   *
   * @param {Action} action - Action cần dispatch.
   * @returns {boolean} true nếu dispatch thành công, ngược lại false.
   */
  function send(action) {
    try {
      room.dispatch(action);
      return true;
    } catch (e) {
      if (!(e instanceof GameError)) throw e;
      emit(errorListeners, e);
      return false;
    }
  }

  const unsubscribeRoom = room.subscribe(refresh); // đăng ký khi game thay đổi tự gọi hàm refresh và trả về hàm hủy đăng ký
  refresh();

  const actions = Object.freeze({
    /**
     * @param {number} row
     * @param {number} col
     */
    clickSquare(row, col) {
      if (!alive) return;
      const game = room.getState();
      if (!ctx.canAct(game)) return;
      const res = click(ix, game, { row, col });
      ix = res.ix;
      if (res.intent)
        send(Action.move(res.intent.id, res.intent.row, res.intent.col));

      refresh();
    },

    /**
     * @param {any} pieceType
     */
    promote(pieceType) {
      if (!alive) return;
      const game = room.getState();
      if (game.pendingPromotion == null || !ctx.canAct(game)) return;
      send(Action.promote(pieceType));
      refresh();
    },

    restart() {
      if (!alive) return;
      ix = EMPTY; // id quân giữ nguyên qua ván mới, phải xóa lựa chọn thủ công
      room.restart();
      refresh();
    },
  });

  return Object.freeze({
    getView: () => view, // cùng tham chiếu cho tới khi game hoặc lựa chọn đổi

    subscribe(/** @type {Function} */ fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onError(/** @type {Function} */ fn) {
      errorListeners.add(fn);
      return () => errorListeners.delete(fn);
    },
    actions,
    destroy() {
      if (!alive) return;
      alive = false;
      unsubscribeRoom();
      listeners.clear();
      errorListeners.clear();
      dispose();
    },
  });
}
