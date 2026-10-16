# Plan v1: Cờ vua web chơi với bot

## 1. Mục tiêu

Trang web cờ vua chạy trên trình duyệt, chơi với bot, có đầy đủ luật cờ vua cơ bản. Không làm online, không lưu ván.

Thẻ bài là **phần mở rộng**, tách riêng ở mục 3. Phần này làm sau khi phần cờ vua đã chạy ổn, và không được làm thay đổi luật cờ gốc.

## 2. Phần A: Cờ vua cơ bản (bắt buộc)

**Luật chơi:**
- 6 loại quân, đi đúng luật, ăn quân.
- Không được đi nước khiến vua của mình bị chiếu.
- Chiếu, chiếu hết (thắng), hết nước (hòa), hòa do thiếu quân.
- Nhập thành, phong cấp, bắt tốt qua đường.

**Chức năng:**
- Chọn quân, hiện các nước đi hợp lệ, bấm để đi.
- Hoạt ảnh di chuyển bằng CSS `transform`. Khóa bàn khi quân đang chạy hoạt ảnh.
- Hiển thị lượt đi, trạng thái chiếu, kết quả ván.
- Phong cấp: hiện hộp chọn quân khi tốt đến hàng cuối.
- Nút ván mới.

**Bot v1:** ưu tiên ăn quân có giá trị cao nhất. Nếu không có nước ăn quân thì đi ngẫu nhiên một nước hợp lệ. Bot đi sau người chơi khoảng 500ms.

## 3. Phần B: Phần mở rộng (thẻ bài)

Mục tiêu là thêm chiều chiến thuật mà không sửa luật cờ.

**Quy tắc thẻ:**
- Đầu lượt của mỗi bên, nếu tay còn chỗ thì bốc 1 lá.
- Tay tối đa 3 lá. Tay đầy thì không bốc.
- Chơi thẻ tốn lượt.
- Thẻ không có trong tay, hoặc quân không phải của mình: từ chối, không đổi lượt.

**Ba thẻ trong v1:**

| Thẻ | Hiệu ứng | Ghi chú |
|---|---|---|
| Khiên | Quân không thể bị ăn trong 5 lượt của chủ quân | Đếm theo lượt chủ quân |
| Hồi sinh | Quân bị ăn được lưu lại vị trí và trạng thái. Sau 2 lượt của chủ quân, quân được đặt lại đúng ô cũ | Nếu ô cũ bị chiếm thì chờ đến khi trống. Mỗi thẻ hồi sinh một lần |
| Mở rộng bàn | Thêm 1 cột vào bàn | Quân giữ nguyên vị trí |

**Bot dùng thẻ:** khi có thẻ trên tay, mỗi lượt có khoảng 10% xác suất dùng thẻ lên quân có giá trị cao nhất.

**Nguyên tắc kỹ thuật:**
- Mỗi hiệu ứng là một file, gồm `methods` (thêm hàm mới) và `override` (bọc hàm có sẵn qua tham số `next`).
- Dữ liệu riêng của hiệu ứng nằm trong `ext.<tên>` của quân hoặc `state.<tên>` của bàn, khai báo qua `initState`.
- Thẻ là dữ liệu, trỏ tới một hàm trong extension.

## 4. Kiến trúc chung

Phụ thuộc chỉ đi một chiều: `extensions` chỉ import từ `core`, còn `core` không biết gì về extensions, UI hay bot.

```
src/games/chess/
├── index.js            # ghép luật, tạo room, export ChessGame
├── core/
│   ├── config.js       # số liệu có thể chỉnh
│   ├── models.js       # createPiece (có hasMoved), createInitialState
│   ├── state.js        # helper bất biến
│   ├── actions.js      # danh sách action type
│   ├── rules.js        # luật gốc, gồm nhập thành và bắt qua đường
│   ├── compose.js      # buildRules
│   └── Room.js
├── extensions/
│   ├── protect.js
│   ├── revive.js
│   ├── boardExpansion.js
│   └── cards/
│       ├── cardSystem.js
│       └── cardDefs.js
├── bot/
│   └── simpleBot.js
├── ui/
│   ├── ChessGame.jsx
│   ├── Board.jsx
│   ├── Piece.jsx
│   ├── CardHand.jsx
│   ├── useRoom.js
│   └── chess.css
└── tests/              # chạy bằng node
```

