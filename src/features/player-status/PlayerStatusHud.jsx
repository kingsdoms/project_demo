// src/features/player-status/PlayerStatusHud.jsx
import { usePlayerStore } from '@/stores/usePlayerStore'
import StatBar from './StatBar'
import styles from './PlayerStatusHud.module.css'

export default function PlayerStatusHud() {
  const profile = usePlayerStore((s) => s.profile)
  const stats = usePlayerStore((s) => s.stats)

  return (
    <div className={styles.hud}>
      <div className={styles.avatar}>
        {profile.name[0]}
        <span className={styles.level}>{profile.level}</span>
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{profile.name}</div>
        <StatBar label="HP" value={stats.hp} max={stats.maxHp} variant="hp" />
        <StatBar label="MP" value={stats.mp} max={stats.maxMp} variant="mp" />
        <StatBar label="EXP" value={stats.exp} max={stats.maxExp} variant="exp" />
      </div>
    </div>
  )
}