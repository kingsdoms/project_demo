# Rule và input

Mỗi `Rule` là một danh sách ràng buộc kiểu «sự thật X phải bằng Y». Chưa rule nào tự tính ra sự thật. Việc đó do `engine/ruleset.js` làm, và đây là bảng hợp đồng giữa hai bên.

## Cách rule được chạy

- `rule.check(input)` ném lỗi nếu có ràng buộc sai. `reduce` dùng hàm này.
- `rule.test(input)` trả `true` hoặc `false`. `getLegalMoves` và `evaluateOutcome` dùng hàm này.
- Cả hai đều ném `missing key: X` nếu rule đọc một key mà input để `undefined`. Đó là lỗi lập trình, không phải nước đi sai. Giá trị `null` và `false` là hợp lệ.
- Key có thể là đường dẫn, ví dụ `piece.side`, `move.inBoard`.

## Rule nào chạy cho loại nước đi nào

`classifyMove(game, piece, row, col)` phân loại theo hình dạng nước đi, chưa xét hợp lệ:

| Loại (`MoveKind`) | Nhận ra khi |
| --- | --- |
| `CASTLE` | Vua đi đúng 2 cột trên cùng hàng |
| `EN_PASSANT` | Tốt đi chéo một ô về phía trước, vào đúng ô `enPassantTarget` đang trống |
| `NORMAL` | Mọi trường hợp còn lại |

Danh sách rule theo loại (`RULES_BY_KIND`). Rule chạy từ trái sang phải, rule đầu tiên sai sẽ dừng. Thứ tự là rẻ trước, đắt sau.

| Loại | Rule |
| --- | --- |
| `NORMAL` | `GAME_NOT_OVER`, `PROMOTION_PENDING`, `TURN`, `IN_BOARD`, `PATTERN`, `NOT_ALLY_TARGET`, `NOT_SELF_CHECK` |
| `CASTLE` | `GAME_NOT_OVER`, `PROMOTION_PENDING`, `TURN`, `IN_BOARD`, `CASTLE`, `NOT_SELF_CHECK` |
| `EN_PASSANT` | `GAME_NOT_OVER`, `PROMOTION_PENDING`, `TURN`, `IN_BOARD`, `EN_PASSANT`, `NOT_SELF_CHECK` |
| `PROMOTE` (action riêng) | `PROMOTE` (`PROMOTE_RULES`) |

`PROMOTE` không chạy `TURN` và `PROMOTION_PENDING`, vì lúc chờ phong cấp mọi `MOVE` bị chặn nhưng `PROMOTE` phải qua được.

## Các rule và input của chúng

### `rules/gameRules.js`

| Rule | Input phải thỏa | Ý nghĩa |
| --- | --- | --- |
| `GAME_NOT_OVER` | `state.result` bằng `null` | Ván đã kết thúc thì không nhận nước nào |
| `PROMOTION_PENDING` | `move.blockedByPromotion` bằng `false` | Còn tốt chờ phong cấp thì mọi `MOVE` bị chặn |
| `TURN` | `piece.side` bằng `turn` | Chỉ bên tới lượt được đi |

### `rules/boardRules.js`

| Rule | Input phải thỏa | Ý nghĩa |
| --- | --- | --- |
| `IN_BOARD` | `move.inBoard` bằng `true` | Ô đích nằm trong bàn |
| `PATTERN` | `move.reachable` bằng `true` | Ô đích nằm trong nước đi của quân |
| `NOT_ALLY_TARGET` | `move.targetIsAlly` bằng `false` | Không ăn quân cùng bên |
| `NOT_SELF_CHECK` | `move.exposesKing` bằng `false` | Sau nước đi, vua bên mình không bị chiếu |
| `CASTLE` | `piece.hasMoved` bằng `false`, `rook.hasMoved` bằng `false`, `castle.pathEmpty` bằng `true`, `castle.inCheck` bằng `false`, `castle.passesAttacked` bằng `false` | Vua và xe chưa đi, giữa hai quân trống, vua không bị chiếu và không đi qua hay tới ô bị chiếu |
| `EN_PASSANT` | `passant.targetMatches` bằng `true`, `passant.capturedPawnJustDoubled` bằng `true` | Chỉ bắt vào ô vừa bị bỏ qua, và tốt bị bắt vừa đi hai ô |

### `rules/pieceRules.js`

| Rule | Input được cấp | Ý nghĩa |
| --- | --- | --- |
| `PROMOTE` | `piece`, `turn`, `state.result`, `pendingPromotion`, `newPieceType`, `action` (gồm `id`, `pieceType`) | Quân là tốt, đã tới hàng phong cấp, đúng là tốt đang chờ (`piece.id` bằng `pendingPromotion`), và `newPieceType` nằm trong `PROMOTION_TARGETS` (hậu, xe, tượng, mã) |

Rule `PROMOTE` đọc key nào thì key đó phải có trong `buildPromoteInput`. Đổi rule thì đổi hàm này theo.

