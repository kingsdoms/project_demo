/**
 * @file applyMove.js
 * @author tuanca
 */

// Chỉ đổi dữ liệu: nhận Game, trả Game mới, Game cũ không đổi.
// Không gọi rule và không tính kết quả ván (result do reduce ghi).
// Chỉ ném GameError khi dữ liệu không đủ để thực hiện, ví dụ nhập thành mà không có xe.
// Đó là lỗi lập trình, không phải nước đi sai luật. Sai luật do reduce chặn từ trước.
//
// id của quân cố định từ lúc khởi tạo, không đổi khi đi hay phong cấp.
// "Đi một quân" vẫn là xóa quân cũ rồi thêm quân mới (Board.remove + Board.add),
// không dùng Board.replace, để không phụ thuộc cách Piece đặt id.

import { GameError } from "../../utils/GameError.js";
import { ErrorCode } from "../constants/ErrorCode.js";
import { MoveKind } from "../constants/MoveKind.js";
import { PieceType } from "../constants/PieceType.js";
import { Side } from "../constants/Side.js";
import { PROMOTION_RANK } from "../constants/StandardDef.js";

// Phe đối diện. moveFacts dùng chung hàm này.
export const opponent = (side) => (side === Side.WHITE ? Side.BLACK : Side.WHITE);

const fail = (message) => new GameError(ErrorCode.BAD_ACTION, message);

/**
 * Áp dụng một nước đi lên game.
 * Nhận (row, col) thay vì Action để moveFacts thử nước đi mà không phải dựng Action cho từng ô.
 * Với nhập thành, (row, col) là ô đích của vua.
 * Với bắt qua đường, (row, col) là ô đích của tốt (chính là enPassantTarget).
 */
export function applyMove(game, piece, row, col, kind = MoveKind.NORMAL) {
  switch (kind) {
    case MoveKind.NORMAL:
      return applyNormal(game, piece, row, col);
    case MoveKind.CASTLE:
      return applyCastle(game, piece, row, col);
    case MoveKind.EN_PASSANT:
      return applyEnPassant(game, piece, row, col);
    default:
      throw fail(`Loại nước đi không hợp lệ: ${kind}`);
  }
}

/**
 * Hoàn tất phong cấp cho tốt đang chờ (game.pendingPromotion).
 * Việc id khớp action và quân được chọn hợp lệ là của rule PROMOTE, không kiểm tra ở đây.
 */
export function applyPromotion(game, pieceType) {
  const id = game.pendingPromotion;
  if (id === null) throw fail("Không có tốt nào đang chờ phong cấp");

  const pawn = game.board.pieceById(id);
  if (pawn === null) throw fail(`Không tìm thấy quân ${id} đang chờ phong cấp`);

  const promoted = pawn.with({ type: pieceType });
  const board = game.board.remove(id).add(promoted);

  return game
    .withBoard(board)
    .withPendingPromotion(null)
    .withTurn(opponent(pawn.side));
}

function applyNormal(game, piece, row, col) {
  let board = game.board;

  // Ăn quân: bỏ quân ở ô đích trước khi đặt quân mới vào
  const target = board.pieceAt(row, col);
  if (target !== null) board = board.remove(target.id);

  const moved = piece.with({ row, col, hasMoved: true });
  board = board.remove(piece.id).add(moved);

  const isPawn = piece.type === PieceType.PAWN;
  const doubleStep = isPawn && Math.abs(row - piece.row) === 2;
  const promotes = isPawn && row === PROMOTION_RANK[piece.side];

  return finish(game, board, piece.side, {
    // Ô bị bỏ qua nằm giữa ô xuất phát và ô đích
    enPassantTarget: doubleStep ? { row: (piece.row + row) / 2, col } : null,
    pendingPromotion: promotes ? moved.id : null,
  });
}

// Vua đi 2 cột, xe nhảy sang ô vua vừa đi qua.
// Gần: vua 4 → 6, xe 7 → 5. Xa: vua 4 → 2, xe 0 → 3.
function applyCastle(game, king, row, col) {
  if (king.type !== PieceType.KING) throw fail("Chỉ vua mới nhập thành");
  if (row !== king.row || Math.abs(col - king.col) !== 2)
    throw fail("Nhập thành: vua phải đi đúng 2 ô theo hàng ngang");

  const board = game.board;
  const dir = Math.sign(col - king.col);
  const rookCol = dir > 0 ? board.cols - 1 : 0;

  const rook = board.pieceAt(king.row, rookCol);
  if (rook === null || rook.type !== PieceType.ROOK || rook.side !== king.side)
    throw fail("Không có xe để nhập thành");

  const kingMoved = king.with({ col, hasMoved: true });
  const rookMoved = rook.with({ col: king.col + dir, hasMoved: true });

  const next = board
    .remove(king.id)
    .remove(rook.id)
    .add(kingMoved)
    .add(rookMoved);

  return finish(game, next, king.side, {
    enPassantTarget: null,
    pendingPromotion: null,
  });
}

// Tốt đi chéo vào ô trống, tốt bị bắt đứng cạnh ô xuất phát, cùng cột với ô đích
function applyEnPassant(game, pawn, row, col) {
  if (pawn.type !== PieceType.PAWN) throw fail("Chỉ tốt mới bắt qua đường");

  const victim = game.board.pieceAt(pawn.row, col);
  if (
    victim === null ||
    victim.type !== PieceType.PAWN ||
    victim.side === pawn.side
  )
    throw fail("Không có tốt đối phương để bắt qua đường");

  const moved = pawn.with({ row, col, hasMoved: true });
  const board = game.board.remove(victim.id).remove(pawn.id).add(moved);

  return finish(game, board, pawn.side, {
    enPassantTarget: null,
    pendingPromotion: null,
  });
}

// Gán các trường chung. Đang chờ phong cấp thì chưa đổi lượt.
function finish(game, board, side, { enPassantTarget, pendingPromotion }) {
  const next = game
    .withBoard(board)
    .withEnPassantTarget(enPassantTarget)
    .withPendingPromotion(pendingPromotion);
  return pendingPromotion === null ? next.withTurn(opponent(side)) : next;
}