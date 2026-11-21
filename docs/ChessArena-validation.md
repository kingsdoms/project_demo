# Kết quả kiểm tra ChessArena

Đây là kết quả trên source hiện tại. Các bài API dùng fetch giả lập; không tạo tài khoản hoặc gửi email thật.

## tests

Exit code: 0

~~~text
> project_deomo@0.0.0 test
> node --test

✔ replay rebuilds legal sample moves, including castling, without mutating earlier frames (10.0954ms)
✔ clock deducts elapsed time and awards increment exactly once on a completed move (0.8074ms)
✔ a background-tab timeout cannot be rescued by increment and a stopped clock stays frozen (1.1381ms)
✔ VS_BOT lets the screen select the human side (4.8465ms)
✔ unsupported chess modes and sides fail clearly (0.8543ms)
✔ history records accepted moves from the player and bot, and clears on restart (23.3006ms)
✔ history represents castling as one king move and identifies en passant as a capture (7.0698ms)
✔ promotion updates the pawn's history entry without adding a turn (6.4654ms)
✔ counts legal opening move paths through three plies (608.4274ms)
✔ rejects castling through a pawn attack on the empty transit square (1.0077ms)
✔ rejects an en passant capture that uncovers a rook check (0.7426ms)
✔ allows promotion to a knight and completes the turn afterwards (0.9402ms)
  1 ván, 1 lần phong cấp
▶ Action.promote
  ✔ nhận một tham số là loại quân (1.4042ms)
  ✔ truyền nhầm id vào vị trí pieceType thì bị từ chối (1.4371ms)
✔ Action.promote (4.9236ms)
▶ simpleBot: chọn nước
  ✔ ưu tiên ăn quân giá trị cao nhất (18.636ms)
  ✔ trả về null khi ván đã kết thúc (0.3505ms)
✔ simpleBot: chọn nước (19.3386ms)
▶ simpleBot: phong cấp
  ✔ tốt tới hàng cuối thì bot trả về PROMOTE hậu, reduce chấp nhận (1.5315ms)
✔ simpleBot: phong cấp (1.8634ms)
▶ simpleBot: bot đấu bot
  ✔ chạy 200 action không lỗi, mọi action đều được reduce chấp nhận (109.9639ms)
  ✔ nhiều hạt giống khác nhau đều không lỗi (874.5408ms)
✔ simpleBot: bot đấu bot (985.1052ms)
✔ simultaneous profile requests share one fetch but a later request refreshes the data (42.8275ms)
✔ a different signed-in session never shares another session profile response (1.3726ms)
✔ login sends credentials and optional OTP with the documented request shape (50.6438ms)
✔ register uses the required matching-password fields (1.6893ms)
✔ OTP request uses the temporary bearer token and the login purpose (1.0107ms)
✔ logout sends this tab refresh token and clears its local session (1.2932ms)
✔ password recovery encodes the identifier and submits the documented reset fields without bearer auth (1.5921ms)
✔ choosing an in-memory login does not persist credentials, including after refresh (2.476ms)
✔ a refresh completing after logout cannot restore the old session (55.6732ms)
✔ concurrent 401 responses share one token refresh (1.8283ms)
✔ API client unwraps the response envelope and sends bearer auth (1.8089ms)
✔ API client refreshes expired access token once, then retries the request (2.7223ms)
✔ API client reports an unsuccessful API envelope as a readable error (0.9626ms)
ℹ tests 32
ℹ suites 4
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1278.5762
~~~

## lint

Exit code: 0

~~~text
> project_deomo@0.0.0 lint
> eslint .
~~~

## build

Exit code: 0

~~~text
> project_deomo@0.0.0 build
> node scripts/build-design-tokens.mjs --in src/styles/design-tokens --out src/styles/design-tokens.generated.css --check && vite build

wrote 201 light + 67 dark color vars → src/styles/design-tokens.generated.css
OK: every alias resolved; no token was dropped.
vite v8.3.4 building client environment for production...
transforming...
✓ 2224 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.81 kB │ gzip:   0.52 kB
dist/assets/ui-DBjVrREL.css       4.67 kB │ gzip:   1.32 kB
dist/assets/index-L8F7VLvR.css  121.41 kB │ gzip:  18.42 kB
dist/assets/ui-BXxf9o6-.js        3.89 kB │ gzip:   1.69 kB
dist/assets/index-Bq-gUPc6.js   408.52 kB │ gzip: 122.61 kB

