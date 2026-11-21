# Font tiếng Việt và Stockfish

Ứng dụng dùng Be Vietnam Pro tự host cho body/heading, với 400/500/600/700. Nguồn, OFL, metadata và checksum ở public/fonts/be-vietnam-pro/. Font đã được kiểm tra cmap cho 233 ký tự ASCII, tiếng Việt và dấu tổ hợp. Không cần Google Fonts khi chạy. Nút đăng nhập và nhãn thời gian có điều chỉnh ở màn hình hẹp.

## Engine và cấp độ

Mặc định các chế độ có bot dùng Stockfish.js 19.0.1 Lite, một luồng WebAssembly. Worker/WASM chỉ được nạp khi khởi tạo ván; không tính trên luồng giao diện chính. WASM là 1.845.971 byte. Không âm thầm dùng simple bot khi engine lỗi.

| Cấp | Skill Level | Depth | Ngân sách mỗi nước |
| --- | ---: | ---: | ---: |
| Mới bắt đầu | 0 | 2 | 150 ms |
| Dễ | 3 | 5 | 300 ms |
| Trung bình | 7 | 9 | 600 ms |
| Khó | 11 | 13 | 1.000 ms |
| Chuyên gia | 16 | 18 | 1.600 ms |
| Bậc thầy | 20 | 22 | 2.400 ms |

Đây là preset sản phẩm, không phải Elo hiệu chuẩn. Bậc thầy là skill tối đa trong bản Lite và ngân sách thiết bị, không tuyên bố tương đương bản full/native với tài nguyên lớn.

## Vòng đời và luật

Adapter ở src/games/chess/bot/stockfish/. Room sở hữu một Worker; retry thay Worker trên cùng thế cờ. Rời/kết thúc ván dọn Worker/timer. Đổi cấp sau khi có nước đi cần xác nhận ván mới. Kết quả tìm kiếm cũ không được tác động lên ván sau. Đồng hồ tạm dừng khi loading/error, có nút thử lại.

FEN giữ quyền nhập thành và en passant. Bestmove được kiểm tra lại theo luật cục bộ; giữ đủ bốn lựa chọn phong cấp. Game chưa lưu counters 50 nước hoặc repetition nên FEN dùng counters 0 1. Tích hợp này chưa bổ sung hai luật hòa đó.

## Nguồn và giấy phép

public/stockfish/ cung cấp loader, WASM, GPL-3.0, AUTHORS, source-v19.0.1.zip, network nn-61e7af4bb97d.nnue và NOTICE với nguồn/checksum. Để build lại: giải nén source, chép network vào src/, kích hoạt Emscripten 6.0.9 cùng prerequisite upstream và chạy:

```sh
node build.js --lite --single-threaded --no-split
```

Xem THIRD_PARTY_NOTICES.md; giữ các giấy phép upstream khi phân phối tài nguyên.

## Kiểm tra

```sh
npm test
npm run lint
npm run build
npm run check:ui
npm run check:stockfish
```

check:stockfish chạy chính JS/WASM đã bundle qua UCI ở đủ sáu preset rồi xác nhận nước đi bằng luật ứng dụng.

Đã kiểm tra browser: font body/heading cùng Be Vietnam Pro và báo loaded; desktop sáng/tối; viewport 320/390 không tràn ngang ở trang chọn trận. Nhãn thời gian tại 320 nằm trên một dòng. Đã chơi e2-e4 ở Mới bắt đầu (bot e7-e5), đổi cấp có xác nhận rồi chơi d2-d4 ở Bậc thầy (bot g8-f6). Không có console error trong tab thử. Đây là spot check, không phải audit toàn bộ accessibility/mọi browser.

Ảnh: docs/screenshots/stockfish-font-desktop.jpg. Báo cáo: docs/Stockfish-fonts-validation.md.
