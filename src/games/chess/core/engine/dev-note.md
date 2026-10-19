File	Chứa	Import
compose.js	compose(...ruleSets)	models/RuleSet
applyMove.js	applyMove(game, piece, action, kind): chỉ đổi dữ liệu (di chuyển, ăn quân, nhập thành, bắt qua đường, hasMoved, enPassantTarget, pendingPromotion, đổi lượt). Không gọi rule	models, constants
moveFacts.js	classifyMove, buildMoveInput, isAttacked, getLegalMoves, evaluateOutcome. Tất cả chỉ đọc, không đổi state	applyMove, rules, models
reduce.js	reduce(game, action): phân loại → dựng input → check rule → applyMove → evaluateOutcome → withResult	compose, moveFacts, applyMove, rules
room.js	Giữ state, nhận hàm reduce	models