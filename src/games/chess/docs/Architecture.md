# Kiến trúc

## Nguyên tắc

- `core/` chỉ gồm dữ liệu bất biến và hàm thuần. Test được bằng node, không cần trình duyệt.
- State chỉ đổi qua `room.dispatch` (và `room.restart`). UI và bot không sửa state trực tiếp.
- Action sai thì ném `GameError` và state không đổi.
- `core/` không biết gì về `bot/`, `ui/`, `extensions/`.
- Rule chỉ khẳng định («sự thật X phải bằng Y»). Việc tính ra các sự thật đó nằm ở `engine/`.

## Phân lớp và hướng import

```
constants, utils  ←  models  ←  rules  ←  engine  ←  index.js
```

`bot/` và `ui/` lấy dữ liệu qua room, và gọi các hàm chỉ-đọc ở `engine/` (như `legalMoves.js`, `outcome.js`). Chúng không sửa state và không import `index.js`.

| Lớp | Vai trò | Được import |
| --- | --- | --- |
| `constants/` | Hằng số và dữ liệu định nghĩa: loại quân, phe, loại action, mã lỗi, cách đi của quân, loại nước đi | Chỉ `constants/` khác |
| `utils/` | `GameError` và hàm kiểm tra dữ liệu đầu vào | Không import ai |
| `models/` | Cấu trúc dữ liệu: `Piece`, `Board`, `Game`, `Action`, `Rule`, `RuleSet`. Bất biến, không chứa luật cờ | `constants`, `utils` |
| `rules/` | Các `RuleSet` khai báo luật theo nhóm: bàn cờ, ván, kết quả, từng quân | `models`, `constants` |
| `engine/` | Tính sự thật từ thế cờ, chạy rule, đổi dữ liệu, giữ state | `rules`, `models`, `constants`, `utils` |

## Các file trong `engine/`

| File | Việc | Không làm |
| --- | --- | --- |
| `ruleset.js` | Ghép nhiều `RuleSet` thành một, báo lỗi ngay nếu trùng key. Giữ `ruleSet` đã ghép và danh sách rule theo loại nước đi (`RULES_BY_KIND`, `PROMOTE_RULES`) | Không chứa luật cờ |
| `applyMoves.js` | Nhận game và nước đi, trả `Game` mới: di chuyển, ăn quân, nhập thành, bắt qua đường, `hasMoved`, `enPassantTarget`, `pendingPromotion`, đổi lượt. Có thêm `applyPromotion` | Không gọi rule, không ghi `result` |
| `squaresMoves.js` | Sinh ô ứng viên theo cách đi của quân (`PIECE_MOVE_DEFS`), tính ô bị tấn công, `isInCheck`. Chỉ đọc | Không đổi state |
| `buildMoves.js` | Dựng input cho rule (`buildMoveInput`, `buildPromoteInput`). Mỗi sự thật là getter lười, chỉ tính khi rule đọc tới. Chỉ đọc | Không chạy rule, không đổi state |
| `legalMoves.js` | Trả lời nước nào hợp lệ (`getLegalMoves`): sinh ô ứng viên rồi chạy cùng danh sách rule mà `reduce` dùng. Chỉ đọc | Không đổi state |
| `outcome.js` | Tính kết quả ván từ thế cờ (`evaluateOutcome`). Chỉ đọc | Không ghi `result` |
| `reduce.js` | `reduce(game, action)` trả `Game` mới hoặc ném lỗi. Là nơi duy nhất ghi `game.result` | Không giữ biến nào |
| `room.js` | Giữ `Game` hiện tại, nhận `dispatch`, báo cho người đăng ký. Nhận `reduce` qua constructor | Không biết luật cờ |

Chuỗi phụ thuộc: `applyMoves ← buildMoves ← legalMoves ← outcome ← reduce`. `buildMoves` cần `applyMoves` vì sự thật `move.exposesKing` được tính bằng cách thử đi nước đó. Vì vậy `applyMoves` phải đứng riêng và không được biết rule, nếu không `buildMoves` và `reduce` sẽ import vòng nhau. `room.js` không import `reduce`. `index.js` là nơi nối hai thứ lại: `new Room(reduce)`.

## Luồng của một `dispatch`

```
room.dispatch(action)
  ├─ room còn sống? action đúng kiểu Action? (không thì ném GameError)
  ├─ next = reduce(game, action)
  │    ├─ MOVE
  │    │    1. findPiece        tìm quân theo action.id
  │    │    2. classifyMove     NORMAL, CASTLE hay EN_PASSANT
  │    │    3. buildMoveInput   dựng input, mỗi sự thật chỉ tính khi rule đọc tới
  │    │    4. check            chạy lần lượt các rule của loại nước đó, rule đầu tiên sai sẽ ném lỗi
  │    │    5. applyMove        tạo Game mới
  │    │    6. settle           tính kết quả ván
  │    └─ PROMOTE
  │         findPiece → buildPromoteInput → check rule PROMOTE → applyPromotion → settle
  └─ gán state = next, báo các hàm đã subscribe
```

