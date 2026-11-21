# Kiến trúc mô-đun cờ vua

`src/games/chess/index.js` là API tạo phiên chơi. Nó dựng một `Room`, gắn `Controller`, và gắn bot khi chế độ cần bot. Giao diện phòng cờ React ở `src/features/chess/` gọi API này trực tiếp. Giao diện DOM cũ có thể tải riêng bằng `chess.loadUI()`.

## Các lớp và luồng state

```
features/chess → chess/index → controller → Room → reduce → moves/core
                                           ↘ bot → Room.dispatch
```

- `core/constants/`: định nghĩa quân, phe, action, kiểu nước đi và kết cục.
- `core/models/`: `Piece`, `Board`, `Game` và `Action`. Trạng thái được đóng băng; các thao tác trả dữ liệu mới thay vì sửa tại chỗ.
- `core/moves/`: hình học di chuyển, xác thực, nước thường, nhập thành, bắt tốt qua đường, phong cấp và kết thúc lượt.
- `core/engine/`: `reduce` áp dụng action, `outcome` tính kết quả, `legalMoves` liệt kê các nước được cùng bộ xác thực chấp nhận, và `Room` giữ state phiên chơi.
- `controller/`: kiểm soát chọn quân và lượt người chơi; tạo view cho giao diện và lưu lịch sử nước đi.
- `bot/`: chọn nước đi hợp lệ và gửi vào room như những action khác.

Luồng của một nước đi:

```
Người chơi chọn quân → controller liệt kê nước hợp lệ → chọn ô đích
  → Room.dispatch(Action.move)
  → reduce tìm nước phù hợp, kiểm tra luật, áp dụng nước
  → cập nhật state và thông báo subscriber
  → controller cập nhật view và lịch sử
```

Action không hợp lệ ném `GameError`; room giữ nguyên state và không gửi cập nhật. Room cũng nhận action của bot hoặc bên tích hợp khác, vì vậy UI theo dõi cùng state để lịch sử không bỏ sót lượt đi.

Tốt tới hàng cuối tạo state `pendingPromotion` và giữ lượt hiện tại. Người chơi chọn quân qua action phong cấp riêng; sau đó lượt mới đổi. Khi ván kết thúc, `reduce` lưu `result` trên state.

## Kiểm tra luật và hiệu năng

`core/moves/index.js` đăng ký ba kiểu nước đi: nhập thành, bắt tốt qua đường, rồi nước thông thường. Nước đặc biệt được xét trước vì nước thường khớp mọi tọa độ. `validate` chạy các kiểm tra chung, sau đó chạy kiểm tra của loại nước tương ứng; `getLegalMoves` cũng dùng đúng đường kiểm tra đó.

`core/moves/squares.js` dùng `movementSquares` để sinh ô ứng viên theo ray. Khi chỉ cần kiểm tra một đích cụ thể, `canReachSquare` khớp trực tiếp mẫu quân, chỉ duyệt các ô giữa có thể chắn. Kiểm tra vua có bị tấn công dùng cùng cách kiểm tra từng đích và dừng ngay khi tìm được kẻ tấn công. Nhờ vậy, việc kiểm tra một action không phải dựng đầy đủ mọi ô có thể đi.

`evaluateOutcome` nhận diện chiếu hết, hết nước đi hợp lệ và hòa do thiếu quân. Chưa xử lý hòa lặp lại thế cờ hoặc luật 50 nước.

## Kiểm thử

`npm test` chạy kiểm thử Node cho API, lịch sử, bot, perft và các trường hợp nhập thành, bắt tốt qua đường, phong cấp. Perft từ vị trí khai cuộc tới ply thứ ba phải là `20`, `400`, `8902`; thay đổi con số này báo hiệu sai luật.
