# ChessArena

Website cờ vua tiếng Việt bằng React/Vite: chơi trực tuyến qua REST/WebSocket, giao diện tối và sáng, trang quản trị nối API, thông báo, liên kết Google và tài khoản.

Luồng cờ hiện tại dùng máy chủ làm nguồn luật, nước đi hợp lệ, đồng hồ và kết quả. Sảnh có ba chế độ: cờ tiêu chuẩn hai người (10 phút + 5 giây), luyện tập với bot của máy chủ (không đồng hồ), và mở rộng theo season với nhân vật, thẻ bài, thời tiết. Bàn cờ hỗ trợ bấm, kéo thả, bàn phím và tự xoay theo phe.

Chi tiết triển khai, bằng chứng kiểm tra và các bước nghiệm thu trực tiếp: [online-client.md](docs/chess/online-client.md). Các tài liệu thiết kế trước ngày 25/11/2026 lưu lại quá trình thiết kế, không mô tả hợp đồng cờ online hiện tại.

## Chạy và kiểm tra

```sh
npm ci
npm run dev
npm test
npm run lint
npm run check:ui
npm run build
```

Mở URL do Vite in ra. Đổi máy chủ bằng cách sao chép `.env.example` thành `.env.local`, sửa `VITE_API_BASE_URL` và khởi động lại Vite.

API mặc định: `https://thesaurus-divinity-cosigner.ngrok-free.dev/api`. WebSocket được suy ra thành `wss://thesaurus-divinity-cosigner.ngrok-free.dev/api/chess/ws`; token gửi trong frame `AUTH` đầu tiên, không nằm trong URL. Danh sách bot, season và số liệu sảnh được lấy từ API; không cần đăng nhập để xem sảnh, cần đăng nhập để bắt đầu chơi.

Build tự sinh CSS từ DTCG tokens. Có thể chạy riêng `npm run tokens:build`. Trình sinh nằm trong repo, không phụ thuộc đường dẫn skill cài trên máy. Giấy phép upstream: `scripts/vendor/ux-ui-agent-skills.LICENSE`.

`npm run check:chess-browser` chạy các luồng tương tác desktop/mobile với REST và WebSocket giả lập; cần mở Vite trước và có Playwright (hoặc runtime kèm Codex) cùng Chromium/Edge. Script không đăng nhập máy chủ thật. Thêm `-- --live-public` để kiểm tra đọc API công khai từ trình duyệt, không gửi thông tin đăng nhập.

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

## Cờ trực tuyến

Client chỉ gửi ý định; không tính luật cờ và không cập nhật quân trước khi server xác nhận. Mỗi `STATE`/`EVENTS` thay toàn bộ snapshot. `legal_moves` là nguồn duy nhất cho chọn quân và ô đích. Events phục vụ hoạt ảnh và lịch sử nước đi của phiên hiện tại; tải lại trang không có lịch sử cũ từ server.

Mất kết nối thì tự thử lại với khoảng chờ tăng dần, tối đa 30 giây. Snapshot sau xác thực khôi phục bàn đang chơi. Khi nhận `REPLACED`, tab cũ dừng tự nối và hiện nút **Dùng ở đây**. Token sắp hết hạn được refresh trước khi mở socket.

Phong cấp trước nước đi và sau kết nối lại, xin/nhận/từ chối hoà, xác nhận đầu hàng và hộp kết quả đều gửi theo giao thức server. Chế độ mở rộng có trang xem season, chọn nhân vật/thẻ với đếm lùi, đổi bài, kỹ năng theo hồi chiêu, thanh vòng và hiệu ứng trên ô/quân/trận. Mã nội dung chưa biết được hiển thị nguyên mã.

Server chưa hỗ trợ tên/ảnh đối thủ, lịch sử trận, xếp hạng, khán giả, phòng mời, đấu lại, lựa chọn thời gian hay bot mở rộng. Giao diện không tạo màn demo cho các chức năng này. Engine và Stockfish cục bộ còn trong repo phục vụ phần debug/kiểm thử cũ, không chạy trong luồng cờ online mặc định.

## Điều hướng

