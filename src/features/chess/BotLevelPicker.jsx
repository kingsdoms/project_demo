import { Bot, Check } from 'lucide-react'
import { BOT_LEVELS, getBotLevel } from '@/games/chess/bot/stockfish/levels'
import styles from './BotLevelPicker.module.css'

export default function BotLevelPicker({ value, onChange, compact = false, disabled = false }) {
  const current = getBotLevel(value)
  return <fieldset className={styles.picker} data-compact={compact} disabled={disabled}>
    <legend><Bot size={17} /> Độ khó Stockfish</legend>
    <div className={styles.levels}>{BOT_LEVELS.map((level, index) => <button type="button" key={level.key} aria-pressed={current.key === level.key} data-selected={current.key === level.key} onClick={() => { if (current.key !== level.key) onChange(level.key) }}><span className={styles.levelNumber}>{String(index + 1).padStart(2, '0')}</span><strong>{level.label}</strong>{current.key === level.key && <Check size={14} />}</button>)}</div>
    <p className={styles.description}>{current.description}</p>
    {!compact && <p className={styles.note}>Stockfish 19 Lite chạy trên thiết bị. Các mức dùng Skill Level và giới hạn tính toán riêng, không phải điểm Elo đã đo.</p>}
  </fieldset>
}
