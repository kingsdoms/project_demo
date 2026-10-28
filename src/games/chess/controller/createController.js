/**
 * @file createController.js
 * @author tuanca
 */

import { Action } from "../core/models/Action.js";
import { GameError } from "../utils/GameError.js";
import { EMPTY, click, syncInteraction } from "./interaction.js";
import { toView } from "./toview.js";
import { Room } from "../core/engine/room.js";
import { Side } from "../core/constants/Side.js";
import { Game } from "../core/models/Game.js";
/**
 * @typedef {Readonly<{
 *   selectedId: string | null
 * }>} Interaction
 */

/**
 * controller phục vụ UI,
 * Tạo controller để điều phối tương tác với phòng chơi.
 *
 * @param {object} options
 * @param {Room} options.room - Phòng chơi mà controller quản lý.
 * @param {typeof Side[keyof typeof Side][]} options.sides - Các bên được điều khiển bởi người chơi.
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
    ix = syncInteraction(ix, game);
    if (game === seenGame && ix === seenIx) return;
    seenGame = game;
    seenIx = ix;
    view = toView(game, ix, ctx.canAct);
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
