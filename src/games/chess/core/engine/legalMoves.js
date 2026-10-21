/**
 * @file legalMoves.js
 * @author tuanca
 */

// Nước đi hợp lệ: chạy đúng các rule mà reduce dùng, nên "hợp lệ ở đây" và "reduce chấp nhận"
// luôn khớp nhau. Chỉ đọc, không đổi state. UI và bot import các hàm ở file này.

import { MoveKind } from "../constants/MoveKind.js";
import { PieceType } from "../constants/PieceType.js";
import { buildMoveInput, classifyMove } from "./moveInput.js";
import { RULES_BY_KIND, ruleSet } from "./ruleset.js";
import { movementSquares } from "./squares.js";

/**
 * @typedef {import("../models/Piece.js").Piece} Piece
 * @typedef {import("../models/Game.js").Game} Game
 * @typedef {import("../models/Board.js").Board} Board
 */

/**
 * Kiểm tra tất cả rule được chỉ định đều đạt yêu cầu với dữ liệu đầu vào.
 *
 * Dừng ngay khi có rule không đạt. Nếu một key không tồn tại trong `ruleSet`,
 * việc gọi `test()` sẽ gây lỗi; cần bảo đảm các rule đã được đăng ký đầy đủ.
 *
 * @param {string[]} keys - Danh sách key của các rule cần kiểm tra.
 * @param {Record<string, unknown>} input - Dữ liệu đầu vào cho các rule.
 * @returns {boolean} `true` nếu tất cả rule đều đạt, ngược lại là `false`.
 */
const passes = (keys, input) =>
  keys.every((key) => ruleSet.get(key).test(input));

/**
 * Tạo danh sách các ô đích ứng viên cho một quân cờ.
 *
 * Bao gồm các ô đi theo quy tắc di chuyển thông thường, các ô đích nhập
 * thành của vua và ô đích bắt tốt qua đường của tốt khi có thể áp dụng.
 * Đây chỉ là tập hợp ứng viên; tính hợp lệ thực tế của từng nước đi
 * được xác định bởi hệ thống rule.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần tìm các ô đích ứng viên.
 * @returns {{ row: number, col: number }[]} Danh sách tọa độ các ô đích ứng viên.
 */
function candidateSquares(game, piece) {
  const board = game.board;
  const seen = new Set();
  /** @type {{ row: number, col: number }[]} */
  const out = [];
  /**
   * Thêm ô vào danh sách nếu ô nằm trong bàn và chưa được thêm.
   *
   * @param {number} row
   * @param {number} col
   * @returns {void}
   */
  const add = (row, col) => {
    const key = `${row},${col}`;
    if (seen.has(key) || !board.inBounds(row, col)) return;
    seen.add(key);
    out.push({ row, col });
  };

  for (const sq of movementSquares(board, piece)) add(sq.row, sq.col);
  if (piece.type === PieceType.KING) {
    add(piece.row, piece.col - 2);
    add(piece.row, piece.col + 2);
  }
  if (piece.type === PieceType.PAWN && game.enPassantTarget !== null)
    add(game.enPassantTarget.row, game.enPassantTarget.col);
  return out;
}

/**
 * Sinh lần lượt các nước đi hợp lệ của một quân cờ trong trạng thái game hiện tại.
 *
 * Duyệt các ô đích ứng viên, phân loại từng nước đi và dùng hệ thống rule
 * để kiểm tra tính hợp lệ. Dùng generator để mỗi nước đi được trả về khi
 * cần, thay vì tạo toàn bộ danh sách cùng lúc.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @param {Piece} piece - Quân cờ cần tìm nước đi hợp lệ.
 * @yields {Action} Mỗi hành động di chuyển hợp lệ của quân cờ.
 */
function* iterateLegalMoves(game, piece) {
  for (const { row, col } of candidateSquares(game, piece)) {
    const kind = classifyMove(game, piece, row, col);
    if (
      passes(RULES_BY_KIND[kind], buildMoveInput(game, piece, row, col, kind))
    )
      yield { row, col, kind };
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
 * @returns {{ row: number, col: number, kind: typeof MoveKind[keyof typeof MoveKind] }[]}
 * Danh sách nước đi hợp lệ, mỗi phần tử gồm tọa độ đích và loại nước đi.
 */
export function getLegalMoves(game, piece) {
  return [...iterateLegalMoves(game, piece)];
}

/**
 * Lấy toàn bộ nước đi hợp lệ của bên đang tới lượt.
 *
 * Duyệt các quân thuộc bên đang tới lượt và tổng hợp những nước đi
 * hợp lệ của từng quân. Mỗi nước đi bao gồm ID quân cờ, tọa độ đích
 * và loại nước đi.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @returns {{ id: string, row: number, col: number, kind: typeof MoveKind[keyof typeof MoveKind] }[]}
 * Danh sách toàn bộ nước đi hợp lệ của bên đang tới lượt.
 */
export function getAllLegalMoves(game) {
  return game.board.pieces
    .filter((p) => p.side === game.turn)
    .flatMap((p) => getLegalMoves(game, p).map((m) => ({ id: p.id, ...m })));
}

/**
 * Kiểm tra bên đang tới lượt có còn nước đi hợp lệ hay không.
 *
 * Dừng ngay khi tìm thấy nước đi hợp lệ đầu tiên, không cần duyệt hết
 * các nước đi có thể có.
 *
 * @param {Game} game - Trạng thái ván cờ hiện tại.
 * @returns {boolean} `true` nếu còn ít nhất một nước đi hợp lệ, ngược lại là `false`.
 */
export function hasLegalMove(game) {
  for (const piece of game.board.pieces) {
    if (piece.side !== game.turn) continue;
    if (!iterateLegalMoves(game, piece).next().done) return true;
  }
  return false;
}