✓ built in 807ms
~~~

## ui

Exit code: 0

~~~text
> project_deomo@0.0.0 check:ui
> node scripts/check-ui-ssr.mjs

PASS: 31 static screen renders. Browser layout and interactions are not verified by this check.
~~~

## tokens

Exit code: 0

~~~text
Parsed 8/8 token files, 282 tokens defined.

OK: all token files valid JSON.
~~~

## contrast

Exit code: 0

~~~text
Source: C:\Users\Chinh\Desktop\chatgpt\project_demo-main\src\styles\design-tokens\colors.json

=== LIGHT (required) ===
  PASS body text on page: 16.70:1 (need 4.5)  [#101511 on #f3f4ef]
  PASS body text on card: 18.28:1 (need 4.5)  [#101511 on #fffef9]
  PASS secondary text on page: 6.27:1 (need 4.5)  [#505d53 on #f3f4ef]
  PASS link on page: 7.57:1 (need 4.5)  [#2e563a on #f3f4ef]
  PASS text on primary action: 8.29:1 (need 4.5)  [#fffef9 on #2e563a]
  PASS essential control border (WCAG 1.4.11): 4.38:1 (need 3.0)  [#68756a on #f3f4ef]

=== DARK (required) ===
  PASS body text on page: 17.30:1 (need 4.5)  [#f7f8f3 on #101511]
  PASS body text on card: 16.05:1 (need 4.5)  [#f7f8f3 on #171d19]
  PASS secondary text on page: 10.86:1 (need 4.5)  [#c1c9bd on #101511]
  PASS link on page: 12.92:1 (need 4.5)  [#c8dfb7 on #101511]
  PASS text on primary action: 12.92:1 (need 4.5)  [#101511 on #c8dfb7]
  PASS essential control border (WCAG 1.4.11): 4.46:1 (need 3.0)  [#738076 on #101511]

=== LIGHT (advisory) ===
  ok tertiary/incidental text on page: 6.27:1 (need 4.5)  [#505d53 on #f3f4ef]
  ok secondary text on raised surface: 6.72:1 (need 4.5)  [#505d53 on #fbfcf8]
  warn default border on page (decorative): 1.24:1 (need 3.0)  [#d9ded7 on #f3f4ef]

=== DARK (advisory) ===
  ok tertiary/incidental text on page: 7.49:1 (need 4.5)  [#9da89d on #101511]
  ok secondary text on raised surface: 9.24:1 (need 4.5)  [#c1c9bd on #1d251f]
  warn default border on page (decorative): 1.70:1 (need 3.0)  [#344038 on #101511]

OK: all required contrast pairs pass WCAG 2.2 minimums.
~~~

## hardcodes

Exit code: 0

~~~text
Scanned 17 of 17 candidate file(s).
OK: no hardcoded values found.
~~~

## emoji

Exit code: 0

~~~text
Scanned 17 file(s).
OK: no emoji in UI output or taste files, and no em or en dash.
~~~

## native-select

Exit code: 0

~~~text
Scanned 8 of 8 file(s).
OK: no native <select> in generated UI.
~~~

## theme-refs

Exit code: 0

~~~text
Theme defines 214 tokens; scanned 17 of 17 file(s).
OK: every token reference resolves, in the theme or in the file itself.
~~~

## Chưa xác minh

- Trình duyệt từ chối quyền mở http://127.0.0.1:5173 vì không cấp quyền truy cập origin local. Không dùng công cụ khác để vượt quyết định này.
- Các render gates yêu cầu trình duyệt, review trực quan, overflow, focus thực tế, kích thước vùng chạm, axe và drag/drop chưa được thực hiện.
- SSR chỉ render markup, không kiểm tra tương tác hoặc bố cục.
- Cảnh báo tương phản advisory còn lại là đường viền trang trí. Các cặp required của bộ token đều qua; đây không phải xác nhận toàn bộ UI đạt WCAG.
- Email, OTP, reset và đổi mật khẩu chưa được thử với tài khoản thật.
