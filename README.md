# ChessArena

Website cờ vua tiếng Việt bằng React/Vite: giao diện tối và sáng, khu người chơi, trang quản trị nối API thật, thông báo, liên kết Google và tích hợp API tài khoản.

## Chạy và kiểm tra

```sh
npm install
npm run dev
npm test
npm run lint
npm run check:ui
npm run check:stockfish
npm run build
```

Mở URL do Vite in ra. Đổi máy chủ bằng cách sao chép `.env.example` thành `.env.local`, sửa `VITE_API_BASE_URL` và khởi động lại Vite.

Build tự sinh CSS từ DTCG tokens. Có thể chạy riêng `npm run tokens:build`. Trình sinh nằm trong repo, không phụ thuộc đường dẫn skill cài trên máy. Giấy phép upstream: `scripts/vendor/ux-ui-agent-skills.LICENSE`.

`check:ui` render tĩnh các màn hình bằng React SSR, không mở trình duyệt và không gọi API. Kiểm tra này không xác minh bố cục hoặc thao tác trong trình duyệt.

## Tích hợp API tài khoản

Đăng ký, đăng nhập, OTP, gửi email kích hoạt, khôi phục mật khẩu qua token, refresh và logout (một thiết bị hoặc mọi thiết bị).

**Cài đặt → Tài khoản** chia bốn tab:
- **Hồ sơ**: tên, ngày sinh, giới tính, tải ảnh đại diện (PNG/JPEG ≤ 2 MB, chờ admin duyệt).
- **Bảo mật**: bật/tắt 2FA, đổi mật khẩu, email, số điện thoại (mỗi thao tác cần OTP gửi qua email, có nút gửi mã với thời gian chờ 60s), tạo tên đăng nhập/mật khẩu cho tài khoản tạo bằng Google, đăng xuất mọi thiết bị.
- **Liên kết**: liên kết/hủy liên kết Google; hiển thị trạng thái GitHub/Facebook nếu server bật.
- **Xóa tài khoản**: cần OTP `DELETE_ACCOUNT`, gõ `XOA TAI KHOAN` và xác nhận; tài khoản khôi phục được trong 30 ngày.

**Google**: nút Google Identity Services trong hộp đăng nhập/đăng ký. Nếu email đã có tài khoản, server trả `oauth_ticket` và gửi mã liên kết qua email; nhập mã để liên kết rồi đăng nhập. Client ID lấy từ `/oauth/providers/GOOGLE`. Origin chạy app (ví dụ `http://localhost:5173`) phải nằm trong *Authorized JavaScript origins* của OAuth client trên Google Cloud Console, nếu không Google sẽ từ chối hiển thị nút.

**Thông báo**: chuông trên thanh trên cùng đọc `/notification` (khách xem thông báo công khai, đã đăng nhập xem cả thông báo riêng), tự làm mới mỗi 60s và khi quay lại tab, có số chưa đọc, xem chi tiết, "đánh dấu đã đọc tất cả". Thông báo thao tác (toast) hiển thị ở góc màn hình.

Có thể giữ phiên theo tab trong sessionStorage hoặc chỉ giữ trong bộ nhớ đến khi tải lại. Các hợp đồng request được test bằng fetch giả lập. Chưa chạy toàn bộ luồng email/OTP, Google và xóa tài khoản với tài khoản thật.

## Cục bộ và mô phỏng

Bàn cờ, engine, bot, đồng hồ theo lượt, kết quả và xem lại chạy trong trình duyệt. Đồng hồ dùng cho luyện tập, không xác thực thi đấu xếp hạng.

Ghép trận chuyển sang bot. Phòng mời, bạn bè, xếp hạng và thống kê thi đấu là demo. Chat là ghi chú cục bộ. Ván được mở xem lại nằm trong bộ nhớ phiên trang, mất khi tải lại.

## Điều hướng

- Người chơi: #home, #play, #game, #history, #replay, #friends, #leaderboard, #profile, #settings, #help.
- Luồng trận: #invite, #queue, #queue-ready.
- Quản trị: #admin-overview, #admin-users, #admin-roles, #admin-notifications, #admin-blacklist, #admin-journals, #admin-commands, #admin-system (#admin-login cũ tự chuyển về #admin-overview).
- Thông tin: #terms, #privacy. Route khác có màn 404.

Back/Forward dùng hash route. Màn hình debug cũ còn ở `?debug` trong môi trường phát triển.

## Khu quản trị

Trang quản trị dùng hoàn toàn dữ liệu máy chủ (đã bỏ chế độ dữ liệu mẫu). Quyền được kiểm tra qua `/account/admin-access`; khách thấy màn yêu cầu đăng nhập. Các màn: tổng quan thống kê, người dùng (tìm kiếm, chi tiết, khóa/mở, cấp/thu vai trò, thu hồi phiên, duyệt ảnh đại diện), vai trò và quyền, thông báo (soạn/xóa), blacklist, nhật ký, lệnh (command) và hệ thống (dọn dẹp, xóa vĩnh viễn tài khoản chờ xóa).

Mọi thao tác ghi yêu cầu xác minh TOTP trong 10 phút gần nhất: lần đầu quét mã thiết lập trong ứng dụng Authenticator, sau đó nhập mã 6 số khi được hỏi. Chưa kiểm tra thao tác ghi bằng tài khoản ADMIN thật trong lần chỉnh sửa này.

## Tệp chính

