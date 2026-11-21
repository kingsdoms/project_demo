# Kiểm tra font và Stockfish

## tests

Exit: 0

```text
> project_deomo@0.0.0 test
> node --test

✔ replay rebuilds legal sample moves, including castling, without mutating earlier frames (10.4723ms)
✔ clock deducts elapsed time and awards increment exactly once on a completed move (0.6411ms)
✔ a background-tab timeout cannot be rescued by increment and a stopped clock stays frozen (0.8428ms)
✔ FEN includes the standard board, turn, castling rights and en-passant target (7.09ms)
✔ FEN does not restore castling after a king has moved or a rook is missing (0.9491ms)
✔ the UCI bridge validates normal moves, castling and en passant through the local rules (16.6138ms)
✔ the UCI bridge retains every legal underpromotion and rejects missing or spurious promotion codes (3.1729ms)
✔ every difficulty preset sends actual Stockfish skill/depth/time settings and reuses one worker (68.318ms)
✔ the adapter completes the exact promotion selected by Stockfish without a second engine search (2.4113ms)
✔ a newer position cancels and drains a stale search before receiving the next bestmove (23.5925ms)
✔ stop settles loading and active work, and no late worker message can yield a move (5.3997ms)
✔ worker load failures, missing skill support and invalid moves surface errors instead of falling back (5.5945ms)
✔ a worker that never initializes fails promptly rather than leaving the turn stuck (24.7914ms)
✔ a search that never completes is terminated and surfaced to the user (15.2283ms)
✔ VS_BOT lets the screen select the human side (5.3938ms)
✔ unsupported chess modes and sides fail clearly (0.8382ms)
✔ restarting while an async bot thinks discards the stale move and schedules the new position (15.7343ms)
✔ history records accepted moves from the player and bot, and clears on restart (23.6276ms)
✔ history represents castling as one king move and identifies en passant as a capture (8.5615ms)
✔ promotion updates the pawn's history entry without adding a turn (5.7514ms)
✔ counts legal opening move paths through three plies (636.0154ms)
✔ rejects castling through a pawn attack on the empty transit square (0.7566ms)
✔ rejects an en passant capture that uncovers a rook check (0.4495ms)
✔ allows promotion to a knight and completes the turn afterwards (0.5861ms)
  1 ván, 1 lần phong cấp
▶ Action.promote
  ✔ nhận một tham số là loại quân (0.9856ms)
  ✔ truyền nhầm id vào vị trí pieceType thì bị từ chối (1.0076ms)
✔ Action.promote (3.5004ms)
▶ simpleBot: chọn nước
  ✔ ưu tiên ăn quân giá trị cao nhất (18.0063ms)
  ✔ trả về null khi ván đã kết thúc (0.4137ms)
✔ simpleBot: chọn nước (18.837ms)
▶ simpleBot: phong cấp
  ✔ tốt tới hàng cuối thì bot trả về PROMOTE hậu, reduce chấp nhận (1.534ms)
✔ simpleBot: phong cấp (1.7722ms)
▶ simpleBot: bot đấu bot
  ✔ chạy 200 action không lỗi, mọi action đều được reduce chấp nhận (147.3435ms)
  ✔ nhiều hạt giống khác nhau đều không lỗi (740.4021ms)
✔ simpleBot: bot đấu bot (888.1548ms)
✔ simultaneous profile requests share one fetch but a later request refreshes the data (52.5153ms)
✔ a different signed-in session never shares another session profile response (1.8299ms)
✔ login sends credentials and optional OTP with the documented request shape (50.8185ms)
✔ register uses the required matching-password fields (1.7507ms)
✔ OTP request uses the temporary bearer token and the login purpose (1.236ms)
✔ logout sends this tab refresh token and clears its local session (1.6143ms)
✔ password recovery encodes the identifier and submits the documented reset fields without bearer auth (2.5648ms)
✔ an empty unauthorized response asks the user to sign in and retains its HTTP status (50.4897ms)
✔ choosing an in-memory login does not persist credentials, including after refresh (0.9045ms)
✔ a refresh completing after logout cannot restore the old session (14.311ms)
✔ concurrent 401 responses share one token refresh (1.8518ms)
✔ API client unwraps the response envelope and sends bearer auth (1.4836ms)
✔ API client refreshes expired access token once, then retries the request (2.6312ms)
✔ API client reports an unsuccessful API envelope as a readable error (1.0161ms)
ℹ tests 45
ℹ suites 4
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1187.7615
```

