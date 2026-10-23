// @ts-nocheck
/**
 * @file Createcontroller.js
 * @author tuanca
 */

import { Action } from "../core/models/Action.js";
import { GameError } from "../utils/GameError.js";
import { getLegalMoves } from "../core/engine/legalMoves.js";
import { EMPTY,click, syncInteraction } from "./interaction.js";
import { toView } from "./toview.js";
import { Room } from "../core/engine/room.js";
import { PROMOTION_TARGETS } from "../core/constants/StandardDef.js";
import { Side } from "../core/constants/Side.js";

/**
 * controller phục vụ UI,
 * Tạo controller để điều phối tương tác với phòng chơi.
 *
 * @param {object} options
 * @param {Room} options.room - Phòng chơi mà controller quản lý.
 * @param {Side[]} options.humanSides - Các bên được điều khiển bởi người chơi.
 * @param {() => void} [options.dispose=() => {}] - Hàm dọn dẹp tài nguyên khi controller kết thúc.
 */
export function createController({ room, humanSides, dispose = () => {} }) {
  const sides = new Set(humanSides);
  const listeners = new Set();
  const errorListeners = new Set();
  const ctx = {
    getLegalMoves,
    PROMOTION_TARGETS,
    canAct: (game) => game.result == null && sides.has(game.turn),
  };

  let alive = true;
  let ix = EMPTY;
  let view = null;
  let seenGame = null;
  let seenIx = null;

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
    view = toView(game, ix, ctx);
    emit(listeners);
  }

  // Trả true nếu dispatch thành công. Action sai (GameError) thì báo qua onError, không ném ra ngoài.
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

  const stopRoom = room.subscribe(refresh); // bot đi, restart từ nơi khác... đều về đây
  refresh();

  const actions = Object.freeze({
    clickSquare(row, col) {
      if (!alive) return;
      const game = room.getState();
      if (!ctx.canAct(game)) return;
      const res = click(ix, game, { row, col }, legalTargets);
      ix = res.ix;
      if (res.intent)
        send(Action.move(res.intent.id, res.intent.row, res.intent.col));
      refresh();
    },

    promote(pieceType) {
      if (!alive) return;
      const game = room.getState();
      if (game.pendingPromotion == null || !ctx.canAct(game)) return;
      send(Action.promote(game.pendingPromotion, pieceType));
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
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onError(fn) {
      errorListeners.add(fn);
      return () => errorListeners.delete(fn);
    },
    actions,
    destroy() {
      if (!alive) return;
      alive = false;
      stopRoom();
      listeners.clear();
      errorListeners.clear();
      dispose();
    },
  });
}
