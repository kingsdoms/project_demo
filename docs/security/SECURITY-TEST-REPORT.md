# Kiểm thử bảo mật và tải ChessArena — 21/11/2026

Đã chạy kiểm thử thực tế theo [prompt](SECURITY-TEST-PROMPT.md), đồng thời rà soát mã và sửa một lỗi race của logout. Chưa tái hiện vượt chữ ký JWT hoặc truy cập API admin bằng token USER. Đây là đánh giá có giới hạn, không phải chứng nhận toàn bộ hệ thống an toàn. Đã sửa cách hiểu ngày 21/11/2026 theo chủ hệ thống: yêu cầu hằng ngày là đổi khóa ký JWT nội bộ, không phải ép user đăng nhập lại. Số liệu dưới đây giữ nguyên đợt đã chạy; bài tải mới mỗi luồng một user được đo và báo cáo riêng.

Đợt tiếp theo đã chạy đủ 50 tài khoản riêng, có thống kê trước/sau hồi phục và gặp 429 ở mức 50 luồng: [báo cáo tải theo từng user](LOAD-TEST-REPORT.md). Những kết quả mới không sửa lại số liệu lịch sử bên dưới.

## Phạm vi và bằng chứng

- Frontend: http://localhost:5173/; backend: https://thesaurus-divinity-cosigner.ngrok-free.dev/api.
- Đợt API chính: 18:22–18:38 ngày 21/11/2026, Asia/Bangkok, tương ứng 11:22–11:38 UTC. Có bước đọc tài liệu trước đó.
- Dùng admin0, admin48, admin49 qua API; admin2 để kiểm tra UI. Không thử toàn bộ 50 tài khoản.
- [JSON tổng hợp](security-test-results.json): 160 request HTTP lập trình có log, gồm 94 từ runner đầu, 65 xác minh/đo lại/dọn phiên, 1 đọc tài liệu trước đợt. Số request API của trình duyệt không được instrument nên không gán một tổng chính xác cho toàn bộ UI. Thao tác do người dùng tự thực hiện trong tab khác không thuộc log này.
- Không lưu mật khẩu, JWT, refresh token, Authorization, cookie, uid hoặc body hồ sơ. Ảnh dùng tên tài khoản thử, không có mật khẩu/token.
- Mã backend không có trong repo. Không thay đổi chính sách khóa/expiry/key rotation trên máy chủ; chỉ sửa frontend và bổ sung công cụ kiểm thử.

Phân loại 19 nhóm kiểm tra: **9 PASS, 2 FAIL, 5 INCONCLUSIVE, 3 NOT_TESTED**. Hai FAIL là lệch quyền của dữ liệu thử so với kỳ vọng admin và thiếu header chống cache rõ ràng, không phải hai lần khai thác thành công. Danh sách đầy đủ cùng nhãn request nằm trong trường `checks` của JSON.

## Kết quả xác thực và quyền

| Kiểm tra | Quan sát | Kết luận |
| --- | --- | --- |
| Login đúng | Ba tài khoản API đều 200, có access/refresh, không yêu cầu OTP/activation | PASS |
| Hồ sơ chính chủ | Token hợp lệ đọc /account/me trả 200 | PASS |
| Không token | /account/me, /account/admin-access và các admin read được thử trả 401 | PASS |
| Quyền thực | admin0/admin48/admin49 nhận roles USER; admin0/admin48 có admin-access=false; UI admin2 hiển thị USER | FAIL so với kỳ vọng là admin; chưa có bằng chứng quyền ADMIN thật |
| USER gọi admin | Năm admin read có token USER đều 403 | PASS: chặn người dùng thường ở các route đã thử |
| JWT none, sửa payload, sửa chữ ký | Cả ba đều 401 trên /account/me; cùng route có baseline token thật 200 | PASS cho những mẫu này |
| Đầu vào âm tính | Sai kiểu và thiếu trường trả 422; hai chuỗi có dạng injection trả 400 | PASS cho bốn mẫu; không chứng minh mọi truy vấn backend an toàn |

Các nhãn `admin-read` trong log đầu là tên ca thử, **không** khẳng định token có quyền admin. Trang quản trị frontend vẫn là demo với state cục bộ, không gửi thay đổi quyền hoặc khóa tài khoản thật. Mở demo không phải bằng chứng vượt quyền máy chủ.

## Chống dò mật khẩu

Trên admin49, login đúng ban đầu thành công. Sau đó gửi đúng sáu mật khẩu sai, tuần tự khoảng một lần/giây. Năm phản hồi đầu: 401, body 62 byte; phản hồi thứ sáu: 401, body 77 byte. Một lần dùng lại mật khẩu đúng ngay sau đó cũng 401, body 77 byte.

**INCONCLUSIVE về cơ chế khóa:** mẫu này phù hợp với một thay đổi trạng thái bảo vệ nhưng runner đầu chưa ghi message lỗi, nên không thể xác nhận nguyên nhân, ngưỡng, cửa sổ đếm hoặc thời gian mở khóa từ status/kích thước body. Không thấy 429 trong các request này; điều đó không chứng minh thiếu rate limit. Không thử sai thêm và không tự mở khóa. **admin49 có thể đang bị khóa tạm.**

