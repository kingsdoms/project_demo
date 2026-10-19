// ui/Board.jsx
// Hai lớp chồng nhau: lớp ô (nhận click, hiện gợi ý) và lớp quân (chỉ để vẽ và chạy hoạt ảnh).
import { glyphOf, sideName, squareName } from "./pieceView.js";
import { PIECE_DEFS } from "../core/constants/PieceDefs.js";
import styles from "./ChessGame.module.css";

export default function Board({
  game,
  keys,
  selectedId,
  targets,
  checkedKingId,
  onSquareClick,
}) {
  const { rows, cols, pieces } = game.board;
  const targetSet = new Set(targets.map((t) => `${t.row},${t.col}`));

  const squares = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = game.board.pieceAt(r, c);
      const isTarget = targetSet.has(`${r},${c}`);
      const cls = [
        styles.square,
        (r + c) % 2 === 1 ? styles.dark : styles.light,
        piece && piece.id === selectedId && styles.selected,
        piece && piece.id === checkedKingId && styles.checked,
        isTarget && (piece ? styles.captureHint : styles.moveHint),
      ]
        .filter(Boolean)
        .join(" ");
      const name = squareName(r, c, rows);
      const label = piece
        ? `${name}, ${PIECE_DEFS[piece.type].name} ${sideName(piece.side)}`
        : `${name}, ô trống`;
      squares.push(
        <button
          key={`${r},${c}`}
          type="button"
          className={cls}
          aria-label={isTarget ? `${label}, có thể đi tới` : label}
          onClick={() => onSquareClick(r, c)}
        />,
      );
    }
  }

  return (
    <div
      className={styles.board}
      style={{ "--rows": rows, "--cols": cols }}
      role="group"
      aria-label="Bàn cờ"
    >
      <div className={styles.squares}>{squares}</div>
      <div className={styles.pieces} aria-hidden="true">
        {pieces.map((p) => (
          <div
            key={keys.get(p.id)}
            className={`${styles.piece} ${p.side === "WHITE" ? styles.white : styles.black}`}
            style={{ "--r": p.row, "--c": p.col }}
          >
            {glyphOf(p.type)}
          </div>
        ))}
      </div>
    </div>
  );
}