// src/features/input-debug/InputDebugScreen.jsx
import { useRef } from 'react'
import { SCENES } from '@/config/scenes'
import { useGameInput } from '@/hooks/useGameInput'
import { useSceneStore } from '@/stores/useSceneStore'
import styles from './InputDebugScreen.module.css'

export default function InputDebugScreen() {
  const stageRef = useRef(null)
  const { keys, mouse, wheel, lastEvent } = useGameInput(stageRef)
  const setScene = useSceneStore((s) => s.setScene)

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      onContextMenu={(e) => e.preventDefault()} // chuột phải dùng cho game
    >
      {mouse.inside && (
        <div
          className={styles.cursor}
          style={{ transform: `translate(${mouse.x}px, ${mouse.y}px)` }}
        />
      )}

      <section className={styles.panel}>
        <h2 className={styles.title}>Input Debug</h2>
        <dl className={styles.grid}>
          <dt>Phím đang giữ</dt>
          <dd>
            {keys.length ? keys.map((k) => <kbd key={k} className={styles.kbd}>{k}</kbd>) : '—'}
          </dd>
          <dt>Vị trí chuột</dt>
          <dd>{mouse.inside ? `x: ${mouse.x}, y: ${mouse.y}` : 'ngoài vùng'}</dd>
          <dt>Nút chuột</dt>
          <dd>{mouse.buttons.length ? mouse.buttons.join(' + ') : '—'}</dd>
          <dt>Cuộn chuột</dt>
          <dd>{wheel}</dd>
          <dt>Sự kiện cuối</dt>
          <dd>{lastEvent}</dd>
        </dl>
      </section>

      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => setScene(SCENES.WORLD)}>
          → World (map)
        </button>
        <button className={styles.btn} onClick={() => setScene(SCENES.BATTLE)}>
          → Battle
        </button>
      </div>
    </div>
  )
}