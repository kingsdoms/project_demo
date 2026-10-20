/**
 * @file room.js
 * @author tuanca
 */

// Giữ state (Game hiện tại), nhận action, báo cho người đăng ký.
// Room không biết luật cờ: luật nằm trong hàm reduce(game, action) được truyền vào từ ngoài.
//
// room.dispatch(action)
//   1. Kiểm tra room còn sống và action đúng kiểu Action
//   2. next = reduce(game hiện tại, action)
//      reduce ném GameError nếu sai luật, khi đó dòng gán state bên dưới không chạy
//      nên state giữ nguyên và không ai được báo
//   3. Gán state = next, báo cho các hàm đã subscribe
//
// State chỉ đổi qua dispatch và restart. Kết quả ván nằm trong game.result do reduce ghi.
import { Game } from "../models/Game.js";
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";

import { reduce } from "./reduce.js";

export class Room {
  #game;
  #reduce;
  #listeners = new Set();
  #alive = true;

  constructor() {
    this.#reduce = reduce;
    this.#game = Game.initialStandard();
  }

  getState() {
    return this.#game;
  }

  /**
 * Phân phối action để cập nhật trạng thái game.
 *
 * @param {import("../models/Action.js").Action} action - Hành động cần thực hiện.
 */
  dispatch(action) {
    this.#assertAlive();
    const next = this.#reduce(this.#game, action);
    if (!(next instanceof Game))
      throw new GameError(
        ErrorCode.INVALID_ARGUMENT,
        "reduce phải trả về Game",
      );
    this.#game = next;
    this.#notify();
  }

  /**
 * Đăng ký hàm lắng nghe khi trạng thái game thay đổi.
 *
 * @param {() => void} fn - Hàm được gọi khi có cập nhật.
 * @returns {() => void} Hàm dùng để hủy đăng ký lắng nghe.
 */
  subscribe(fn) {
    this.#assertAlive();
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  restart() {
    this.#assertAlive();
    this.#game = Game.initialStandard();
    this.#notify();
  }

  destroy() {
    this.#alive = false;
    this.#listeners.clear();
  }

  // Một listener ném lỗi không được làm dispatch thất bại (state đã đổi rồi)
  // và không được chặn các listener còn lại.
  #notify() {
    for (const fn of [...this.#listeners]) {
      try {
        fn(this.#game);
      } catch (error) {
        console.error("Room: listener ném lỗi", error);
      }
    }
  }

  #assertAlive() {
    if (!this.#alive)
      throw new GameError(ErrorCode.INVALID_ARGUMENT, "Room đã bị destroy");
  }
}
