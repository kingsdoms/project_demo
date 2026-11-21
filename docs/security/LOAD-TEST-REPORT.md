# Tải API theo từng user — 21/11/2026

Đã chạy đúng mô hình mỗi luồng một tài khoản: 50 tài khoản admin0–admin49 đăng nhập thành công, 50 chủ thể JWT khác nhau được đối chiếu trong bộ nhớ, từng token đọc được hồ sơ chính chủ. Mỗi luồng gửi GET /account/me liên tục, chờ đọc hết response rồi mới gửi request kế tiếp, không nghỉ giả lập và không dùng lại một user cho hai luồng trong cùng mức tải.

Mức 25 luồng hoàn tất khoảng 8 giây với 2.310/2.310 HTTP 200, đạt 286,4 response/giây. Mức 50 luồng đạt đồng thời thực tế 50, nhưng gặp HTTP 429 sau khoảng 2 giây và dừng gửi tải mới. Chưa chứng minh duy trì được 50 luồng trong 8 giây hoặc lâu hơn.

## Khóa ký JWT nội bộ

Theo giải thích mới của chủ hệ thống, yêu cầu là **đổi khóa ký access token nội bộ khi sang ngày mới**, không phải buộc user đăng nhập lại hằng ngày. Đã sửa prompt, báo cáo và JSON security trước đó. Thời hạn access 5 giờ, refresh 30 ngày là metadata phiên, không bị đánh giá là sai yêu cầu xoay khóa.

Token đã quan sát dùng HS256, tức chữ ký/MAC; nội dung claims không được mã hóa bởi HS256. API docs hiện mô tả xoay khóa lúc nửa đêm và chấp nhận khóa cũ qua một lần xoay. Chưa có mã/config/log backend hoặc quan sát qua biên ngày để xác minh rotation thực tế. Không lấy hoặc dò khóa ký. Đổi khóa định kỳ không tự chứng minh không thể rò secret; bảo vệ secret và xử lý key bị lộ là yêu cầu riêng. [OWASP JWT](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html), [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).

## Cách đo

- API duy nhất: https://thesaurus-divinity-cosigner.ngrok-free.dev/api; tải chỉ đọc /account/me của các tài khoản thử.
- Runner: 20:12:43–20:14:13 ngày 21/11/2026, Asia/Bangkok, tương ứng 13:12:43–13:14:13 UTC. Đo sau hồi phục hoàn tất 20:17:37.
- Đăng nhập mỗi tài khoản một lần, tối thiểu 500 ms giữa các lần bắt đầu; không login trong vòng tải, không gửi mật khẩu sai.
- Các mức 1/5/10/25/50 luồng; mỗi mức tối đa 8 giây hoặc 3.000 request; tổng trần 10.000 request và dự phòng cleanup. Request đang chờ được đọc xong khi dừng mức, nên thời gian đo gồm phần drain có thể hơn 8 giây.
- Trước tải: 20 request tuần tự, tối thiểu 250 ms giữa các lần bắt đầu, cùng admin0 và /account/me. Sau tải: 20 request cùng tài khoản/endpoint sau khi dịch vụ hồi phục, dùng lần đăng nhập mới.
- Dừng gửi tải mới khi 429/503, ba 5xx liên tiếp, hai response quá 5 giây, lỗi mạng/timeout hoặc sai xác thực. Không refresh/retry tự động để tăng số thành công.
- Các luồng là virtual users bất đồng bộ trong một tiến trình Node trên cùng máy/IP, không phải 50 IP, 50 trình duyệt hoặc 50 máy vật lý. Mỗi user có tối đa một request đang chờ.

Tất cả tài khoản trả role USER; tên admin không chứng minh quyền admin. Bài tải này không gọi truy vấn quản trị, thao tác ghi hoặc dữ liệu người khác. Giải mã uid chỉ để so sánh chủ thể trong bộ nhớ; không lưu uid, token, password, Authorization, cookie hoặc body hồ sơ.

## Kết quả trong tải

| Luồng thực | Thời gian đo | Request | HTTP 200 | HTTP 429 | RPS hoàn tất | RPS 200 | Median | p95 | p99 | Đồng thời lớn nhất |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8,068 s | 89 | 89 | 0 | 11,0 | 11,0 | 89,0 ms | 90,4 ms | 188,5 ms | 1 |
| 5 | 8,043 s | 444 | 444 | 0 | 55,2 | 55,2 | 87,1 ms | 101,8 ms | 183,9 ms | 5 |
| 10 | 8,074 s | 929 | 929 | 0 | 115,1 | 115,1 | 84,8 ms | 90,2 ms | 142,3 ms | 10 |
| 25 | 8,066 s | 2.310 | 2.310 | 0 | 286,4 | 286,4 | 83,8 ms | 96,4 ms | 186,8 ms | 25 |
| 50 | 2,043 s | 942 | 919 | 23 | 461,1 | 449,8 | 86,5 ms | 210,2 ms | 473,4 ms | 50 |

Tổng các mức tải: **4.714 request, 4.691 HTTP 200, 23 HTTP 429**, không 5xx hoặc lỗi transport trong phần tải. 23 phản hồi 429 gồm các request đã đang chờ khi phát hiện phản hồi 429 đầu tiên; không phải tiếp tục gửi vòng tải sau tín hiệu dừng. Max ở mức 50 là 510,3 ms. Thống kê latency của mức này có cả HTTP 429, nên không dùng một mình để mô tả độ trễ giao dịch thành công.

