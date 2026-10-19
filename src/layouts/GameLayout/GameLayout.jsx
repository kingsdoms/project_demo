// src/layouts/GameLayout/GameLayout.jsx
import styles from './GameLayout.module.css'

export default function GameLayout({ topLeft, topRight, children }) {
  return (
    <div className={styles.root}>
      <main className={styles.stage}>{children}</main>
      <div className={styles.topLeft}>{topLeft}</div>
      <div className={styles.topRight}>{topRight}</div>
    </div>
  )
}