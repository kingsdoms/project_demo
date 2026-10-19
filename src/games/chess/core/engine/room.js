/**
 * @file Game.js
 * @author tuanca
 */
//giữ game và rules, dispatch, subscribe, restart, destroy

/*

room.dispatch(action)
  1. state = this.game hiện tại
  2. ruleSet kiểm tra: ván chưa kết thúc? có đang chờ phong cấp? nước đi hợp lệ?
     → sai thì ném GameError, state không đổi
  3. ruleSet tính Game mới (dùng game.withBoard, withTurn, ...)
  4. ruleSet tính outcome (nếu muốn lưu thì ghi vào game, không thì để UI gọi)
  5. room gán this.game = game mới, thông báo subscribe


Game là dữ liệu, rules là hàm xử lý dữ liệu, room là người cầm ruleSet và gọi
*/

import { Game } from "../models/Game.js";
import { Action } from "../models/Action.js";
import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";

export class Room {
  #game;
  #reduce;
  #listeners = new Set();
  #alive = true;

  constructor(reduce) {
    if (typeof reduce !== 'function')
      throw new GameError(ErrorCode.INVALID_ARGUMENT, 'Room cần hàm reduce');
    this.#reduce = reduce;
    this.#game = Game.initialStandard();
  }

  getState() {
    return this.#game;
  }

  dispatch(action) {
    this.#assertAlive();
    if (!(action instanceof Action))
      throw new GameError(ErrorCode.INVALID_ARGUMENT, 'action phải tạo bằng Action.move hoặc Action.promote');

    // reduce ném lỗi thì dòng gán bên dưới không chạy, nên state giữ nguyên
    const next = this.#reduce(this.#game, action);
    if (!(next instanceof Game))
      throw new GameError(ErrorCode.INVALID_ARGUMENT, 'reduce phải trả về Game');

    // console.log("CURRENT>> ",this.#game);

    this.#game = next;
    // console.log("NEXT>> ",next);
    
    this.#notify();
  }

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

  #notify() {
    for (const fn of [...this.#listeners]) fn(this.#game);
  }

  #assertAlive() {
    if (!this.#alive)
      throw new GameError(ErrorCode.INVALID_ARGUMENT, 'Room đã bị destroy');
  }
}