**Dữ liệu cần cho luật gốc:** `hasMoved` trên quân (nhập thành), và `enPassantTarget` trên state (bắt qua đường, chỉ tồn tại trong một lượt).

**Interface của Room:** `dispatch(action)`, `getState()`, `subscribe(fn)`, `restart()`, `destroy()`.

**Action types:** `MOVE { id, row, col }`, `PROMOTE { id, type }` và `PLAY_CARD { cardId, pieceId }`. Định nghĩa tên action ở một chỗ duy nhất (`actions.js`) để bot, UI và room dùng chung.

**Quy tắc tránh lỗi:**
- Chỉ tiêu lượt khi thao tác hợp lệ.
- `buildRules` báo lỗi ngay nếu hai extension trùng tên hàm, không ghi đè im lặng.
- State chỉ được thay đổi qua `dispatch`. UI và bot không sửa state trực tiếp.
- Hàm trong `core` và `extensions` là hàm thuần, test được bằng node mà không cần trình duyệt.

## 5. Các mốc triển khai

**Phần A (cờ vua):**
- **A1:** model và helper bất biến. Xong khi `updatePiece` trả về object mới, object cũ không đổi.
- **A2:** nước đi cơ bản, chiếu, chiếu hết, hết nước, hòa thiếu quân. Xong khi thế ban đầu có đúng 20 nước đi cho trắng, nước tự chiếu bị từ chối, và thế chiếu hết (ví dụ Fool's Mate) cho ra `winner`.
- **A3:** nhập thành, phong cấp, bắt tốt qua đường. Mỗi luật có ít nhất một test, gồm cả trường hợp bị cấm (ví dụ nhập thành khi vua đi qua ô bị chiếu).
- **A4:** Room và buildRules. Xong khi `restart` và `destroy` hoạt động, và `dispatch` sai không làm đổi state.
- **A5:** bot. Xong khi bot đấu với bot chạy 200 nước mà không lỗi.
- **A6:** UI và hoạt ảnh. Xong khi chơi được một ván với bot trên trình duyệt, không có lỗi console, chạy được ở chế độ StrictMode.
- **A7:** hoàn thiện. Thông báo kết quả, hộp phong cấp, CSS, nút ván mới.

**Phần B (thẻ bài):**
- **B1:** tay bài, bốc đầu lượt, giới hạn 3 lá, validate. Xong khi thẻ không có trong tay bị từ chối và không đổi lượt.
- **B2:** khiên. Xong khi quân có khiên không bị ăn, và sau 5 lượt chủ quân thì bị ăn lại bình thường.
- **B3:** hồi sinh. Xong khi quân được đặt lại đúng ô sau 2 lượt, và chờ nếu ô bị chiếm.
- **B4:** mở rộng bàn. Xong khi bàn tăng thêm 1 cột, quân giữ vị trí, và nước đi, nhập thành, phong cấp vẫn đúng.
- **B5:** bot dùng thẻ.
- **Hồi quy:** toàn bộ test của Phần A vẫn pass khi bật extension.

## 6. Tiêu chí hoàn thành v1

- Tất cả test bằng node đều pass.
- Chơi hết một ván với bot trên trình duyệt, không có lỗi console.
- Thêm một extension giả (ví dụ tăng số nước đi) mà không sửa `core/` hay `ui/`.
- ESLint không báo lỗi.

## 7. Các quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Chiếu, chiếu hết | Có trong v1 |
| Nhập thành, phong cấp, bắt tốt qua đường | Có trong v1 |
| Hòa do thiếu quân | Có trong v1 |
| Bốc bài | Đầu mỗi lượt bốc 1 lá nếu còn chỗ, tay tối đa 3 lá |
| Chơi thẻ | Tốn lượt |
| Khiên và hồi sinh | Đếm theo lượt của chủ quân |
| Ô bị nguyền (tileCurse) | Chuyển sang v1.1 |

## 8. Futures (v1.1 trở lên)

- Mở rộng bàn: chọn cột thêm ở bên nào (đề xuất bên phải), nhập thành và phong cấp dùng kích thước thực tế của bàn.
- Ô bị nguyền (tileCurse)
- Lặp 3 lần và luật 50 nước
- Undo nước đi
- Lưu ván bằng localStorage
- Bot nâng cao: minimax 2 đến 3 tầng, đánh giá vị trí, chọn độ khó
- Thêm thẻ và hiệu ứng mới
- Chơi online: `RemoteRoom` có cùng interface với `Room`, UI không cần đổi