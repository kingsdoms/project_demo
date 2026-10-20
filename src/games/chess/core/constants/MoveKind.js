/**
 * @file MoveKind.js
 * @author tuanca
 */

// Loại nước đi. classifyMove trả về một trong các giá trị này.
// applyMove dùng để biết đổi dữ liệu thế nào, reduce dùng để chọn danh sách rule cần check.
export const MoveKind = Object.freeze({
  NORMAL: "normal",
  CASTLE: "castle",
  EN_PASSANT: "enPassant",
});