// ui/useRoom.js
// Tạo một Room cho mỗi lần component xuất hiện và đọc state của nó qua useSyncExternalStore.
import { useState, useSyncExternalStore } from "react";
import { Room } from "../core/engine/room.js";

export function useRoom() {
  // Khởi tạo một lần. StrictMode gọi initializer hai lần ở dev, nhưng chỉ dùng kết quả của một lần.
  const [room] = useState(() => new Room());

  // Phải bọc bằng arrow: Room dùng private field (#game, #listeners),
  // nên truyền room.subscribe / room.getState trực tiếp sẽ mất `this` và ném TypeError.
  const game = useSyncExternalStore(
    (onChange) => room.subscribe(onChange),
    () => room.getState(),
  );

  return { room, game };
}