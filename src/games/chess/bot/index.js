/**
 * @file bot/index.js
 * @author tuanca
 */

/**
 * @typedef {import("../core/models/Game.js").Game} Game
 * @typedef {import("../core/models/Action.js").Action} Action
 */

/**
 * Hợp đồng của bot: nhận ván, trả hành động cho bên đang tới lượt,
 * hoặc null khi không có gì để làm (hết ván, hết nước đi).
 * Bot đồng bộ hay bất đồng bộ đều được, nơi gọi chỉ cần `await`.
 *
 * Lưu ý: bot không biết mình cầm bên nào, controller phải kiểm tra
 * `game.turn` trước khi gọi. Phong cấp là một lần gọi riêng: sau nước
 * `move`, khi `game.pendingPromotion` khác null thì gọi bot thêm lần nữa
 * để lấy `Action.promote(...)`.
 *
 * @typedef {(game: Game) => Action | null | Promise<Action | null>} Bot
 */

export { createSimpleBot, chooseBotAction } from "./simpleBot.js";