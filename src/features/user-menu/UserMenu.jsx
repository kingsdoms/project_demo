// src/features/user-menu/UserMenu.jsx
import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/stores/usePlayerStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import styles from './UserMenu.module.css'

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={styles.switch}
      onClick={onChange}
    />
  )
}

export default function UserMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const profile = usePlayerStore((s) => s.profile)
  const { sound, music, quality, toggleSound, toggleMusic, setQuality } = useSettingsStore()

  // Đóng khi click ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Tài khoản"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.profile}>
            <div className={styles.avatar}>{profile.name[0]}</div>
            <div>
              <div className={styles.name}>{profile.name}</div>
              <div className={styles.uid}>{profile.id} · Lv.{profile.level}</div>
            </div>
          </div>

          <hr className={styles.divider} />
          <h3 className={styles.sectionTitle}>Cài đặt</h3>

          <label className={styles.setting}>
            Âm thanh <Switch checked={sound} onChange={toggleSound} label="Âm thanh" />
          </label>
          <label className={styles.setting}>
            Nhạc nền <Switch checked={music} onChange={toggleMusic} label="Nhạc nền" />
          </label>
          <label className={styles.setting}>
            Đồ hoạ
            <select className={styles.select} value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </label>

          <button type="button" className={styles.logout}>Đăng xuất</button>
        </div>
      )}
    </div>
  )
}