## lint

Exit: 0

```text
> project_deomo@0.0.0 lint
> eslint .
```

## build-ui

Exit: 0

```text
> project_deomo@0.0.0 build
> node scripts/build-design-tokens.mjs --in src/styles/design-tokens --out src/styles/design-tokens.generated.css --check && vite build

wrote 201 light + 67 dark color vars → src/styles/design-tokens.generated.css
OK: every alias resolved; no token was dropped.
vite v8.3.4 building client environment for production...
transforming...
✓ 2229 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.93 kB │ gzip:   0.57 kB
dist/assets/ui-DBjVrREL.css       4.67 kB │ gzip:   1.32 kB
dist/assets/index-GwDQ9B4n.css  126.39 kB │ gzip:  19.14 kB
dist/assets/ui-BXxf9o6-.js        3.89 kB │ gzip:   1.69 kB
dist/assets/index-5f8eaemS.js   420.43 kB │ gzip: 126.88 kB

✓ built in 818ms

> project_deomo@0.0.0 check:ui
> node scripts/check-ui-ssr.mjs

PASS: 31 static screen renders. Browser layout and interactions are not verified by this check.
```

## stockfish

Exit: 0

```text
> project_deomo@0.0.0 check:stockfish
> node scripts/check-stockfish.mjs

{
  "engine": "Stockfish 19 Lite WASM",
  "levelsPassed": 6,
  "results": [
    {
      "level": "beginner",
      "skill": 0,
      "depth": 2,
      "moveTime": 150,
      "move": "e2e4"
    },
    {
      "level": "easy",
      "skill": 3,
      "depth": 5,
      "moveTime": 300,
      "move": "e2e4"
    },
    {
      "level": "medium",
      "skill": 7,
      "depth": 9,
      "moveTime": 600,
      "move": "e2e4"
    },
    {
      "level": "hard",
      "skill": 11,
      "depth": 13,
      "moveTime": 1000,
      "move": "e2e4"
    },
    {
      "level": "expert",
      "skill": 16,
      "depth": 18,
      "moveTime": 1600,
      "move": "g1f3"
    },
    {
      "level": "master",
      "skill": 20,
      "depth": 22,
      "moveTime": 2400,
      "move": "e2e4"
    }
  ]
}
```

## tokens

Exit: 0

```text
Parsed 8/8 token files, 282 tokens defined.

OK: all token files valid JSON.
```

## hardcodes

Exit: 0

```text
Scanned 23 of 23 candidate file(s).
OK: no hardcoded values found.
```

## emoji

Exit: 0

```text
Scanned 24 file(s).
OK: no emoji in UI output or taste files, and no em or en dash.
```

## theme

Exit: 0

```text
Theme defines 214 tokens; scanned 23 of 23 file(s).
OK: every token reference resolves, in the theme or in the file itself.
```

## contrast

Exit: 0

```text
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
```

## Browser spot checks

- Computed body và heading: Be Vietnam Pro; document.fonts.check chuỗi tiếng Việt trả true.
- Đã xem desktop sáng/tối; trang chọn trận tại 320/390 không tràn ngang.
- Ở 320, nhãn 1 + 0, 5 + 0, 10 + 5 cao 24px, line-height 24px, nằm trong button.
- Worker nạp thành công; Mới bắt đầu đi e7-e5 sau e2-e4.
- Đổi Bậc thầy qua xác nhận; bot đi g8-f6 sau d2-d4.
- Không ghi nhận console error ở tab thử.
- Đã trả viewport mặc định, giao diện tối và mở trang chọn cấp.

Chưa chạy axe/render gates toàn diện, không tuyên bố toàn bộ UI đạt WCAG. Contrast còn advisory về viền trang trí; tất cả cặp required đều qua.
