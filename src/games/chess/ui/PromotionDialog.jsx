// ui/PromotionDialog.jsx
import { PIECE_DEFS } from "../core/constants/PieceDefs.js";
import { PROMOTION_TARGETS } from "../core/constants/StandardDef.js";
import { Side } from "../core/constants/Side.js";
import { glyphOf } from "./pieceView.js";
import styles from "./ChessGame.module.css";

export default function PromotionDialog({ side, onPick }) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Chọn quân phong cấp">
      <div className={styles.dialog}>
        <p className={styles.dialogTitle}>Phong cấp cho tốt</p>
        <div className={styles.choices}>
          {PROMOTION_TARGETS.map((type, i) => (
            <button
              key={type}
              type="button"
              autoFocus={i === 0}
              className={styles.choice}
              onClick={() => onPick(type)}
            >
              <span className={side === Side.WHITE ? styles.white : styles.black}>
                {glyphOf(type)}
              </span>
              <span className={styles.choiceName}>{PIECE_DEFS[type].name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}