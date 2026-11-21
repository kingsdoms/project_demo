# Mô-đun cờ vua

Core luật cờ chạy cục bộ trong trình duyệt. Tài khoản được xử lý riêng qua `src/services/api/`; API tài khoản hiện chưa có route cho phòng cờ, lưu ván hoặc đồng bộ lượt chơi.

## API cờ vua trong ứng dụng

`src/games/chess/index.js` xuất `chess.create({ mode, humanSide, botDelay })`, trả về controller có view, actions, subscribe và destroy. `chess.loadUI()` tải giao diện DOM cũ nếu cần.

```js
import chess, { GameMode } from './index.js'

const controller = chess.create({
  mode: GameMode.VS_BOT,
  humanSide: chess.enums.Side.WHITE,
})

// Sau khi dùng xong:
controller.destroy()
```

Các chế độ khả dụng trong ứng dụng là đấu bot và hai người trên cùng thiết bị. `GameMode.ONLINE` hiện yêu cầu phòng từ máy chủ; API tài khoản được cấu hình trong README repo không triển khai phòng chơi nên frontend không gửi action ván cờ lên API đó.

## Kiểm tra

```sh
npm test
npm run lint
npm run build
```

Xem [tài liệu kiến trúc](docs/Architecture.md) và [luật cờ](docs/Rules.md) để biết luồng state, cách xác thực nước đi và các trường hợp kết thúc hiện hỗ trợ.
