# ChessArena: thiết kế và bàn giao

Cập nhật khu quản trị ngày 22/11/2026: xem [Admin-optimization.md](Admin-optimization.md) cho nguồn dữ liệu máy chủ chỉ xem, guard quyền, bảy màn demo được tối ưu và kết quả xác minh mới. Những mô tả prototype bên dưới ghi lại giai đoạn trước, không thay thế phạm vi mới.

## Định hướng và hệ thống

Đối tượng là người mới và người chơi muốn thi đấu theo nhịp thời gian. Giao diện tập trung, nền than chì, bề mặt xám ngả xanh và xanh lá làm màu nhấn. Lỗi/cảnh báo có màu riêng cùng nhãn. Tiêu đề và nội dung dùng Be Vietnam Pro tự host, đầy đủ tiếng Việt; đồng hồ dùng monospace. Có sáng/tối và giảm chuyển động.

Mobile ưu tiên bàn cờ và đồng hồ. Lịch sử/ghi chú có tab đặt sau bàn; ẩn thanh điều hướng nhanh trong ván. Bố cục dày thông tin chỉ mở thành nhiều cột khi đủ chỗ. Font và Stockfish đã được spot check trực tiếp; xem docs/Stockfish-fonts-validation.md cho phạm vi.

Nguồn token chuẩn: src/styles/design-tokens gồm colors, typography, spacing, borders, motion, breakpoints, shadows và sizing. Chạy npm run tokens:build; không sửa CSS sinh tự động.

Component dùng lại: PageTitle, DemoBadge, Metric, SelectMenu, native dialog, AuthDialog, AccountMenu, PieceArt, ChessBoard, MoveHistory, bảng dữ liệu, button variants và switch. SelectMenu có mũi tên/Home/End/Enter/Space/Escape/Tab. Bàn cờ dùng roving focus, có chạm chọn và HTML drag/drop. Đây là hành vi trong code, chưa xác minh bằng trình duyệt.

## Sitemap và luồng

~~~mermaid
flowchart TD
  Home["Tổng quan #home"] --> Auth["Đăng ký / Đăng nhập"]
  Auth --> Verify["OTP / Xác nhận email"]
  Verify --> Home
  Auth --> Forgot["Quên mật khẩu"]
  Forgot --> Reset["Email → /forgot/token → Mật khẩu mới"]
  Reset --> Auth
  Home --> Play["Chọn chế độ #play"]
  Play --> Queue["Ghép trận demo #queue"]
  Queue --> Ready["Bot thử nghiệm #queue-ready"]
  Queue -->|Hủy| Play
  Ready --> Game["Ván cục bộ #game"]
  Play -->|Luyện máy| Game
  Play --> Invite["Phòng mời demo #invite"]
  Invite -->|Thử với bot| Game
  Game --> Result["Kết quả"]
  Result --> Replay["Xem lại #replay"]
  Result -->|Tái đấu| Game
  Result -->|Trận mới| Play
  Home --> History["Lịch sử #history"]
  History --> Replay
  Home --> Community["Bạn bè / Xếp hạng"]
  Home --> Profile["Hồ sơ / Cài đặt"]
  Home --> Admin["Cổng quản trị demo"]
  Admin --> Reports["Báo cáo"]
  Reports --> Review["Bằng chứng / Ghi chú / Xác nhận"]
  Review --> Audit["Nhật ký"]
~~~

Quản trị còn có tổng quan, người dùng, trận đấu, nội dung và phân quyền. Hash route hỗ trợ liên kết sâu và Back/Forward. Route sai có 404. Chưa mở demo mà vào link quản trị sẽ thấy cổng truy cập.

## Phạm vi màn hình

| Nhóm | Hành vi |
| --- | --- |
| Tổng quan | CTA, chế độ nhanh, phong độ và lịch sử mẫu |
| Tài khoản | lỗi tại trường, hiện/ẩn mật khẩu, loading/API error, consent, OTP/gửi lại đếm chờ, reset và token lỗi |
| Chọn trận | Ranked/Friend/Practice, Bullet/Blitz/Rapid, hủy ghép, tìm thấy bot demo |
| Phòng mời | sao chép có kiểm tra thành công/lỗi, nhập mã mẫu, chờ mô phỏng |
| Thi đấu | luật, lượt, ô hợp lệ, chiếu, nước vừa đi, quân bị bắt, clock, phong cấp, lật bàn, âm thanh, tab |
| Kết thúc | xác nhận đầu hàng, hòa demo, chiếu hết/hết giờ, kết quả, tái đấu, trận mới, xem lại |
| Xem lại | engine dựng frame; tiến/lùi, đầu/cuối, chọn nước, đổi góc nhìn |
| Cộng đồng | tìm/lọc, nhận/từ chối lời mời, hồ sơ mẫu, thách đấu/báo cáo demo, xếp hạng theo nhịp/kỳ |
| Lịch sử | lọc kết quả/chế độ/thời gian; ván trong phiên nếu đã mở xem lại |
| Hồ sơ | tên/email API; điểm và biểu đồ mẫu |
| Cài đặt | theme nhớ thiết bị, ba màu bàn, âm thanh; tên và đổi mật khẩu API; tùy chọn riêng tư/thông báo demo |
| Admin người dùng | tìm/lọc, chi tiết, khóa/mở khóa có lý do và xác nhận |
| Admin trận | tìm/lọc, mở trình xem lại mẫu |
| Admin báo cáo | bằng chứng minh họa, ghi chú bắt buộc, cập nhật và nhật ký |
| Admin nội dung | lưu thông báo demo, hiện trong chuông và danh sách phiên |
| Admin quyền/nhật ký | hai vai trò có cấu hình riêng, giữ state phiên; tìm thao tác và đối tượng |