Mức 50 thành công 97,56% trong đoạn đo ngắn trước khi dừng. Không suy ra 461 RPS là khả năng phục vụ thành công bền vững; RPS 200 của đoạn này là 449,8. Mức 25 là mức cao nhất đã hoàn tất toàn bộ cửa sổ đo trong đợt này, không phải giới hạn cực đại của backend.

Không xác định 429 phát sinh từ ứng dụng, proxy/ngrok hay một lớp giới hạn khác; log không có nguồn xác nhận hoặc Retry-After. Các mức chạy nối tiếp và cùng IP nên quota tích lũy/cửa sổ thời gian có thể ảnh hưởng. Chưa đủ bằng chứng kết luận “backend chỉ chịu được 25 user” hoặc “50 user làm backend quá tải”.

## Trước và sau tải

Sau kg | 20/20 | 20/20 | Không lỗi ở hai mẫu |
| Median | 89,101 ms | 88,766 ms | −0,335 ms (−0,38%) |
| p95 | 89,878 ms | 100,597 ms | +10,719 ms (+11,93%) |
| p99 / max | 90,323 ms | 101,655 ms | +11,332 ms (+12,55%) |
| RPS hoàn tất của nhịp đo | 4,041 | 4,066 | +0,025 |

Median không tăng trong mẫu sau hồi phục; p95 tăng khoảng 10,7 ms. Hai mẫu 20 request nhỏ và thời điểm khác nhau, nên không khẳng định biến động này là tác động nhân quả của tải hoặc suy giảm kéo dài. RPS trước/sau bị chủ động giới hạn nhịp đo khoảng 4 RPS, không phải sức tải cực đại.

Độ trễ tính từ fetch bắt đầu tới lúc đọc hết body. Percentile dùng nearest rank trên response HTTP đã hoàn tất. Số liệu bao gồm client, mạng, ngrok và backend; chưa có CPU, RAM, DB latency, số kết nối hoặc queue server để thống kê trước/sau các tài nguyên đó.

## Cleanup và giới hạn của công cụ

Runner đầu đã thử logout 50 phiên vừa tạo sau khi tải dừng: 17 phản hồi 429 và 33 lỗi transport TypeError. **Không phiên nào trong 50 phiên gốc được xác nhận logout thành công.** Không coi lỗi transport này là bằng chứng backend crash. Token không được ghi ra tệp và đã xóa khỏi bộ nhớ runner khi kết thúc, nên không thể thử lại các refresh đó sau cooldown. Không thực hiện logout mọi thiết bị, đổi mật khẩu hoặc thay role để dọn phiên, vì có thể ảnh hưởng phiên khác của chủ tài khoản.

Đây là hạn chế thật của bản runner đã chạy. Sau đợt này, công cụ được sửa để tôn trọng thời gian chờ khi 429 không có Retry-After, chỉ thử hồi phục hữu hạn và dừng cleanup khi tiếp tục lỗi, thay vì gửi tiếp cả hàng cleanup. Thay đổi này được kiểm tra bằng fetch giả; chưa chạy lại toàn bộ tải thật. Người quản trị backend cần kiểm tra/thu hồi các phiên thử còn lại bằng công cụ quản lý phiên phù hợp.

## Tệp và cách chạy lại

- [JSON tổng hợp](load-test-results.json) và [CSV thống kê](load-summary.csv).
- [Request thô đã che bí mật + từng user](load-runs/2026-11-21T13-12-43-644Z/load-results.json).
- [Tiến trình](load-runs/2026-11-21T13-12-43-644Z/progress.json), [probe hồi phục](load-runs/2026-11-21T13-12-43-644Z/recovery-probes.json), [mẫu đo sau hồi phục](load-runs/2026-11-21T13-12-43-644Z/after-recovery.json).

4.908 request có log trong toàn bộ lần này: 4.884 của runner, 1 đọc tài liệu API trước đợt, 1 probe hồi phục, 22 login/read/logout bổ sung; dưới trần 10.000. Bộ dữ liệu security cũ được giữ riêng, không cộng vào kết quả tải mới.

Chạy lại bằng `npm run check:load`, nhận mật khẩu qua CHESS_AUDIT_PASSWORD theo hướng dẫn nhập kín trong README. Script hiện ở `scripts/api-load.mjs` để tránh bị Node tự nhận nhầm là test và gọi API thật khi chạy npm test. Unit test dùng fetch giả, kiểm tra thống kê, so sánh trước/sau và dừng trên rate limit. Không thêm lệnh tải thật vào CI tự động.

Kiểm tra cục bộ cuối: **60/60 test đạt**, không fail/skip; ESLint đạt, script kiểm tra cú pháp đạt. Sáu test của runner tải dùng fetch giả, bao gồm tôn trọng Retry-After ngắn để hồi phục/logout và bỏ qua toàn bộ request khi Retry-After dài hơn thời gian chờ cho phép. Không gọi lại tải thật để kiểm tra bản hardening. Không có thay đổi mã giao diện trong lượt này nên không cần chạy lại build giao diện đã đạt ở đợt trước.hi runner dừng, snapshot tự động không gửi vì đã có safety stop. Không gán cho nó số liệu giả. Sau hơn hai phút không gửi tải, một GET /oauth/providers trả 200 lúc 20:16:43; tiếp đó đăng nhập lại admin0 và đo 20 lần /account/me, vẫn giữ nhịp tuần tự tối thiểu 250 ms như trước. Lần đăng nhập bổ sung đã logout 200.

| Chỉ số | Trước tải | Sau hồi phục | Chênh lệch |
| --- | --- | --- | --- |
| Request 200 / tổn