Runner đã được sửa để lưu thông báo đã che, dừng khi có bằng chứng khóa/challenge, và không coi mọi 403 hoặc login đúng thất bại là PASS. Muốn chốt bài này cần cấu hình/log backend và một đợt thử mới sau thời hạn khóa được xác nhận. Thiết kế nên có ngưỡng/cửa sổ/thời gian khóa rõ ràng và cân bằng account/IP để giảm khả năng khóa nhầm người dùng. [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling).

## Token, refresh và xoay khóa ký nội bộ mỗi ngày

Token quan sát dùng HS256, claims gồm uid/roles/exp, không có iat. HS256 tạo chữ ký/MAC bằng secret nội bộ; JWT quan sát không mã hóa nội dung claims. Metadata lúc login: access còn **18.000 giây = 5 giờ**, refresh còn **2.592.000 giây = 30 ngày**. Đây là thông tin vòng đời phiên user, không phải lỗi so với yêu cầu xoay key nội bộ hằng ngày, cũng không chứng minh token sẽ thực sự tồn tại đủ thời gian đó trước các cơ chế thu hồi khác.

Chủ hệ thống đã làm rõ ngày 21/11/2026 rằng key cần thay khi sang ngày mới là secret ký access token nội bộ máy chủ, không yêu cầu user đăng nhập lại mỗi ngày. Tài liệu /api/dev nói khóa ký đổi lúc nửa đêm, chấp nhận khóa cũ qua một lần xoay, và restart làm token cũ mất hiệu lực. **Chưa xác minh rotation thực tế**: không có mã/cấu hình backend, secret hoặc log rotation, chưa quan sát qua nửa đêm/restart và chưa xác định múi giờ server. Rotation không tự chứng minh secret không thể bị rò; không thực hiện dò key hoặc cố lấy secret.

Các quan sát khác:

- Refresh đúng trả 200. Cùng refresh token được dùng lại hai lần; API chỉ trả access mới. Chưa có bằng chứng refresh rotation/reuse detection.
- Access của A ghép với refresh của B trả 200 ở cả hai chiều admin0/admin48. JWT mới có uid của **chủ refresh B**, khác uid của chủ access A; dùng JWT mới đọc /account/me được 200. Không lưu uid/token. Hai hồ sơ có cùng tên hiển thị nên không dùng so sánh tên làm bằng chứng chủ thể.
- Mixed-pair được chấp nhận là một điểm cần xác định hợp đồng. Người thử vốn sở hữu refresh của B; **không chứng minh chỉ có access A là chiếm được B**. Nếu yêu cầu access và refresh phải cùng chủ, backend cần đối chiếu uid/session. Nếu refresh là bearer độc lập theo thiết kế, phải mô tả rõ và bảo vệ/thu hồi nó tương ứng.
- Sau logout của năm phiên API do bài thử tạo: logout 200, refresh cũ đều 401. PASS về thu hồi refresh trong phạm vi này.
- Access JWT cũ vẫn đọc /account/me được 200 ngay sau logout, đúng như tài liệu công bố. Với hạn access 5 giờ, cửa sổ còn lại có thể dài; chưa chờ đến exp. Chưa chứng minh thu hồi access tức thời.

Đề xuất xác minh backend đúng yêu cầu: kiểm tra múi giờ và lịch rotation, sinh key mới khi qua biên ngày, chỉ giữ/chấp nhận các phiên bản key trong cửa sổ được thiết kế, không log hoặc gửi secret ra client. Dùng clock kiểm soát để test ngay trước/sau nửa đêm, lần xoay thứ nhất/thứ hai và restart; chỉ ghi metadata/định danh phiên bản key đã che. Giữ kiểm tra exp/refresh/logout theo hợp đồng riêng; không áp thêm hạn đăng nhập 24 giờ. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-expiration).