Fixture không phản ánh máy chủ. Các hàng lịch sử mẫu mở cùng khai cuộc hợp lệ để thử trình phát, không phải bản lưu trận từ API.

## Ranh giới backend

API tài khoản được triển khai theo tài liệu /api/dev đã đọc:

- POST /auth/login, /auth/register, /auth/logout, /auth/refresh-token.
- GET và PUT /account/me cho hồ sơ và tên.
- GET /account/otp?purpose=LOGIN hoặc CHANGE_PASSWORD; GET /account/active.
- GET /account/forgot-password/identifier; POST /account/forgot-password.
- POST /account/change-password.

Base từ VITE_API_BASE_URL. Không có mật khẩu hay khóa thật trong source. Hợp đồng request được test bằng fetch giả lập; chưa chạy email/OTP với tài khoản thật.

Yêu cầu hồ sơ và refresh đồng thời được gộp theo phiên. Refresh sau logout không phục hồi phiên cũ. Lựa chọn chỉ giữ trong bộ nhớ được giữ cả khi refresh.

Engine và replay dùng cùng reducer, kể cả nhập thành/phong cấp. Đồng hồ trừ thời gian giữa tick và chỉ cộng increment sau nước hoàn tất. Bot/timer được dọn khi rời phòng. Đây là đồng hồ cục bộ.

Ghép trận vào bot; mã phòng không nối trình duyệt khác. Bạn bè, xếp hạng, thống kê, quản trị là demo. Cổng admin không tạo auth session hoặc sửa roles, không phải cơ chế phân quyền bảo mật. Nhật ký không phải bằng chứng kiểm toán. Chat là ghi chú. Tùy chọn riêng tư/thông báo chỉ minh họa điều khiển, chưa được dịch vụ máy chủ áp dụng.

Cần backend thật cho phòng/realtime/reconnect, xác thực nước đi và clock, lưu ván/PGN, điểm, bạn bè/chat/báo cáo và kiểm tra quyền admin. Repository chỉnh ở đây là frontend; không tuyên bố đã tối ưu máy chủ hoặc triển khai các dịch vụ đó.

## Nhánh lỗi

- Form sai: lỗi tại trường, focus đầu tiên và giữ giá trị khác.
- API chậm/lỗi: đang gửi, thông báo và gửi lại.
- Token hết hạn: refresh một lần, không retry vô hạn.
- Logout/đổi phiên giữa refresh: không phục hồi phiên cũ.
- Reset token sai/hết hạn: lỗi API, lối yêu cầu link mới.
- Offline: banner; bot cục bộ vẫn hoạt động.
- Lọc không kết quả: trạng thái trống theo fixture.
- Clipboard bị chặn: báo lỗi, giữ mã để chọn thủ công.
- Rời ván từ phòng: xác nhận và lối mở xem lại.
- Chưa mở admin demo: cổng truy cập. Route sai: 404.

## Kế hoạch xác minh

Bổ sung hiện tại: Be Vietnam Pro và sáu cấp Stockfish đã được triển khai/kiểm tra. Báo cáo mới: docs/Stockfish-fonts-validation.md. Ghi chú chưa mở được browser phía dưới là lịch sử phiên prototype trước.


Đã có unit test engine/API/clock/replay và render tĩnh các trang. Token JSON, alias CSS và các cặp màu chính được kiểm tra bằng công cụ UX/UI Agent Skills.

Trình duyệt từ chối quyền mở địa chỉ local trong lần này. Không coi overflow, kích thước vùng chạm sau render, focus trap thực tế, axe/WCAG tổng thể, desktop/mobile hoặc drag/drop là đã qua kiểm tra.

Khi được phép mở preview:

1. Ở 360, 390, 768, 1440 CSS pixel: chọn chế độ và luyện bot. Bàn vuông, đồng hồ rõ, điều hướng không che ô.
2. Dùng bàn phím chọn quân, phong cấp, lật bàn, đầu hàng và xem lại. Focus nhìn thấy và kết quả đúng.
3. Dùng tài khoản thử do chủ dự án cấp: lỗi trường, bị khóa, OTP sai/hết hạn, reset link hết hạn.
4. Cập nhật báo cáo admin có ghi chú; kiểm tra trạng thái và nhật ký.
5. Khóa/mở khóa mẫu, lưu từng vai trò, chuyển trang rồi kiểm tra state.
6. Lưu thông báo và mở chuông; thử nội dung dài, trống và clipboard bị chặn.
7. Chạy render gates/axe thực tế cho sáng/tối, giảm chuyển động và trình đọc màn hình. Không đổi bước thiếu trình duyệt thành pass.