- Người chơi: #home, #play, #profile, #settings, #help.
- Luồng trận: ván/hàng chờ do trạng thái WebSocket quyết định. #game hoặc #queue khi chưa có ván/hàng chờ hiện sảnh.
- Quản trị: #admin-overview, #admin-users, #admin-roles, #admin-notifications, #admin-blacklist, #admin-journals, #admin-commands, #admin-system.
- Thông tin: #terms, #privacy. Route khác có màn 404.

Back/Forward dùng hash route. Màn hình debug cũ còn ở `?debug` trong môi trường phát triển.

## Khu quản trị

Trang quản trị dùng hoàn toàn dữ liệu máy chủ (đã bỏ chế độ dữ liệu mẫu). Quyền được kiểm tra qua `/account/admin-access`; khách thấy màn yêu cầu đăng nhập. Các màn: tổng quan thống kê, người dùng (tìm kiếm, chi tiết, khóa/mở, cấp/thu vai trò, thu hồi phiên, duyệt ảnh đại diện), vai trò và quyền, thông báo (soạn/xóa), blacklist, nhật ký, lệnh (command) và hệ thống (dọn dẹp, xóa vĩnh viễn tài khoản chờ xóa).

Mọi thao tác ghi yêu cầu xác minh TOTP trong 10 phút gần nhất: lần đầu quét mã thiết lập trong ứng dụng Authenticator, sau đó nhập mã 6 số khi được hỏi. Chưa kiểm tra thao tác ghi bằng tài khoản ADMIN thật trong lần chỉnh sửa này.

## Tệp chính

- `src/app/ChessArenaApp.jsx`: shell, màn hình và điều hướng.
- `src/features/chess/online/`: sảnh, phòng online, bàn cờ theo snapshot, đồng hồ và các bảng season.
- `src/services/chess/`: REST cờ và vòng đời WebSocket, hàng chờ, reconnect, đồng bộ snapshot/events.
- `src/features/chess/ChessBoard.jsx`: SVG quân dùng chung; các màn cờ cũ nằm cùng thư mục, không thuộc luồng mặc định.
- `src/features/auth/`: biểu mẫu, menu và cài đặt tài khoản.
- `src/components/ui/SelectMenu.jsx`: bộ chọn hỗ trợ bàn phím.
- `src/styles/design-tokens/`: nguồn DTCG.
- `src/services/api/`: HTTP client và hợp đồng tài khoản.
- `src/features/notifications/`: trung tâm thông báo; `src/components/ui/Toaster.jsx`: toast.
- `src/features/admin/`: bảng điều khiển quản trị (AdminConsole) và các trang.
- `src/services/api/admin.js`: tra cứu và thao tác ghi quản trị (yêu cầu TOTP), kiểm tra quyền và cô lập phiên.
- `src/games/chess/`: engine, controller và bot cục bộ cho debug/kiểm thử cũ.
- `scripts/check-ui-ssr.mjs`: kiểm tra render tĩnh.
- `docs/chess/online-client.md`: hợp đồng tích hợp, kiểm chứng và checklist nghiệm thu cờ online.

Các kiểm tra tự động và fixture không thay thế nghiệm thu ván thật bằng hai tài khoản. Chưa xác minh toàn bộ luồng WebSocket có đăng nhập, email/OTP, Google, quyền ADMIN ghi và trình đọc màn hình trên máy chủ thực tế; xem phạm vi cụ thể trong tài liệu bàn giao.

## Font và Stockfish

Font tự host trong `public/fonts/` (giấy phép SIL OFL 1.1): Inter cho nội dung, Montserrat đậm cho tiêu đề; cả hai hỗ trợ đầy đủ dấu tiếng Việt và được tách theo subset. Bản Stockfish.js 19 Lite WebAssembly và sáu cấp cũ vẫn được giữ để tương thích debug, kèm giấy phép và mã nguồn; đây không phải bot mặc định của luồng online. Đối thủ luyện tập hiện được chọn từ `/chess/bots` và chạy trên máy chủ.

Xem `docs/Stockfish-fonts.md` cho cấu hình, vòng đời và giới hạn; nguồn, NNUE, GPL, AUTHORS và checksum ở `public/stockfish/`.

`npm run check:stockfish` kiểm tra phần Stockfish cũ riêng, không kiểm tra bot của máy chủ.

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
