// src/features/input-debug/InputDebugScreen.jsx
import { useEffect, useRef, useState } from 'react'
import chess, { GameMode } from '@/games/chess' // đổi lại cho đúng đường dẫn tới games/chess/index.js
import { SCENES } from '@/config/scenes'
import { useGameInput } from '@/hooks/useGameInput'
import { useSceneStore } from '@/stores/useSceneStore'
import styles from './InputDebugScreen.module.css'

export default function InputDebugScreen() {
  const stageRef = useRef(null)
  const chessHostRef = useRef(null)
  const sessionRef = useRef(null) // { controller, ui } của ván đang chạy
  const [battling, setBattling] = useState(false)

  const { keys, mouse, wheel, lastEvent } = useGameInput(stageRef)
  const setScene = useSceneStore((s) => s.setScene)

  const disposeSession = () => {
  const session = sessionRef.current
  sessionRef.current = null
  session?.unmount?.()              // gỡ giao diện (hàm do mount trả về)
  session?.controller.destroy()     // hủy controller
}

const startBattle = async () => {
  const host = chessHostRef.current
  if (!host || sessionRef.current) return

  const controller = chess.create({ mode: GameMode.LOCAL })
  sessionRef.current = { controller, unmount: null }
  setBattling(true)

  const ui = await chess.loadUI()

  // trong lúc chờ load, ván có thể đã bị hủy
  if (sessionRef.current?.controller !== controller) {
    controller.destroy()
    return
  }

  sessionRef.current.unmount = ui.mount(host, controller)
}

  const stopBattle = () => {
    disposeSession()
    setBattling(false)
  }

  // rời màn hình thì dọn luôn ván đang chạy
  useEffect(() => disposeSession, [])

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!battling && (
        <>
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
                {keys.length
                  ? keys.map((k) => <kbd key={k} className={styles.kbd}>{k}</kbd>)
                  : '—'}
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
        </>
      )}

      {/* luôn render, chỉ rỗng khi chưa có ván */}
      <div
  ref={chessHostRef}
  className={styles.chessHost}
  style={{
    position: 'relative',
    width:'100%',
    height:'100%'
  }}
/>

      <div className={styles.actions}>
        {!battling ? (
          <>
            <button className={styles.btn} onClick={() => setScene(SCENES.WORLD)}>
              → World (map)
            </button>
            <button className={styles.btn} onClick={startBattle}>
              → Battle
            </button>
          </>
        ) : (
          <button className={styles.btn} onClick={stopBattle}>
            Thoát ván
          </button>
        )}
      </div>
    </div>
  )
}