# Plan v1.1: Cờ vua web chơi với bot

Phiên bản 1.1 · 19/10/2026 · thay thế Plan v1

## 0. Hướng dẫn dành cho AI (đọc trước khi làm)

Tài liệu này chỉ dành cho AI viết code. Mọi câu là yêu cầu, trừ mục 7 là ý tưởng chưa làm.

**Cách làm:**

1. Đọc toàn bộ plan, rồi đọc code hiện có trong `src/games/chess/` trước khi viết bất cứ thứ gì.
2. Làm lần lượt A1 đến A7 ở mục 5, không nhảy mốc. Mốc xong khi đạt điều kiện «Xong khi» của nó.
3. Mỗi mốc có test chạy bằng node. Chạy toàn bộ test, gồm test của các mốc trước, trước khi sang mốc sau.
4. Sau mỗi mốc, báo lại: file đã tạo hoặc sửa, test đã chạy và kết quả, điểm chưa rõ.

**Không được làm:**

- Viết code, tạo file hay thêm hook cho phần mở rộng (mục 7).
- Đổi tên hoặc chữ ký của hàm, action, interface room đã có trong code.
- Thêm thư viện hoặc framework test mới khi chưa được yêu cầu.
- Sửa test cho pass. Test chỉ được sửa khi luật trong plan thay đổi.
- Tự quyết các điểm ở mục 8. Hỏi người dùng.
- Tự đoán khi plan mâu thuẫn với code. Dừng và báo người dùng.

## 1. Mục tiêu

Trang web cờ vua chạy trên trình duyệt, chơi với bot, có đầy đủ luật cờ vua cơ bản. Không làm online, không lưu ván.

v1.1 tập trung hoàn toàn vào phần cờ vua cơ bản. Thẻ bài và các extension chỉ còn là ý tưởng ở mục 7, chưa có thiết kế hay code.

## 2. Thay đổi so với v1

- Cập nhật cấu trúc thư mục theo mã nguồn hiện tại (mục 4).
- `core` tách thành `constants`, `models`, `rules`, `engine`. Thư mục `utils` nằm ở cấp `chess`, ngang hàng `core`.
- Phần B (thẻ bài) rút gọn thành danh sách ý tưởng. Bỏ các mốc B1 đến B5 và các tiêu chí liên quan.
- Viết lại mốc A1 đến A7 theo đúng file thực tế.
- Bỏ `PLAY_CARD` khỏi danh sách action của v1.1.

Đối chiếu file cũ sang file mới:

| v1 | v1.1 | Ghi chú |
| --- | --- | --- |
| `models.js` | `models/Piece.js`, `Board.js`, `Game.js` | Tách theo đối tượng |
| `actions.js` | `constants/ActionType.js` và `models/Action.js` | Tách tên action và cấu trúc action |
| `rules.js` | `rules/boardRules.js`, `gameRules.js`, `outcomeRules.js`, `pieceRules.js` | Tách theo nhóm luật |
| `compose.js`, `Room.js` | `engine/compose.js`, `engine/room.js` | Chuyển vào `engine` |
| `config.js` | `constants/PieceDefs.js`, `PieceMoveDefs.js` (dự kiến) | Cần xác nhận |
| `state.js` | chưa có file tương ứng | Cần chốt, xem mục 8 |

## 3. Phần A: Cờ vua cơ bản (bắt buộc)

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

**Bot v1.1:** ưu tiên ăn quân có giá trị cao nhất. Nếu không có nước ăn quân thì đi ngẫu nhiên một nước hợp lệ. Bot đi sau người chơi khoảng 500ms.

## 4. Kiến trúc và cấu trúc thư mục

**Luồng tổng thể**

```
App (vỏ)
 ├── đọc danh sách game từ games/index.js
 ├── hiện menu chọn game
 └── khi chọn game: tạo room của game đó, rồi render Component của game

games/chess (plugin)
 └── index.js   ← cửa duy nhất, App chỉ import file này
```

**Cấu trúc thư mục (theo ảnh chụp mã nguồn)**

```
src/games/chess/
├── index.js
├── bot/
├── core/
│   ├── constants/
│   │   ├── ActionType.js
│   │   ├── CaptureMode.js
│   │   ├── ErrorCode.js
│   │   ├── PieceDefs.js
│   │   ├── PieceMoveDefs.js
│   │   ├── PieceType.js
│   │   └── Side.js
│   ├── engine/
│   │   ├── compose.js
│   │   └── room.js
│   ├── models/
│   │   ├── Action.js
│   │   ├── Board.js
│   │   ├── Game.js
│   │   ├── Piece.js
│   │   ├── Rule.js
│   │   └── RuleSet.js
│   ├── rules/
│   │   ├── boardRules.js
│   │   ├── gameRules.js
│   │   ├── outcomeRules.js
│   │   └── pieceRules.js
│   └── scaffold
├── extensions/          # để trống ở v1.1
├── tests/               # chạy bằng node
├── ui/
└── utils/
    ├── dev-note.md
    ├── GameError.js
    └── validation.js
```

**Vai trò từng nhóm file** (suy ra từ tên file, chưa kiểm với code). Trước khi sửa file đã có, đọc file đó và giữ nguyên tên hàm, chữ ký, cấu trúc dữ liệu. Plan mâu thuẫn với code thì dừng và báo người dùng.