`settle(game)`: nếu `pendingPromotion` khác `null` thì trả nguyên game, vì thế cờ chưa xong và lượt chưa đổi. Ngược lại gọi `evaluateOutcome` (ở `outcome.js`), có kết quả thì ghi bằng `game.withResult(result)`.

`reduce` ném lỗi thì dòng gán state trong `room` không chạy, nên state giữ nguyên và không ai được báo.

## Quy ước dữ liệu

### Bàn cờ

- Bàn 8x8. `row` 0 là phía đen (rank 8), `row` 7 là phía trắng (rank 1). `col` 0 là cột a.
- Trắng đi về hàng 0, đen đi về hàng 7. Ô `e2` là `{ row: 6, col: 4 }`.
- Hàng phong cấp: trắng ở hàng 0, đen ở hàng 7 (`PROMOTION_RANK`).
- `PIECE_MOVE_DEFS` viết từ góc nhìn trắng: `forward` dương là tiến về phía đối phương. Khi đọc, trắng dùng `dRow = -forward`, `dCol = lateral`. Đen dùng `dRow = +forward`, `dCol = -lateral`.

### Các model

- **`Piece`**: bất biến, gồm `id`, `type`, `side`, `row`, `col`, `hasMoved`, `ext`. `id` cố định từ lúc khởi tạo, không đổi khi quân đi hay phong cấp. `piece.with(patch)` trả quân mới.
- **`Board`**: bất biến, chỉ biết hình học. `add`, `remove`, `replace` trả `Board` mới. Có `pieceAt`, `pieceById`, `inBounds`, `ray` và getter `rows`, `cols`, `pieces`.
- **`Game`**: bất biến, gồm `board`, `turn`, `enPassantTarget`, `pendingPromotion`, `result`. Các hàm `withX` trả `Game` mới. `Game.initialStandard()` tạo thế ban đầu.
- **`Action`**: `Action.move(id, row, col)` và `Action.promote(id, pieceType)`. Tên action định nghĩa một chỗ duy nhất ở `constants/ActionType.js`.

### Các trường tạm trên `Game`

| Trường | Ghi khi nào | Xóa khi nào | Ai đọc |
| --- | --- | --- | --- |
| `enPassantTarget` | Tốt đi 2 ô: đặt là ô nằm giữa | Ghi đè sau mọi nước đi khác (sống đúng một lượt) | Rule `EN_PASSANT`, `classifyMove` |
| `pendingPromotion` | Tốt tới hàng cuối: đặt là `id` của tốt, chưa đổi lượt | `PROMOTE` xong thì về `null` và đổi lượt | Rule `PROMOTION_PENDING` (chặn mọi `MOVE`), rule `PROMOTE`, UI |
| `result` | Chỉ `reduce`, sau mỗi nước đi hoàn tất | Không xóa. `restart` tạo ván mới | Rule `GAME_NOT_OVER`, UI |

Việc «đang bị chiếu» không lưu trong `Game`. Nó tính ra từ bàn cờ bằng `isInCheck(board, side)` (ở `squaresMoves.js`).

## Quyết định thiết kế

1. **`result` lưu trong `Game`, chỉ `reduce` được ghi.** Rule `GAME_NOT_OVER` và UI đọc thẳng được, không phải tính lại. Chỉ một nơi ghi nên không lệch với bàn cờ. `outcome.js` chỉ tính ra kết quả, không ghi.
2. **Sự thật tính lười.** `buildMoveInput` (ở `buildMoves.js`) trả object có getter, mỗi sự thật chỉ tính khi rule đọc tới và chỉ tính một lần. Sự thật tốn kém như `move.exposesKing` không bao giờ bị tính trên nước đã bị rule rẻ hơn loại.
3. **Nước hợp lệ được xác định bằng chính các rule.** `getLegalMoves` (ở `legalMoves.js`) sinh ô ứng viên, rồi chạy cùng danh sách rule mà `reduce` dùng (`rule.test` thay cho `rule.check`). Nhờ vậy `getLegalMoves` và `reduce` không thể lệch nhau.
4. **`room` không biết luật.** Nhận `reduce` qua constructor nên test được với luật giả, và sau này một room từ xa có thể dùng chung interface.
5. **Một listener ném lỗi không làm `dispatch` thất bại.** State đã đổi trước khi báo, nên lỗi được `console.error` ghi lại và các listener còn lại vẫn được báo.

## Thêm một luật mới

1. Thêm `Rule` vào file trong `rules/`, với key chưa dùng. `ruleset.js` (hàm ghép) báo lỗi nếu trùng key.
2. Thêm key đó vào đúng danh sách trong `RULES_BY_KIND` (hoặc `PROMOTE_RULES`) ở `ruleset.js`. Đặt rule rẻ trước, rule đắt sau.
3. Nếu rule cần sự thật mới, thêm vào `buildMoveInput` ở `buildMoves.js` dưới dạng getter lười. Mọi key rule đọc phải khác `undefined`, nếu không `Rule` ném `missing key`.
4. Nếu luật đổi dữ liệu, sửa `applyMoves.js`, không sửa `reduce.js`.
5. Chạy toàn bộ test. Số perft là chuẩn đã công bố, nên perft lệch nghĩa là code sai, không sửa số.
6. Ghi vào `docs/rules.md`.