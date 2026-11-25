# Bàn giao client cờ online

Cập nhật ngày 25/11/2026. Luồng mặc định đã chuyển sang REST/WebSocket của máy chủ. Tài liệu này ghi cách cấu hình, những ràng buộc triển khai và phạm vi kiểm chứng; không thay thế tài liệu giao thức tại `/api/dev`.

## Chạy và cấu hình

```sh
npm ci
npm run dev
```

Mở địa chỉ Vite in ra. API mặc định:

```text
https://thesaurus-divinity-cosigner.ngrok-free.dev/api
```

Sao chép `.env.example` thành `.env.local` để đổi máy chủ:

```dotenv
VITE_API_BASE_URL=https://thesaurus-divinity-cosigner.ngrok-free.dev/api
```

Giữ hậu tố `/api`, không thêm `/dev`. Khởi động lại Vite sau khi đổi biến môi trường. URL WebSocket được suy ra từ API base, đổi `https` thành `wss` hoặc `http` thành `ws`, rồi thêm `/chess/ws`. Client không ghi token vào URL. REST gửi header bỏ qua trang cảnh báo ngrok khi dùng host `.ngrok-free.dev`.

Các endpoint công khai dùng trong sảnh: `/chess/bots`, `/chess/seasons`, `/chess/lobby`; số liệu sảnh làm mới khoảng 10 giây. Trong lần triển khai này đã đọc được danh sách bot `simple`, season `s1` và dữ liệu sảnh từ API thật. Các danh sách hiển thị vẫn lấy từ response, không lấy danh sách cố định trong client.

## Các chế độ và màn hình

| Chế độ | Hành vi |
|---|---|
| `STANDARD` | Tìm người chơi online; đồng hồ server 10 phút + 5 giây mỗi nước |
| `PRACTICE` | Chọn bot từ API và phe Trắng/Đen/ngẫu nhiên; không đồng hồ |
| `EXTENDED` | Tìm trận theo season; chọn nhân vật, thẻ bài, dùng kỹ năng, xem thời tiết/hiệu ứng và thanh vòng |

`#home` và `#play` mở sảnh. Khi server báo hàng chờ hoặc có phòng, trạng thái socket quyết định màn hàng chờ/ván cờ. READY có phòng và snapshot tiếp theo tự đưa người chơi về ván dở. `#game`/`#queue` khi chưa có trạng thái tương ứng quay về sảnh. Cài đặt, hồ sơ, hướng dẫn, tài khoản, thông báo và quản trị vẫn có trong shell. Các route demo bạn bè, xếp hạng, lịch sử, replay và phòng mời không còn trong luồng sản phẩm; route không hỗ trợ hiện 404.

Không có tên/ảnh đối thủ từ server: giao diện hiện “Đối thủ” hoặc mã bot. Lịch sử nước đi trên bàn được ghi từ events nhận trong phiên, không phải lịch sử trận được lưu ở server. Nút tìm trận mới gửi yêu cầu mới cùng chế độ/season; với luyện tập, giữ bot và phe vừa chơi. Đây là một ván mới theo giao thức, không phải lời mời đấu lại đối thủ.

## Ràng buộc giao thức trong mã

