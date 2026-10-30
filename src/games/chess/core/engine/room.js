/**
 * @file room.js
 * @author tuanca
 */

import { Game } from "../models/Game.js";
import { Action } from "../models/Action.js";
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { reduce } from "./reduce.js";

/**
 * Quản lý state của ván cờ hiện tại, nhận action và thông báo cho các subscriber
 * khi state thay đổi.
 *
 * Room không trực tiếp xử lý luật cờ vua. Luật được thực thi bởi hàm
 * reduce(game, action) (xem reduce.js).
 *
 * Luồng xử lý của room.dispatch(action):
 * 1. Kiểm tra room còn hoạt động và action đúng kiểu Action.
 * 2. Gọi reduce(game hiện tại, action) để tính state tiếp theo.
 *    - Nếu action hợp lệ, reduce trả về game mới.
 *    - Nếu action vi phạm luật, reduce ném GameError.
 *      Khi đó state không bị thay đổi và subscriber không được thông báo.
 * 3. Cập nhật state bằng game mới và thông báo cho tất cả subscriber
 *    đã đăng ký.
 *
 * State chỉ được thay đổi thông qua dispatch và restart.
 * Kết quả ván cờ được lưu trong game.result và do reduce cập nhật.
 */
export class Room {
  /** @type {Game} */
  #game;
  #reduce;
  #listeners = new Set();
  #alive = true;

  /** Tạo phòng với ván cờ chuẩn ở trạng thái ban đầu. */
  constructor() {
    this.#reduce = reduce;
    this.#game = Game.initialStandard();
  }

  /**
   * Lấy trạng thái ván cờ hiện tại.
   *
   * @returns {Game} Game hiện tại, bất biến.
   */
  getState() {
    return this.#game;
  }

  /**
   * Phân phối action để cập nhật trạng thái game.
   *
   * @param {Action} action - Hành động cần thực hiện.
   */
  dispatch(action) {
    this.#assertAlive();
    const next = this.#reduce(this.#game, action);
    this.#game = next;
    this.#notify();
  }

  /**
   * Đăng ký hàm lắng nghe khi trạng thái game thay đổi.
   *
   * @param {(game: Game) => void} fn - Hàm được gọi với game mới khi có cập nhật.
   * @returns {() => boolean} Hàm dùng để hủy đăng ký lắng nghe.
   */
  subscribe(fn) {
    this.#assertAlive();
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  /** Đặt lại ván cờ chuẩn ban đầu và thông báo cho subscriber. */
  restart() {
    this.#assertAlive();
    this.#game = Game.initialStandard();
    this.#notify();
  }

  /** Đóng phòng: xoá toàn bộ subscriber, mọi thao tác sau đó đều ném lỗi. */
  destroy() {
    this.#alive = false;
    this.#listeners.clear();
  }

  /**
   * Thông báo cho tất cả listener đã đăng ký khi state thay đổi.
   *
   * Nếu một listener ném lỗi:
   * - Không làm dispatch thất bại vì state đã được cập nhật trước đó.
   * - Không ngăn các listener còn lại tiếp tục nhận thông báo.
   *
   * Mỗi listener được xử lý độc lập để lỗi của một listener
   * không ảnh hưởng đến các listener khác.
   */
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
