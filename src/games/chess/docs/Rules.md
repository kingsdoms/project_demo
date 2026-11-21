# Luật cờ được triển khai

## Quy ước bàn cờ

Bàn cờ có 8 hàng và 8 cột. `row: 0` là hàng 8 phía Đen; `row: 7` là hàng 1 phía Trắng. Cột `0` là a và cột `7` là h. Trắng đi về hàng nhỏ hơn; Đen đi về hàng lớn hơn.

## Các kiểu nước đi

- **Thông thường:** `PieceMoveDefs.js` mô tả hướng, khoảng cách, kiểu bắt quân và điều kiện quân chưa di chuyển. `squares.js` kiểm tra đích và các quân chắn đường.
- **Nhập thành:** vua đi hai ô về phía xe. Vua và xe phải chưa từng di chuyển; đường đi giữa phải trống; vua không đang bị chiếu và hai ô vua đi qua hoặc đáp xuống không bị đối thủ tấn công.
- **Bắt tốt qua đường:** tốt bắt đi chéo vào ô vừa bị tốt đối phương bỏ qua sau khi đi hai ô. Quân tốt bị bắt nằm ở ô kề bên và chỉ được bắt ngay lượt tiếp theo.
- **Phong cấp:** tốt tới hàng 8 của Trắng hoặc hàng 1 của Đen phải chọn hậu, xe, tượng hoặc mã. Lượt chỉ đổi sau khi hoàn tất lựa chọn.

Mỗi nước đi phải thuộc bên đang tới lượt, không thể tiếp tục sau khi ván đã có kết quả, và không được để vua của mình bị chiếu. `getLegalMoves` và `reduce` dùng chung bộ kiểm tra để UI, bot và việc áp dụng nước đi nhất quán.

## Kết thúc ván

Engine báo ba kết cục:

- **Chiếu hết:** bên tới lượt bị chiếu và không còn nước hợp lệ; đối thủ thắng.
- **Hết nước đi hợp lệ:** bên tới lượt không bị chiếu và không thể đi; hòa.
- **Không đủ quân:** hai vua, hai vua với một mã hoặc tượng, hoặc chỉ còn các tượng trên cùng màu ô.

Engine hiện chưa xử lý hòa do lặp lại thế cờ, luật 50 nước, hoặc thỏa thuận hòa.