- Frame đầu tiên khi mở socket là `AUTH`. Access token gần hết hạn được refresh trước kết nối; refresh gửi access token cũ qua Bearer và refresh token dưới dạng chuỗi JSON. Xác thực socket thất bại được thử refresh/kết nối lại, rồi yêu cầu đăng nhập nếu vẫn không hợp lệ.
- Mỗi `STATE`/`EVENTS` chứa snapshot đầy đủ và là nguồn sự thật. Client không chạy engine cờ, không tự sinh nước đi hợp lệ, không di chuyển quân trước phản hồi. Chọn quân/đích chỉ lấy từ `view.legal_moves`.
- Events chỉ dùng cho lịch sử và hoạt ảnh. Quân có key `piece.id`; hoạt ảnh tuần tự khoảng 220 ms rồi khớp snapshot. Snapshot mới huỷ hoạt ảnh cũ. Kích thước bàn lấy từ `rows`/`cols`, bàn lật cả hai trục khi `you = BLACK`.
- Đồng hồ hiển thị từ giá trị server và thời điểm nhận message, trừ thời gian cục bộ cho bên `running`. Không giảm khi chọn nhân vật/thẻ, không hiện đồng hồ luyện tập và không tự xử kết quả hết giờ. Đếm lùi quyết định cũng lấy deadline từ message.
- Rớt socket tự nối lại với backoff 1, 2, 4… tối đa 30 giây. Server có 60 giây chờ trong ván. `REPLACED` dừng tự reconnect; người chơi phải bấm “Dùng ở đây”. Các handler của socket cũ không được thay trạng thái socket mới.
- Các intent đang chờ phản hồi chặn thao tác trùng. Quá hạn chờ thì đồng bộ lại thay vì tự giả định thao tác đã thành công. Đầu hàng có bước xác nhận; xin hoà bị ẩn khi luyện tập, yêu cầu hoà của đối thủ có cả đồng ý và từ chối.
- Tốt tới hàng cuối mở lựa chọn quân trước `MOVE`; `pending_promotion` của quân mình sau reconnect mở lựa chọn gửi `PROMOTE`. Phong cấp của đối thủ không mở hộp chọn của mình.
- Danh sách season, nhân vật, thẻ và bot là dữ liệu API. `labels.js` chỉ chứa bản dịch/mô tả; mã mới hiển thị nguyên mã. Lựa chọn và hiệu ứng chưa biết không làm hỏng giao diện. `skid` là hiệu ứng nội bộ nên không vẽ.
- Chỉ render offer/character của đối thủ khi chính snapshot đã cung cấp dữ liệu được phép hiển thị; không suy đoán lựa chọn ẩn từ events. Overlay chỉ lấy các thẻ đang được offer cho `view.you`.

## Tệp triển khai

| Tệp | Trách nhiệm |
|---|---|
| `src/app/ChessArenaApp.jsx` | Shell, route, trạng thái kết nối, `REPLACED`, giữ tài khoản/quản trị |
| `src/services/api/client.js` | REST envelope, phiên theo tab/bộ nhớ, refresh và token còn hạn trước socket |
| `src/services/chess/api.js` | REST công khai cho cờ và suy ra URL socket |
| `src/services/chess/session.js` | Vòng đời socket, AUTH, queue, reconnect, snapshot, lịch sử/events và xử lý lỗi |
| `src/features/chess/online/useOnlineChess.js` | Nối session vào React, tải catalog, poll sảnh và toast lỗi |
| `src/features/chess/online/OnlineLobby.jsx` | Sảnh thật, ba chế độ, chọn bot/phe/season |
| `src/features/chess/online/OnlineRoom.jsx` | Đồng hồ, người chơi, lịch sử, hoà/đầu hàng, phong cấp, kết quả và hàng chờ |
| `src/features/chess/online/ServerBoard.jsx` | Bàn động, bấm/kéo thả/bàn phím, đích từ server, hiệu ứng và quân có key ổn định |
| `src/features/chess/online/boardModel.js` | Chuyển dữ liệu hiển thị, gợi ý mục tiêu kỹ năng, hoạt ảnh; không tính luật di chuyển cờ |
| `src/features/chess/online/SeasonPanels.jsx` | Hướng dẫn season, chọn nhân vật/thẻ, thẻ sở hữu, kỹ năng và thanh vòng |
| `src/features/chess/online/labels.js` | Tên/mô tả tiếng Việt và fallback mã lạ |
| `src/features/chess/online/timing.js` | Hiển thị đồng hồ và đếm lùi từ mốc server |
| `scripts/check-ui-ssr.mjs` | Render fixture/màn hình tĩnh, kiểm tra dữ liệu hiển thị và không lộ offer đối thủ |

`src/games/chess/`, màn cờ cũ và `public/stockfish/` vẫn được giữ phục vụ debug/kiểm thử và giấy phép upstream. Luồng online mặc định không dùng engine hoặc Worker Stockfish cục bộ.

## Bằng chứng kiểm tra

Các kết quả dưới đây áp dụng cho lần thay đổi này, không khẳng định đã chơi ván thật có đăng nhập trên máy chủ:

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | 107 test Node pass, bao gồm bộ cũ và test transport/board/timing mới |
| `npm run check:ui` | 53 lượt render SSR fixture/màn hình pass |
| `npm run lint` | Pass |
| `npm run build` | Pass, gồm kiểm tra/sinh design tokens và Vite build |
| REST công khai trực tiếp | Đọc được bots, seasons, lobby; bot `simple`, season `s1` |
| Trình duyệt dùng REST/WebSocket giả lập | 37 kiểm tra desktop/mobile 375 px pass; xác minh các thao tác qua socket giả, không thay thế ván thật |
| WebSocket đăng nhập và ván thật hai tài khoản | Chưa chạy; chưa có thông tin đăng nhập được cấp cho lần triển khai này |

