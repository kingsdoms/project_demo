/**
 * @file attachBot.js
 * @author tuanca
 */

import { chooseBotAction } from "./simpleBot.js";

/**
 * @typedef {import("./index.js").Bot} Bot
 */

// ====== Chỗ duy nhất phụ thuộc API của Room, sửa ở đây nếu tên khác ======
const getGame = (/** @type {any} */ room) => room.getState();
const listen = (/** @type {any} */ room, /** @type {() => void} */ fn) =>
  room.subscribe(fn); // phải trả về hàm hủy đăng ký
const act = (/** @type {any} */ room, /** @type {string} */ _side, /** @type {any} */ action) =>
  room.dispatch(action);
// ========================================================================

/**
 * Gắn bot vào room: tới lượt bên nào thuộc `sides` thì chờ `delay` ms rồi đi.
 *
 * @param {any} room
 * @param {{ sides: string[], delay?: number, choose?: Bot }} options
 * @returns {{ stop: () => void }}
 */
export function attachBot(room, { sides, delay = 500, choose = chooseBotAction }) {
  const botSides = new Set(sides);
  let stopped = false;
  let busy = false; // đang trong step, chặn lên lịch chồng
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  const isBotTurn = () => {
    const game = getGame(room);
    return game.result === null && botSides.has(game.turn);
  };

  function schedule() {
    if (stopped || busy || timer !== null || !isBotTurn()) return;
    timer = setTimeout(step, delay);
  }

  async function step() {
    timer = null;
    if (stopped || !isBotTurn()) return;
    busy = true;
    try {
      // vòng lặp để xử lý phong cấp: move xong còn pendingPromotion thì chọn quân ngay,
      // không qua delay để người chơi không kịp thấy trạng thái dở dang
      do {
        const game = getGame(room);
        const side = game.turn;
        const action = await choose(game);

        // sau await, ván có thể đã bị hủy hoặc đổi trạng thái
        if (stopped || !isBotTurn() || getGame(room) !== game) return;
        if (action === null) return;

        act(room, side, action);
      } while (!stopped && getGame(room).pendingPromotion !== null && isBotTurn());
    } catch (err) {
      console.error("[bot] lỗi khi đi nước:", err);
      return; // không lên lịch lại, tránh lặp vô hạn với nước đi lỗi
    } finally {
      busy = false;
    }
    schedule(); // bot đấu bot, hoặc tới lượt bot tiếp
  }

  const unlisten = listen(room, schedule);
  schedule(); // bot cầm bên đi trước: lượt đầu đã thuộc bot ngay từ đầu

  return {
    stop() {
      if (stopped) return; // an toàn khi gọi hai lần
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      unlisten?.();
    },
  };
}