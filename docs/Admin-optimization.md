# Tối ưu khu quản trị ChessArena

Cập nhật 22/11/2026, Asia/Bangkok. Mở http://localhost:5173/#admin-login và chọn dữ liệu mẫu hoặc máy chủ. Thiết kế giữ Be Vietnam Pro, bảng màu xanh và CSS tokens dùng chung; dashboard ưu tiên công việc cần xử lý, sau đó tới bảng chi tiết.

## Rà soát và thay đổi

| Mức | Vấn đề trước | Kết quả |
| --- | --- | --- |
| Cao | Tất cả trang quản trị chỉ là demo | Thêm nguồn máy chủ với xác nhận admin-access=true, màn đăng nhập/từ chối/lỗi/thử lại |
| Cao | Hiển thị hàng chục nghìn tài khoản nhưng chỉ có bốn bản ghi, phân trang vô hiệu | Bộ mẫu 12 tài khoản, đếm đúng dữ liệu, phân trang 6/12 dòng và reset khi lọc |
| Vừa | Chưa sắp xếp và tìm kiếm đầy đủ | Tìm không dấu, lọc trạng thái, sort tên/điểm/ngày với aria-sort, empty state và xóa lọc |
| Vừa | Dashboard đặt nhiều số liệu ngang trọng số | Hàng chờ báo cáo dẫn; thống kê tài khoản/trận phụ; tính từ fixture |
| Vừa | Phân quyền không phân biệt nháp và đã lưu | Draft, dirty state, hủy/lưu, giữ nháp khi đổi vai trò, audit event mẫu |
| Vừa | Soạn thông báo thiếu kiểm tra nội dung | Validation, bộ đếm, focus trường lỗi, preview và danh sách đã lưu |
| Vừa | Điều hướng nhanh điện thoại là khu người chơi | Điều hướng admin và danh sách bảy trang trên mobile |
| Nhỏ | Tab admin có tiêu đề giống nhau | Tên trang lấy từ ADMIN_NAV |

Bảy trang mẫu: tổng quan, người dùng, trận đấu, báo cáo, nội dung, phân quyền, nhật ký. Khóa/mở khóa, xử lý báo cáo, lưu thông báo và quyền vẫn dùng state demo trong phiên; các thao tác cập nhật audit. Không ghi thay đổi mẫu lên server.

## Nguồn máy chủ

Service admin.js kiểm tra /account/admin-access, không tin role client; các request song song gộp kiểm tra quyền đang chờ, không cache quyền lâu dài. Response đến sau logout/đổi tài khoản bị loại; refresh access trong cùng phiên vẫn hoạt động.

Danh sách dùng page/pageSize/totalItems/totalPages, thiếu metadata giữ null. Service giới hạn 100 dòng, UI mặc định 10 dòng, tìm kiếm khi submit và làm mới thủ công, không polling. Đọc tài khoản/chi tiết, vai trò/quyền, nhật ký, thông báo và thống kê; không gọi /admin/tokens chứa raw token. Có wrapper blacklist/commands nhưng chưa tạo trang riêng.

UI xử lý lỗi từng panel, không đổi lỗi thành số 0. Trận/báo cáo thật chưa có nguồn API nên hiện trạng thái chưa đồng bộ. Nguồn máy chủ chỉ xem, chưa có khóa/cấp quyền/xóa/xuất bản thật.

## Xác minh

- Unit **71/71 pass**, trong đó **11 test mới** cho admin service: guard, session race, pagination, URL encoding và endpoint; fetch giả.
- ESLint và production build pass. Token compiler giải quyết mọi alias. React SSR **38 render pass**, gồm bảy trang mẫu và bảy cổng API guest; không chạy effects/tương tác.
- Gate hardcodes: 7/7 tệp admin sạch. Emoji/long dash: 7 tệp sạch. Theme references giải quyết tất cả tham chiếu trong bảy tệp. Native select: ba tệp JSX admin sạch.
- Review độc lập guard/session, phát hiện và sửa tiêu đề admin bị trùng.

Kiểm tra trình duyệt thực tế:

1. Vào demo, tổng quan và các trang; tiêu đề tab đổi theo route.
2. Người dùng: trang tiếp hiển thị 7 đến 12 / 12; tìm rỗng có empty state; reset; sort Blitz ascending; tìm Minh Anh, xem detail và Escape đóng.
3. Khóa Minh Anh yêu cầu lý do, xác nhận đổi thành nút mở khóa. Báo cáo rp_0782 chuyển đã xử lý với ghi chú, số chưa kết thúc giảm từ ba xuống hai. Không có API ghi.
4. Nội dung trống có aria-invalid=true và lỗi tiêu đề; nhập/lưu mẫu được. Phân quyền bật/tắt làm nút lưu khả dụng, hủy trả giá trị cũ, lưu tạo audit; tìm thấy thao tác mới.
5. Trận: tìm mã còn một bản ghi, xem lại mở #replay với 64 gridcell.
6. Máy chủ guest yêu cầu login. Login admin0 chỉ nhớ trong bộ nhớ nhận thông báo chưa được cấp quyền; [bằng chứng](screenshots/admin-access-denied.jpg). Đã logout phiên thử trở về guest; không lấy token khỏi trình duyệt để replay.
7. Người dùng ở 390/320 không tràn ngang trang, bảng cuộn trong vùng riêng. Ở 320 gõ h focus Hoạt động và Enter chọn đúng. Nội dung/phân quyền ở điện thoại cũng không tràn ngang. Đã xem desktop 1280 light/dark, khôi phục dark và viewport mặc định.
8. Tab cuối không có console error, mở tổng quan demo; [ảnh toàn trang](screenshots/admin-overview-desktop.jpg).

## Giới hạn

Đã kiểm tra trực tiếp guest và server-denied với USER. Chưa có token ADMIN thật để kiểm tra dữ liệu sau gate, schema hàng và quyền riêng từng endpoint. Các field phổ biến có fallback nhưng cần đối chiếu response được cấp quyền trước vận hành. Không tự tăng role.

Responsive/bàn phím là spot check; chưa chạy toàn bộ axe/render gates, screen reader hoặc mọi tổ hợp trạng thái. Không tuyên bố đạt đầy đủ WCAG. Palette giữ nguyên; chưa đo lại toàn bộ hover/focus contrast sau ghép.

Không chạy tải/dò mật khẩu trong lượt này, không sửa backend/config/database. Tài liệu security và tải cũ được giữ riêng. Thay đổi mẫu mất khi reload, còn trang máy chủ vẫn yêu cầu quyền server.
