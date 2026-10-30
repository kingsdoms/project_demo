/**
 * @file legalMoves.js
 * @author tuanca
 */

// Nước đi hợp lệ: chạy đúng `validate` mà reduce dùng, nên "hợp lệ ở đây" và
// "reduce chấp nhận" luôn khớp nhau. Chỉ đọc, không đổi state.
// UI và bot import các hàm ở file này.

import { MOVES, findMove, validate } from "../moves/index.js";

/**
 * @typedef {import("../models/Piece.js").Piece} Piece
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../moves/index.js").Move} Move
 * @typedef {import("../moves/index.js").Position} Position
 * @typedef {import("../constants/MoveKind.js").MoveKindValue} MoveKindValue
 */

/**
 * Một nước đi hợp lệ của một quân.
 *
 * @typedef {Object} LegalMove
 * @property {number} row - Hàng của ô đích.
 * @property {number} col - Cột của ô đích.
 * @property {MoveKindValue} kind - Loại nước đi.
 */

/**
 * Một nước đi hợp lệ kèm id quân thực hiện.
 *
 * @typedef {LegalMove & { id: string }} LegalMoveWithId
 */

/**
 * Gom các ô đích ứng viên của một quân từ `candidates` của từng loại nước đi,
 * bỏ ô trùng và ô nằm ngoài bàn.
 *
 * Đây chỉ là tập ứng viên; tính hợp lệ thực tế của từng nước đi được xác định
 * bởi `validate`.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần tìm các ô đích ứng viên.
 * @param {Move[]} moves - Bộ nước đi được sử dụng.
 * @returns {Position[]} Danh sách tọa độ các ô đích ứng viên, không trùng.
 */
function candidateSquares(game, piece, moves) {
  const board = game.board;
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Position[]} */
  const out = [];

  for (const move of moves) {
    for (const { row, col } of move.candidates(game, piece)) {
      const key = `${row},${col}`;
      if (seen.has(key) || !board.inBounds(row, col)) continue;
      seen.add(key);
      out.push({ row, col });
    }
  }
  return out;
}

/**
 * Sinh lần lượt các nước đi hợp lệ của một quân cờ trong trạng thái game hiện tại.
 *
 * Với mỗi ô ứng viên: tìm loại nước đi khớp bằng `findMove`, rồi xác thực bằng
 * `validate` (check chung trước, check riêng của loại nước đi sau). Dùng
 * generator để mỗi nước đi được trả về khi cần, thay vì tạo toàn bộ danh sách.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần tìm nước đi hợp lệ.
 * @param {Move[]} moves - Bộ nước đi được sử dụng.
 * @returns {Generator<LegalMove, void, undefined>} Mỗi nước đi hợp lệ của quân cờ.
 */
function* iterateLegalMoves(game, piece, moves) {
  for (const { row, col } of candidateSquares(game, piece, moves)) {
    const move = findMove(game, piece, row, col, moves);
    if (move !== undefined && validate(move, game, piece, row, col) === null)
      yield { row, col, kind: move.kind };
  }
}

/**
 * Lấy danh sách các nước đi hợp lệ của một quân cờ.
 *
 * Trả về danh sách rỗng nếu không đến lượt bên sở hữu quân cờ,
 * ván đấu đã kết thúc hoặc game đang chờ phong cấp.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần lấy các nước đi hợp lệ.
 * @param {Move[]} [moves=MOVES] - Bộ nước đi được sử dụng.
 * @returns {LegalMove[]} Danh sách nước đi hợp lệ, mỗi phần tử gồm tọa độ đích và loại nước đi.
 */
export function getLegalMoves(game, piece, moves = MOVES) {
  return [...iterateLegalMoves(game, piece, moves)];
}

/**
 * Lấy toàn bộ nước đi hợp lệ của bên đang tới lượt.
 *
 * Duyệt các quân thuộc bên đang tới lượt và tổng hợp những nước đi
 * hợp lệ của từng quân. Mỗi nước đi bao gồm id quân cờ, tọa độ đích
 * và loại nước đi.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Move[]} [moves=MOVES] - Bộ nước đi được sử dụng.
 * @returns {LegalMoveWithId[]} Danh sách toàn bộ nước đi hợp lệ của bên đang tới lượt.
 */
export function getAllLegalMoves(game, moves = MOVES) {
  return game.board.pieces
    .filter((p) => p.side === game.turn)
    .flatMap((p) =>
      getLegalMoves(game, p, moves).map((m) => ({ id: p.id, ...m })),
    );
}

/**
 * Kiểm tra bên đang tới lượt có còn nước đi hợp lệ hay không.
 *
 * Dừng ngay khi tìm thấy nước đi hợp lệ đầu tiên, không cần duyệt hết
 * các nước đi có thể có.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Move[]} [moves=MOVES] - Bộ nước đi được sử dụng.
 * @returns {boolean} `true` nếu còn ít nhất một nước đi hợp lệ, ngược lại là `false`.
 */
export function hasLegalMove(game, moves = MOVES) {
  for (const piece of game.board.pieces) {
    if (piece.side !== game.turn) continue;
    if (!iterateLegalMoves(game, piece, moves).next().done) return true;
  }
  return false;
}