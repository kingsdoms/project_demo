// src/features/player-status/StatBar.jsx
import styles from './StatBar.module.css'

export default function StatBar({ label, value, max, variant }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.track}>
        <div className={`${styles.fill} ${styles[variant]}`} style={{ width: `${percent}%` }} />
        <span className={styles.text}>{value} / {max}</span>
      </div>
    </div>
  )
}