Test transport dùng socket/timer giả để kiểm tra AUTH trước intent, refresh, reconnect/backoff, `REPLACED`, socket cũ, đồng bộ snapshot, khóa thao tác và xử lý lỗi. Test board kiểm tra lựa chọn từ `legal_moves`, bàn lật/kích thước động, phong cấp, mục tiêu kỹ năng và hoạt ảnh bị ngắt bởi snapshot mới. Test thời gian kiểm tra bên chạy/bên dừng, luyện tập không đồng hồ, khớp mốc nhận mới, dừng sau kết quả và chặn giá trị âm.

SSR kiểm tra các route hỗ trợ/404, catalog API, bàn 8×8 và 6×10, lật phe Đen, đích hợp lệ, hiệu ứng lạ, `skid` ẩn, phong cấp của mình/đối thủ, hoà, kết quả, hàng chờ, lựa chọn mở rộng, đổi bài hết lượt, chờ đối thủ và offer đối thủ không lộ. SSR không chạy effect, pointer, âm thanh, mạng hoặc đo bố cục 375 px.

## Nghiệm thu trực tiếp còn lại

Checklist này **chưa được chạy với hai tài khoản thật**. Dùng hai profile/trình duyệt và tài khoản đã kích hoạt; mỗi tài khoản chỉ có một socket đang hoạt động.

- [ ] Đăng nhập thường; tài khoản `need_active`; gửi lại email; `need_otp`; gửi/nhập lại OTP. Cho token sắp hết hạn rồi mở socket để xác minh refresh trực tiếp.
- [ ] Hai tài khoản tìm `STANDARD`, được ghép đúng phe, đi tới chiếu hết; đồng hồ hai trình duyệt lệch dưới 1 giây và cộng 5 giây sau nước đi.
- [ ] Luyện với bot ở phe Trắng, Đen và ngẫu nhiên; bot tự đi, không có đồng hồ hay nút xin hoà.
- [ ] Phong cấp chọn trước `MOVE`; đóng/mở lại khi server đang `pending_promotion` để kiểm tra `PROMOTE`.
- [ ] Xin hoà, đồng ý, từ chối và đi tiếp để từ chối; đầu hàng cần xác nhận; kết quả và tìm trận mới/về sảnh khớp server.
- [ ] Ngắt mạng 10 giây rồi bật lại: khôi phục đúng bàn, đối thủ có banner đếm lùi và banner biến mất sau reconnect. Tách riêng tình huống bỏ mạng quá 60 giây để kiểm tra kết quả server.
- [ ] Mở tài khoản ở tab thứ hai: tab đầu nhận `REPLACED`, không tự tranh socket; “Dùng ở đây” hoạt động khi chủ động bấm.
- [ ] `EXTENDED`: chọn nhân vật hoặc để hết giờ, đợi đối thủ, chọn thẻ/đổi bài/hết lượt đổi và không lộ lựa chọn đối thủ trước công bố.
- [ ] Dùng lần lượt Địa sư, Phù thuỷ băng, Chỉ huy; kiểm tra hồi chiêu, ô mục tiêu, Esc/huỷ và lỗi mục tiêu từ server; sau kỹ năng vẫn đi quân được.
- [ ] Gặp Động đất, Rét đậm và Bão tuyết; quân trượt/rơi/bị đóng băng, hiệu ứng và thanh vòng khớp snapshot; snapshot đến giữa hoạt ảnh phải ngắt chuỗi cũ.
- [ ] Màn hình 375 px: bàn vừa chiều ngang, chạm chọn và kéo thả hoạt động, overlay chọn không tràn; kiểm tra thêm bàn phím, focus modal, giảm chuyển động và âm thanh bật/tắt.

Đăng ký/email/Google và thao tác ADMIN ghi vẫn cần kiểm chứng bằng tài khoản/quyền thật riêng; không dùng kết quả giả lập cờ để xác nhận các luồng này.