### `rules/outcomeRules.js`

| Rule | Input phải thỏa | Kết quả |
| --- | --- | --- |
| `checkmate` | `position.inCheck` bằng `true`, `position.hasLegalMove` bằng `false` | Chiếu hết, bên đối diện thắng |
| `stalemate` | `position.inCheck` bằng `false`, `position.hasLegalMove` bằng `false` | Hết nước, hòa |
| `insufficientMaterial` | `position.insufficientMaterial` bằng `true` | Hòa do thiếu quân |

`evaluateOutcome(game)` thử lần lượt `checkmate`, `stalemate`, `insufficientMaterial`. Rule đầu tiên đạt cho ra `{ type, winner }`, không rule nào đạt thì trả `null`. Phải gọi khi `game.result` còn `null`, vì `hasLegalMove` dùng rule `GAME_NOT_OVER`.

## Các sự thật được tính thế nào

| Key | Cách tính |
| --- | --- |
| `piece`, `turn` | Quân đang đi và `game.turn` |
| `state.result` | `game.result` |
| `move.inBoard` | `board.inBounds(row, col)` |
| `move.reachable` | Ô đích có trong `movementSquares(board, piece)` |
| `move.targetIsAlly` | Quân ở ô đích cùng phe với quân đi |
| `move.exposesKing` | Thử `applyMove`, rồi kiểm tra vua cùng phe có bị tấn công trên bàn mới. Không có vua thì coi là không |
| `move.blockedByPromotion` | `game.pendingPromotion !== null` |
| `rook.hasMoved` | `hasMoved` của xe ở góc cùng phía với hướng nhập thành. Không có xe cùng phe ở góc thì coi là `true` |
| `castle.pathEmpty` | Mọi ô giữa vua và xe đều trống, và có xe |
| `castle.inCheck` | Ô vua đang đứng bị đối phương tấn công |
| `castle.passesAttacked` | Hai ô vua đi qua và tới có ô nào bị đối phương tấn công |
| `passant.targetMatches` | Ô đích bằng `game.enPassantTarget` |
| `passant.capturedPawnJustDoubled` | Có tốt đối phương đứng cạnh, cùng cột với `enPassantTarget` |
| `position.inCheck` | `isInCheck(board, game.turn)` |
| `position.hasLegalMove` | Bên tới lượt còn ít nhất một nước hợp lệ |
| `position.insufficientMaterial` | Xem mục thiếu quân bên dưới |

`move.reachable` tính cả ô có quân cùng bên. Việc loại ô đó là của `NOT_ALLY_TARGET`, để báo đúng lý do cho người chơi.

## Ngữ nghĩa dữ liệu cách đi quân (`PieceMoveDefs.js`)

Mỗi pattern có `forward`, `lateral`, `steps`, `capture` và có thể có `requires`.

| Trường | Ý nghĩa |
| --- | --- |
| `steps: Infinity` | Đi 1, 2, 3... ô cho tới khi gặp quân hoặc hết bàn |
| `steps: N` (hữu hạn) | Đi đúng N ô, mọi ô ở giữa phải trống |
| `capture: ANY` | Ô đích trống hay có quân đều được |
| `capture: NEVER` | Ô đích phải trống |
| `capture: ONLY` | Ô đích phải có quân |
| `requires: "unmoved"` | Chỉ áp dụng khi quân chưa đi (`hasMoved` là `false`) |

Nhập thành và bắt qua đường không khai báo ở đây vì chúng đổi hai quân và cần kiểm tra chiếu. Chúng nằm ở `classifyMove`, `CASTLE` và `EN_PASSANT`.

### Ô bị tấn công

`attackSquares(board, piece)` dùng cùng pattern nhưng bỏ các pattern `NEVER` và tính cả ô trống. Nhờ vậy tốt chỉ tấn công hai đường chéo (kể cả khi ô đó đang trống), và đi thẳng không phải là tấn công. Ô có quân đầu tiên trên đường đi luôn được tính, dù quân đó thuộc bên nào. Điều này làm vua không ăn được quân đang được bảo vệ.

### Nhập thành

- Vua đi 2 cột. Xe ở góc cùng phía (cột 0 hoặc cột cuối) nhảy sang ô vua vừa đi qua: gần là vua cột 4 sang 6, xe 7 sang 5. Xa là vua 4 sang 2, xe 0 sang 3.
- Ô sát xe ở phía xa (ví dụ b1) được phép bị tấn công, vì vua không đi qua ô đó.

### Hòa thiếu quân

Tính là thiếu quân khi ngoài hai vua chỉ còn:

- không quân nào, hoặc
- đúng một mã hoặc một tượng, hoặc
- chỉ các tượng và tất cả cùng màu ô.

Mọi trường hợp khác (có tốt, xe, hậu, hoặc hai tượng khác màu ô) chưa tính là hòa.