- `src/app/ChessArenaApp.jsx`: shell, màn hình và điều hướng.
- `src/features/chess/`: phòng chơi, SVG, clock và replay.
- `src/features/auth/`: biểu mẫu, menu và cài đặt tài khoản.
- `src/components/ui/SelectMenu.jsx`: bộ chọn hỗ trợ bàn phím.
- `src/styles/design-tokens/`: nguồn DTCG.
- `src/services/api/`: HTTP client và hợp đồng tài khoản.
- `src/features/notifications/`: trung tâm thông báo; `src/components/ui/Toaster.jsx`: toast.
- `src/features/admin/`: bảng điều khiển quản trị (AdminConsole) và các trang.
- `src/services/api/admin.js`: tra cứu và thao tác ghi quản trị (yêu cầu TOTP), kiểm tra quyền và cô lập phiên.
- `src/games/chess/`: engine, controller, bot.
- `scripts/check-ui-ssr.mjs`: kiểm tra render tĩnh.
- `docs/ChessArena-design.md`: sitemap, luồng và bàn giao.

Cần dịch vụ realtime, lưu ván, đồng hồ máy chủ, điểm, bạn bè, thao tác quản trị ghi và kiểm thử quyền ADMIN thật trước khi vận hành. Cần kiểm tra đầy đủ bàn phím và trình đọc màn hình; spot check desktop/mobile và render tĩnh không thay thế bước này.

## Font và Stockfish

Font tự host trong `public/fonts/` (giấy phép SIL OFL 1.1): Inter cho nội dung, Montserrat đậm cho tiêu đề; cả hai hỗ trợ đầy đủ dấu tiếng Việt và được tách theo subset. Bot mặc định là Stockfish.js 19 Lite WebAssembly trong Worker với sáu cấp từ Mới bắt đầu đến Bậc thầy. Mỗi cấp dùng Skill Level, depth và thời gian riêng, không gán Elo giả.

Xem `docs/Stockfish-fonts.md` cho cấu hình, vòng đời và giới hạn; nguồn, NNUE, GPL, AUTHORS và checksum ở `public/stockfish/`.

## Kiểm thử bảo mật và tải

Prompt và kết quả thực tế ngày 21/11/2026: [prompt](docs/security/SECURITY-TEST-PROMPT.md), [báo cáo](docs/security/SECURITY-TEST-REPORT.md), [bằng chứng JSON](docs/security/security-test-results.json).

`npm run check:security` gọi API thật trong phạm vi cố định, dùng ba tài khoản thử và tải đọc có giới hạn. Chỉ chạy khi các tài khoản thử được phép sử dụng; không đưa lệnh này vào CI tự động. Cấp mật khẩu qua bộ nhớ hoặc biến môi trường `CHESS_AUDIT_PASSWORD`, không ghi vào `.env` hay mã nguồn. Ví dụ PowerShell nhập kín:

```powershell
$taskSecret = Read-Host 'Mật khẩu tài khoản thử' -AsSecureString
$env:CHESS_AUDIT_PASSWORD = [System.Net.NetworkCredential]::new('', $taskSecret).Password
try { npm run check:security }
finally {
  Remove-Item Env:CHESS_AUDIT_PASSWORD -ErrorAction SilentlyContinue
  $taskSecret = $null
}
```

Mỗi lần chạy CLI ghi JSON vào `docs/security/runs/<timestamp>/`. Bài thử có thể làm tài khoản `admin49` bị khóa tạm; dừng khi quan sát cơ chế bảo vệ. Đây là kiểm tra giới hạn, không xác nhận sức chứa 50 người đồng thời. Repo chỉ chứa frontend; chính sách khóa, hạn phiên và xoay khóa ký cần được sửa/xác minh trong backend.

Chủ hệ thống đã làm rõ: yêu cầu mỗi ngày là đổi **khóa ký JWT nội bộ**, không ép user đăng nhập lại hằng ngày. Báo cáo security đã sửa nhận định này; chưa có mã/log backend để xác minh rotation thực tế.

### Tải mỗi luồng một user

`npm run check:load` dùng cùng biến môi trường mật khẩu nhập kín ở trên. Thay lệnh trong khối `try` bằng `npm run check:load`. Script đăng nhập một lần cho tối đa 50 tài khoản đã được cấp, mỗi luồng giữ một user riêng và liên tục đọc `/account/me` sau khi response trước đã hoàn tất. Không lặp login trong vòng tải.

Đo 20 request trước và 20 request sau bằng cùng user/endpoint; tải tăng 1/5/10/25/50 luồng, mỗi mức tối đa 8 giây hoặc 3.000 request. Tổng giới hạn 10.000 request, dự phòng logout; dừng sớm khi có 429/503, chuỗi lỗi hoặc timeout. Luồng không có thời gian nghỉ giả lập trong pha tải. Tài khoản chưa xác thực hoặc trùng chủ thể bị loại, báo cáo ghi số luồng thực tế.

Khi gặp 429, runner tôn trọng Retry-After hoặc dùng 60 giây nếu thiếu. Chỉ chờ tối đa một cửa sổ 60 giây để thử hồi phục và đo sau cooldown; tải vẫn dừng. Nếu chưa hồi phục, ghi rõ không đo được hoặc chưa logout được, dừng cleanup khi lỗi, không gửi tiếp hàng loạt và không logout mọi thiết bị.

JSON từng request, thống kê mỗi user, p50/p95/p99, throughput và so sánh trước/sau nằm ở `docs/security/load-runs/<timestamp>/load-results.json`. Lệnh chạy thật gọi API và chỉ logout các phiên vừa tạo, không chạy tự động trong CI. Kết quả tổng hợp mới nhất: [LOAD-TEST-REPORT.md](docs/security/LOAD-TEST-REPORT.md).