Nếu cần vô hiệu hóa access ngay khi logout, kiểm tra trạng thái phiên/version hoặc denylist phía server. Chưa triển khai những thay đổi này vì không có mã backend. [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#jwt).

## Tải có giới hạn

Đợt đo đúng dùng luân phiên **/oauth/providers** và **/account/me** của chính tài khoản thử. Đã xác nhận cả hai có baseline 200.

| RPS mục tiêu | RPS bắt đầu thực | Hoàn tất | HTTP 200 | Median | p95 | Max | Đồng thời lớn nhất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1,00 | 16 | 16 | 88 ms | 457 ms | 457 ms | 1 |
| 2 | 2,03 | 16 | 16 | 89 ms | 97 ms | 97 ms | 1 |
| 4 | 4,00 | 16 | 16 | 89 ms | 92 ms | 92 ms | 1 |

48/48 phản hồi 200, không timeout hoặc 5xx trong đợt này. Độ trễ đo từ lúc gửi tới khi đọc hết body. p95 lấy nearest rank trên 16 mẫu/mức, nên là quan sát nhỏ; có ảnh hưởng mạng/ngrok, không đủ làm SLA. API nhanh nên mức đồng thời thực chỉ đạt 1 dù giới hạn cho phép 3. **Không suy ra chịu được 50 người đồng thời hoặc tải cực đại.** Không có CPU/RAM/DB/pool metrics.

Lần tải đầu script đã chọn nhầm /api/ trả 404 dù baseline cũng 404; 18/48 request là 404 do đích thử sai. Đã sửa đích, giữ [snapshot đầu](security-test-results.initial.json) để đối chiếu, và chỉ đo lại phần tải. Tổng hai đợt: 96 request tải, gồm 18 phản hồi 404 do cấu hình bài thử. Không coi đây là lỗi sức tải của backend.

Giới hạn triển khai cần công khai: runner đầu 94 request và đợt tải sửa đều được pacing; 13 request chức năng xác minh đầu tiên chỉ chạy tuần tự, helper chưa giới hạn toàn cục 4 RPS. Các request bổ sung sau đó đã đặt tối thiểu 250 ms. Không khẳng định toàn bộ đợt có trần 4 RPS đã đo. Script bàn giao đã sửa điều phối, dự phòng cleanup và dừng sau 429; regression mô phỏng đã xác nhận không gửi tiếp khi bị rate limit. Chưa chạy lại toàn bộ script phiên bản cuối lên API, để tránh thêm lần dò/khóa tài khoản không cần thiết.

## Lỗi đã sửa và hardening còn lại

**Đã sửa P2 ở frontend:** logout A đang chờ, login B, phản hồi logout A về có thể xóa B. auth.js kiểm tra đúng identity phiên trước khi xóa; AccountMenu kiểm tra cả phiên client và store trước khi xóa UI/thông báo. Regression xác nhận cả thành công muộn và lỗi mạng muộn đều giữ B; logout hiện tại vẫn xóa phiên cục bộ khi server lỗi.

**Thiếu header chống cache rõ ràng:** các response login/account được quan sát không có Cache-Control: no-store. Bổ sung phía server cho dữ liệu token/hồ sơ. Đây là thiếu hardening đã quan sát, chưa có bằng chứng cache thực sự làm lộ dữ liệu.

**Lưu token:** mặc định frontend dùng sessionStorage, đọc được bằng JavaScript; có tùy chọn chỉ lưu bộ nhớ. Chưa tìm thấy sink innerHTML/dangerouslySetInnerHTML trong luồng sản phẩm đã rà soát; React render text. Chưa chứng minh XSS hay đánh cắp token. Có thể chuyển refresh sang HttpOnly/Secure/SameSite cookie khi backend hỗ trợ, đồng thời thiết kế CSRF/CORS phù hợp; không thể làm bằng đổi storage frontend đơn thuần.

**CORS:** quan sát wildcard origin, không thấy allow-credentials. API dùng Bearer; wildcard đơn lẻ không chứng minh đọc được hồ sơ khi không có token.

Thứ tự xử lý: xác nhận quyền/seed của tài khoản admin; xác minh rotation của key ký nội bộ qua ngày và cách giữ secret ở backend; xác minh cấu hình khóa và thông báo; quyết định hợp đồng mixed refresh/rotation và thu hồi access theo yêu cầu; bổ sung no-store và cách lưu refresh phù hợp. Dữ liệu thử dùng mật khẩu chung cần được tách khỏi môi trường vận hành và quản lý riêng trước khi phát hành.

## Kiểm tra UI, mã và dọn dẹp

UI admin2: type=password, login thành công, reload vẫn có hồ sơ, mở xác nhận logout, sau logout hiện nút Đăng nhập. [Ảnh sau reload](screenshots/auth-persisted.jpg). Không lưu password/token vào ảnh. Chưa kiểm tra UI hết hạn thật hoặc in-memory qua reload; unit test không thay thế các bước đó.

Kiểm tra cục bộ cuối: **54/54 tests**, không fail/skip; ESLint và build pass; 31 màn SSR pass. Trong đó bốn test mới kiểm tra phân loại OTP/lock/error, che bí mật và dừng request sau 429 bằng fetch giả. Những test này không gọi API thật; 31 render SSR không phải kiểm tra tương tác trình duyệt.

Năm phiên API do bài thử tạo đều đã logout và xác nhận refresh cũ bị 401. Phiên UI admin2 đã logout, có trạng thái guest trực quan; không lấy token trình duyệt để kiểm tra replay. Không logout mọi thiết bị, không tác động phiên người dùng đang thao tác ở tab khác. admin49 có thể đang khóa tạm; không tự mở khóa.

Chưa thử OTP/email, đổi mật khẩu/role, xóa dữ liệu, tải ghi, stress/soak 50 người, toàn bộ payload XSS/SQLi, RCE hay dò khóa ký. Các mục thiếu bằng chứng giữ NOT_TESTED/INCONCLUSIVE. Script hữu hạn và cách chạy lại nằm trong README; JSON của các lần chạy sau được lưu ở thư mục timestamp riêng.
