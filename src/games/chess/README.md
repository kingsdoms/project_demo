# Cờ vua (`src/games/chess`)

Plugin cờ vua cho App: chơi với bot trên trình duyệt, đủ luật cơ bản (đi quân, ăn quân, chiếu, chiếu hết, hết nước, hòa thiếu quân, nhập thành, phong cấp, bắt tốt qua đường). Không online, không lưu ván.

Phần lõi (`core/`) đã xong và có test chạy bằng node. Bot và giao diện chưa làm.

## Trạng thái

| Mốc | Nội dung | Trạng thái |
| --- | --- | --- |
| A1 | constants và model | Xong |
| A2 | nước đi cơ bản, chiếu, chiếu hết, hết nước, hòa thiếu quân | Xong |
| A3 | nhập thành, phong cấp, bắt tốt qua đường | Xong |
| A4 | action, room, compose, reduce, `index.js` | Xong |
| A5 | bot | Chưa làm |
| A6 | UI và hoạt ảnh | Chưa làm |
| A7 | hoàn thiện | Chưa làm |

Chi tiết từng mốc và điều kiện «Xong khi» nằm trong plan (`05-planning-sum-ver-1.2.md`).

## Dùng nhanh

App chỉ import `index.js`:

```js
import chess from "./games/chess/index.js";

const room = chess.createRoom(); // mỗi lần gọi là một room mới, độc lập
```

`bot/` và `ui/` nhận `room` từ App, không import `index.js` (tránh vòng import). Chúng đọc dữ liệu qua room và các hàm đọc luật ở `engine/moveFacts.js`:

```js
import { Action } from "../core/models/Action.js";
import { PieceType } from "../core/constants/PieceType.js";
import { getLegalMoves, isInCheck } from "../core/engine/moveFacts.js";

const game = room.getState();
const piece = game.board.pieceAt(6, 4);        // tốt e2 (hàng 6, cột 4)
const moves = getLegalMoves(game, piece);      // [{ row, col, kind }]

room.dispatch(Action.move(piece.id, 4, 4));    // e2-e4, sai luật thì ném GameError
room.dispatch(Action.promote(id, PieceType.QUEEN)); // chọn quân khi tốt tới hàng cuối
```

### Interface của room

| Hàm | Việc |
| --- | --- |
| `dispatch(action)` | Gửi `Action.move(id, row, col)` hoặc `Action.promote(id, pieceType)`. Sai luật thì ném `GameError`, state không đổi |
| `getState()` | Trả về `Game` hiện tại |
| `subscribe(fn)` | Đăng ký nhận state mới sau mỗi thay đổi, trả về hàm hủy đăng ký |
| `restart()` | Về thế ban đầu |
| `destroy()` | Hủy room. Sau đó mọi thao tác ngoài `getState` đều bị từ chối |

### Dữ liệu `Game`

| Trường | Ý nghĩa |
| --- | --- |
| `board` | Bàn cờ (8x8) và danh sách quân |
| `turn` | Phe đang tới lượt |
| `enPassantTarget` | `{ row, col }` ô vừa bị tốt bỏ qua, hoặc `null`. Chỉ sống một lượt |
| `pendingPromotion` | `id` của tốt đang chờ phong cấp, hoặc `null` |
| `result` | `null` khi ván còn tiếp tục, hoặc `{ type, winner }` |

`result.type` là `"checkmate"`, `"stalemate"` hoặc `"insufficientMaterial"`. `result.winner` là phe thắng khi chiếu hết, còn lại là `null`.

Quy ước: hàng 0 là phía đen, hàng 7 là phía trắng, trắng đi về hàng 0. Ô `e2` là `{ row: 6, col: 4 }`.

## Chạy test

Chạy từ thư mục `src/games/chess`. Test dùng `node:assert`, không cần cài thêm gì:

```
node tests/applyMove.test.js
node tests/moveFacts.test.js
node tests/reduce.test.js
node tests/index.test.js
```

`PERFT_DEEP=1 node tests/moveFacts.test.js` chạy perft sâu hơn (chậm hơn, cỡ một phút). `room-test.html` là trang kiểm tra thủ công, cần mở bằng dev server vì ES module không chạy qua `file://`. Xem `docs/testing.md`.

## Cấu trúc thư mục

```
src/games/chess/
├── index.js                  cửa duy nhất của plugin
├── room-test.html            trang test thủ công cho room
├── bot/                      (A5)
├── ui/                       (A6)
├── extensions/               để trống ở v1.2
├── core/
│   ├── constants/            ActionType, CaptureMode, ErrorCode, MoveKind, PieceDefs,
│   │                         PieceMoveDefs, PieceType, Side, StandardDef
│   ├── models/               Action, Board, Game, Piece, Rule, RuleSet
│   ├── rules/                boardRules, gameRules, outcomeRules, pieceRules
│   ├── engine/               compose, applyMove, moveFacts, reduce, room
│   └── scaffold              chưa rõ vai trò, không sửa (xem plan mục 8)
├── tests/                    applyMove, moveFacts, reduce, index và helpers.js
└── utils/                    GameError, validation, dev-note.md (ghi chú riêng, không sửa)
```

## Tài liệu

| File | Nội dung |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Phân lớp, hướng import, luồng `dispatch`, quy ước dữ liệu, cách thêm luật |
| [`docs/rules.md`](docs/rules.md) | Từng rule cần input nào, input được tính ở đâu, rule nào chạy cho loại nước đi nào |
| [`docs/testing.md`](docs/testing.md) | Các file test, perft, cách thêm test |
| `05-planning-sum-ver-1.2.md` | Plan dành cho AI viết code |