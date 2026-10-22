/**
 * @file index.js
 * @author tuanca
 */

// Cửa duy nhất của plugin cờ vua: App chỉ import file này.
// core/, bot/, ui/ không import ngược lại file này.

import { createElement } from "react";
import { Room } from "./core/engine/room.js";
import { getLegalMoves } from "./core/engine/legalMoves.js";
import { isInCheck } from "./core/engine/squares.js";
import { chooseBotAction } from "./bot/simpleBot.js";
import ChessGame from "./ui/ChessGame.jsx";

// Mỗi lần gọi tạo một room mới, độc lập với các room khác.
// Nút "bắt đầu" gọi hàm này, nút "ván mới" gọi room.restart().
export function createRoom() {
  return new Room();
}

// Các hàm đọc luật mà UI cần. Khai báo ở cấp module để tham chiếu ổn định
// (ChessGame dùng getLegalMoves làm dependency của useMemo).
// squares.isInCheck nhận (board, side) còn UI gọi theo (game, side), nên bọc lại ở đây.
const engine = Object.freeze({
  getLegalMoves,
  isInCheck: (game, side) => isInCheck(game.board, side),
});

// Component sẵn dùng: App chỉ cần render <ChessScreen />.
// Dùng createElement vì file .js không chứa JSX.
export function ChessScreen(props) {
  return createElement(ChessGame, { engine, chooseBotAction, ...props });
}

// Mô tả game để App liệt kê trong menu.
export const chess = Object.freeze({
  id: "chess",
  name: "Cờ vua",
  createRoom,
  Component: ChessScreen,
});

export default chess;