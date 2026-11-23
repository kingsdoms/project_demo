# ChessArena — thiết kế giao diện 24/11/2026

Áp dụng skill `frontend-design` từ anthropics/skills. Tham khảo trực tiếp trang
https://www.chess.com/play/computer: bàn cờ là trung tâm, điều hướng bên trái,
thông tin người chơi sát bàn, thao tác phụ ở cột bên phải.

## Hướng thiết kế trước khi triển khai

- Graphite #302e2b: nền phòng cờ; charcoal #262421: điều hướng; stone #3b3935:
  bề mặt điều khiển; ivory #eeeed2 và olive #769656: ô bàn cờ;
  leaf #a3c768: hành động chính. Xanh trời cho nội dung hướng dẫn.
- Montserrat đậm: tiêu đề và tên thương hiệu, gợi cảm giác câu lạc bộ thân thiện.
  Inter tự host, có dấu tiếng Việt: nội dung và điều khiển. Đồng hồ dùng chữ số
  tabular. Không thêm font hay thư viện tải từ bên ngoài.
- Căn trái, điều hướng cố định; bàn cờ minh họa lớn và nút chơi cạnh nhau.
  Khi chơi thật, bàn cờ chiếm phần lớn diện tích; lịch sử và công cụ ở bên phải.
  Mobile chuyển thành một cột, bàn cờ dùng toàn bộ bề ngang, điều hướng dưới.

```text
desktop                       mobile
logo | trang | tài khoản      logo | tài khoản
nav  | lời chào               lời chào
nav  | bàn cờ | bắt đầu       bắt đầu
nav  |        | chọn nhịp     bàn cờ
nav  | hướng dẫn | xem lại    hướng dẫn / xem lại
                              điều hướng dưới
```

## Đánh giá với yêu cầu

Giữ xanh olive vì hợp với bàn cờ và tham chiếu Chess.com. Thay dashboard thống kê
mẫu và hero quảng cáo bằng một bàn cờ rõ ràng, bắt đầu luyện tập trong một lần
bấm. Hướng dẫn và xem lại dùng nội dung thực có sẵn. Không dùng số người online
hoặc Elo giả để tạo cảm giác hoạt động. Luồng online vẫn nói rõ là mô phỏng.

Mục tiêu: hành động chính nhìn thấy ngay; điều khiển tối thiểu 44px; hỗ trợ
bàn phím, tương phản, reduced motion, giao diện sáng/tối. Giữ engine, tài khoản
và quyền quản trị hiện có. Kiểm tra build, lint, SSR, test cờ và desktop/mobile.

## Kết quả kiểm tra

- `npm run lint`, `npm run build`, `git diff --check`: thành công.
- `npm test`: 77/77 test; `npm run check:ui`: 32 màn hình render thành công.
- Trình duyệt: 1280×720, 390×844 và 320×740. Trang chủ, phòng chơi và chọn
  chế độ không tràn ngang ở các màn hình đã đo.
- Chọn Rapid 10+5 và cấp Dễ ở trang chủ: vào đúng ván và cấp đã chọn.
- Nước e2–e4 hợp lệ; máy trả e7–e6; lịch sử đủ hai lượt; đồng hồ cộng 5 giây.
- Lật bàn cờ, xác nhận đầu hàng, kết quả và xem lại đã thử.
- Menu mobile mở và điều hướng được sau khi sửa thứ tự lớp phủ. Chế độ sáng/tối
  đã kiểm tra trực quan. Không gọi API ghi hay dùng tài khoản thật trong lần này.
- Ảnh: [desktop](screenshots/chessarena-desktop.jpg),
  [mobile](screenshots/chessarena-mobile.jpg).

Giới hạn hiện có: ghép trận xếp hạng và phòng mời vẫn là mô phỏng. Ván luyện tập
không tính điểm, bản xem lại chỉ tồn tại trong phiên trang. Kiểm tra này chưa
thay thế một đợt audit trình đọc màn hình hoặc kiểm thử tài khoản thật.
