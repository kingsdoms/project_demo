// ui/ChessGame.jsx
// UI chỉ đọc state từ room và gửi Action. Không tự kiểm tra luật.
import { useEffect, useMemo, useState } from "react";
import { Action } from "../core/models/Action.js";
import { GameError } from "../utils/GameError.js";
import { Side } from "../core/constants/Side.js";
import { PieceType } from "../core/constants/PieceType.js";
import Board from "./Board.jsx";
import PromotionDialog from "./PromotionDialog.jsx";
import { useRoom } from "./useRoom.js";
import { assignKeys } from "./pieceKeys.js";
import { describeResult, sideName } from "./pieceView.js";
import styles from "./ChessGame.module.css";

const ANIM_MS = 220; // khớp với transition của .piece
const BOT_DELAY_MS = 500;

export default function ChessGame({ engine, humanSide = Side.WHITE, chooseBotAction }) {
  const { getLegalMoves, isInCheck } = engine;
  const { room, game } = useRoom();

  const [view, setView] = useState(() => {
    const a = assignKeys([], game.board.pieces, new Map(), 0);
    return { game, keys: a.keys, counter: a.counter, busy: false };
  });
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  // State đổi: gán lại key quân, khóa bàn trong lúc quân chạy hoạt ảnh, bỏ lựa chọn cũ.
  if (view.game !== game) {
    const a = assignKeys(view.game.board.pieces, game.board.pieces, view.keys, view.counter);
    setView({ game, keys: a.keys, counter: a.counter, busy: true });
    setSelectedId(null);
    setError(null);
  }

  useEffect(() => {
    const t = setTimeout(
      () => setView((v) => (v.game === game ? { ...v, busy: false } : v)),
      ANIM_MS,
    );
    return () => clearTimeout(t);
  }, [game]);

  const result = game.result ?? null;
  const promoting = game.pendingPromotion != null;
  const hasBot = typeof chooseBotAction === "function";
  const humanToMove = !hasBot || game.turn === humanSide;
  const canAct = humanToMove && result === null && !view.busy;

  const selected = selectedId ? game.board.pieceById(selectedId) : null;
  const targets = useMemo(
    () => (selected && canAct && !promoting ? getLegalMoves(game, selected) : []),
    [selected, canAct, promoting, game, getLegalMoves],
  );

  const checkedKingId = useMemo(() => {
    if (!isInCheck || result !== null || !isInCheck(game, game.turn)) return null;
    return (
      game.board.pieces.find((p) => p.type === PieceType.KING && p.side === game.turn)?.id ?? null
    );
  }, [isInCheck, game, result]);

  // Bot
  useEffect(() => {
    if (!hasBot || result !== null || view.busy || game.turn === humanSide) return;
    const t = setTimeout(() => {
      try {
        const action = chooseBotAction(game);
        if (action) room.dispatch(action);
      } catch (e) {
        setError(e.message);
      }
    }, BOT_DELAY_MS);
    return () => clearTimeout(t);
  }, [hasBot, chooseBotAction, game, humanSide, result, view.busy, room]);

  function play(action) {
    try {
      room.dispatch(action);
    } catch (e) {
      if (e instanceof GameError) setError(e.message);
      else throw e;
    }
  }

  function handleSquareClick(row, col) {
    if (!canAct || promoting) return;
    if (selected && targets.some((t) => t.row === row && t.col === col)) {
      play(Action.move(selected.id, row, col));
      return;
    }
    const piece = game.board.pieceAt(row, col);
    const mine = piece && piece.side === game.turn;
    setSelectedId(mine && piece.id !== selectedId ? piece.id : null);
  }

  let status;
  if (result !== null) status = describeResult(result, game.turn);
  else if (promoting) status = "Chọn quân để phong cấp";
  else if (!humanToMove) status = "Bot đang suy nghĩ…";
  else status = `Lượt ${sideName(game.turn)}${checkedKingId ? ", vua đang bị chiếu" : ""}`;

  const showPromotion = promoting && result === null && humanToMove;

  return (
    <div className={styles.root}>
      <div className={styles.table}>
        <p className={styles.status} role="status">{status}</p>
        <div className={styles.boardWrap}>
          <Board
            game={game}
            keys={view.keys}
            selectedId={selectedId}
            targets={targets}
            checkedKingId={checkedKingId}
            onSquareClick={handleSquareClick}
          />
          {showPromotion && (
            <PromotionDialog
              side={game.turn}
              onPick={(type) => play(Action.promote(type))}
            />
          )}
        </div>
        <div className={styles.bar}>
          <button type="button" className={styles.btn} onClick={() => room.restart()}>
            Ván mới
          </button>
          {error && <span className={styles.error} role="alert">{error}</span>}
        </div>
      </div>
    </div>
  );
}