| Nhóm | Vai trò |
| --- | --- |
| `constants/` | Hằng số và dữ liệu định nghĩa: loại quân, phe, loại action, mã lỗi, cách đi của từng quân, chế độ ăn quân |
| `models/` | Cấu trúc dữ liệu: quân, bàn, ván, action, luật và bộ luật |
| `rules/` | Hàm thuần chứa luật: luật bàn cờ, luật ván, kết quả ván, luật từng quân |
| `engine/` | `compose.js` ghép các luật thành bộ luật, `room.js` giữ state và nhận action |
| `utils/` | `GameError` và hàm kiểm tra dữ liệu đầu vào, dùng chung |
| `bot/`, `ui/` | Chỉ giao tiếp với game qua interface của room |

**Phụ thuộc một chiều:** `constants` và `utils` không import ai. `models` dùng `constants`. `rules` dùng `models` và `constants`. `engine` dùng `rules`. `bot` và `ui` lấy dữ liệu qua room, và dùng các hàm đọc luật thuần (ví dụ lấy nước đi hợp lệ), không sửa state trực tiếp. `core` không biết gì về `bot`, `ui` hay `extensions`.

**Dữ liệu cần cho luật gốc:** `hasMoved` trên quân (nhập thành), và `enPassantTarget` trên state (bắt qua đường, chỉ tồn tại trong một lượt).

**Interface của room:** `dispatch(action)`, `getState()`, `subscribe(fn)`, `restart()`, `destroy()`.

**Action types (v1.1):** `MOVE { id, row, col }` và `PROMOTE { id, type }`. Tên action định nghĩa một chỗ duy nhất trong `constants/ActionType.js` để bot, UI và room dùng chung.

**Quy tắc tránh lỗi:**

- Chỉ tiêu lượt khi thao tác hợp lệ.
- Action không hợp lệ ném `GameError` kèm mã trong `ErrorCode.js`, và không làm đổi state.
- State chỉ được thay đổi qua `dispatch`. UI và bot không sửa state trực tiếp.
- Hàm trong `models` và `rules` là hàm thuần, test được bằng node mà không cần trình duyệt.
- `compose.js` báo lỗi ngay nếu hai bộ luật trùng tên hàm, không ghi đè im lặng.

## 5. Các mốc triển khai (Phần A)

- **A1: constants và model.** File: `PieceType`, `Side`, `PieceDefs`, `Piece`, `Board`, `Game`. Xong khi hàm cập nhật quân trả về object mới và object cũ không đổi.
- **A2: nước đi cơ bản.** File: `PieceMoveDefs`, `pieceRules`, `boardRules`, `gameRules`, `outcomeRules`. Xong khi thế ban đầu có đúng 20 nước đi cho trắng, nước tự chiếu bị từ chối, và thế chiếu hết (ví dụ Fool's Mate) cho ra người thắng. Gồm cả hết nước và hòa do thiếu quân.
- **A3: luật đặc biệt.** Nhập thành, phong cấp, bắt tốt qua đường. Mỗi luật có ít nhất một test, gồm cả trường hợp bị cấm (ví dụ nhập thành khi vua đi qua ô bị chiếu).
- **A4: room và compose.** File: `Action`, `ActionType`, `ErrorCode`, `GameError`, `validation`, `compose`, `room`. Xong khi `restart` và `destroy` hoạt động, và `dispatch` sai không làm đổi state.
- **A5: bot.** Xong khi bot đấu với bot chạy 200 nước mà không lỗi.
- **A6: UI và hoạt ảnh.** Xong khi chơi được một ván với bot trên trình duyệt, không có lỗi console, chạy được ở chế độ StrictMode.
- **A7: hoàn thiện.** Thông báo kết quả, hộp phong cấp, CSS, nút ván mới.

## 6. Tiêu chí hoàn thành v1.1

- Tất cả test bằng node đều pass.
- Chơi hết một ván với bot trên trình duyệt, không có lỗi console.
- ESLint không báo lỗi.
- Không có phần nào của `core` import từ `bot`, `ui` hay `extensions`.

## 7. Ý tưởng mở rộng (chưa làm, chỉ ghi nhận)

Phần này chỉ để ghi nhận. AI không viết code, không tạo file trong `extensions/`, không thêm hook hay tham số trong `core` để chuẩn bị cho các ý tưởng này.

**Thẻ bài**

- Bốc thẻ đầu lượt, tay tối đa 3 lá, chơi thẻ tốn lượt.
- Khiên: quân không bị ăn trong vài lượt.
- Hồi sinh: quân bị ăn quay lại ô cũ sau vài lượt.
- Mở rộng bàn: thêm một cột.
- Bot thỉnh thoảng dùng thẻ.

**Khác**

- Ô bị nguyền (tileCurse)
- Lặp 3 lần và luật 50 nước
- Undo nước đi
- Lưu ván bằng localStorage
- Bot nâng cao: minimax 2 đến 3 tầng, đánh giá vị trí, chọn độ khó
- Chơi online: một room từ xa có cùng interface với `room`, UI không cần đổi

## 8. Điểm chưa rõ (hỏi người dùng, không tự quyết)

- `core/scaffold`: không rõ là file hay thư mục, vai trò chưa xác định. Không sửa, không xóa, không import.
- `utils/dev-note.md`: ghi chú của người dùng. Không sửa, không di chuyển.
- Helper bất biến của `state.js` (v1): chưa rõ nằm ở `models/` hay `utils/`. Đọc code hiện có. Nếu chưa có thì hỏi trước khi tạo.
- `constants/CaptureMode.js`: ý nghĩa chưa được mô tả. Đọc code hiện có, không đổi giá trị.
- `Action.js`, `Board.js`, `Piece.js`, `pieceRules.js` đang có thay đổi chưa commit. Đọc trước khi sửa, không ghi đè, không revert.
