/**
 * @file index.js
 * @author tuanca
 */

// Cửa duy nhất của plugin cờ vua: App chỉ import file này.
// Chỉ export những gì App cần. core/, bot/, ui/ không import ngược lại file này.

import { Room } from "./core/engine/room.js";
import { reduce } from "./core/engine/reduce.js";

// Mỗi lần gọi tạo một room mới, độc lập với các room khác.
// Nút "bắt đầu" gọi hàm này, nút "ván mới" gọi room.restart().
export function createRoom() {
  return new Room(reduce);
}

// Mô tả game để App liệt kê trong menu. Component sẽ thêm vào ở A6 khi có ui/.
export const chess = Object.freeze({
  id: "chess",
  name: "Cờ vua",
  createRoom,
});

export default chess;