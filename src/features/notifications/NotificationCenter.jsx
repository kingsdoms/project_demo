import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bell, CalendarClock, CheckCheck, Info, LoaderCircle, Megaphone, RefreshCw, Settings2, TriangleAlert, Trophy, X } from 'lucide-react'
import { notificationApi } from '@/services/api/notification'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'
import styles from './NotificationCenter.module.css'

const POLL_MS = 60_000
const GUEST_SEEN_KEY = 'chessarena.seen-notifications'
const TYPE_META = {
  WARNING: { icon: TriangleAlert, label: 'Cảnh báo', tone: 'warning' },
  SYSTEM: { icon: Settings2, label: 'Hệ thống', tone: 'system' },
  EVENT: { icon: Trophy, label: 'Sự kiện', tone: 'event' },
  PROMOTION: { icon: Megaphone, label: 'Khuyến mãi', tone: 'event' },
}

function typeMeta(type) {
  return TYPE_META[String(type).toUpperCase()] ?? { icon: Info, label: 'Tin tức', tone: 'info' }
}

function readGuestSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(GUEST_SEEN_KEY) || '[]')) } catch { return new Set() }
}
function writeGuestSeen(set) {
  try { localStorage.setItem(GUEST_SEEN_KEY, JSON.stringify([...set].slice(-200))) } catch { /* optional */ }
}

function relativeTime(value, now = Date.now()) {
  if (value == null || value === '') return ''
  const time = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value)
  if (!Number.isFinite(time)) return ''
  const diff = Math.round((now - time) / 1000)
  if (diff < 45) return 'Vừa xong'
  if (diff < 3600) return `${Math.round(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.round(diff / 3600)} giờ trước`
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} ngày trước`
  return new Date(time).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NotificationCenter() {
  const session = useAuthStore((state) => state.session)
  const signedIn = Boolean(session?.accessToken)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState({ page: 1, totalPages: 1 })
  const [detail, setDetail] = useState(null)
  const [guestSeen, setGuestSeen] = useState(() => typeof window === 'undefined' ? new Set() : readGuestSeen())
  const rootRef = useRef(null)
  const requestRef = useRef(0)

  const load = useCallback(async (nextPage = 1, { silent = false } = {}) => {
    const ticket = ++requestRef.current
    if (!silent) setLoading(true)
    setError('')
    try {
      const result = await notificationApi.list({ page: nextPage, pageSize: 15 })
      if (ticket !== requestRef.current) return
      setItems((previous) => nextPage === 1 ? result.items : [...previous, ...result.items.filter((item) => !previous.some((old) => old.id === item.id))])
      setPage({ page: result.page, totalPages: result.totalPages })
    } catch (cause) {
      if (ticket === requestRef.current && !silent) setError(cause.message || 'Không tải được thông báo.')
    } finally {
      if (ticket === requestRef.current) setLoading(false)
    }
  }, [])

  // Tải lại khi đổi phiên và định kỳ khi tab đang mở.
  useEffect(() => {
    load(1)
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(1, { silent: true }) }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load(1, { silent: true }) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [load, session?.accessToken])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') { setOpen(false); rootRef.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  const isRead = (item) => signedIn ? item.isRead : guestSeen.has(item.id)
  const unread = items.filter((item) => !isRead(item)).length

  function markGuestSeen(ids) {
    setGuestSeen((previous) => {
      const next = new Set(previous)
      ids.forEach((id) => next.add(id))
      writeGuestSeen(next)
      return next
    })
  }

  async function openItem(item) {
    setDetail({ item, content: null, expiresAt: 0, loading: signedIn })
    if (!signedIn) { markGuestSeen([item.id]); return }
    try {
      const value = await notificationApi.detail(item.id)
      setDetail((current) => current?.item.id === item.id ? { item, content: value?.content ?? null, expiresAt: Number(value?.expires_at) || 0, loading: false } : current)
      setItems((list) => list.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry))
    } catch (cause) {
      setDetail((current) => current?.item.id === item.id ? { ...current, loading: false, error: cause.message } : current)
    }
  }

  async function markAll() {
    if (!signedIn) { markGuestSeen(items.map((item) => item.id)); return }
    try {
      await notificationApi.readAll()
      setItems((list) => list.map((item) => ({ ...item, isRead: true })))
      toast.success('Đã đánh dấu tất cả là đã đọc.')
    } catch (cause) { toast.error(cause.message || 'Không thể đánh dấu đã đọc.') }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.bell} aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} onClick={() => { setOpen((value) => !value); if (!open) load(1, { silent: items.length > 0 }) }}>
        <Bell size={18} />
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <section className={styles.panel} role="dialog" aria-label="Thông báo">
          {detail ? (
            <div className={styles.detail}>
              <header className={styles.head}>
                <button type="button" className={styles.iconButton} onClick={() => setDetail(null)} aria-label="Quay lại danh sách"><ArrowLeft size={17} /></button>
                <strong>{typeMeta(detail.item.type).label}</strong>
                <button type="button" className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Đóng"><X size={17} /></button>
              </header>
              <div className={styles.detailBody}>
                <h3>{detail.item.title}</h3>
                <p className={styles.meta}><CalendarClock size={13} /> {relativeTime(detail.item.createdAt) || 'Không rõ thời gian'}{detail.expiresAt > 0 && ` · Hết hạn ${new Date(detail.expiresAt * 1000).toLocaleDateString('vi-VN')}`}</p>
                {detail.item.description && <p className={styles.lead}>{detail.item.description}</p>}
                {detail.loading && <p className={styles.state}><LoaderCircle className={styles.spin} size={16} /> Đang tải nội dung…</p>}
                {detail.error && <p className={styles.errorText}>{detail.error}</p>}
                {detail.content && <div className={styles.content}>{detail.content}</div>}
                {!signedIn && <p className={styles.hint}>Đăng nhập để nhận thông báo riêng và đồng bộ trạng thái đã đọc.</p>}
              </div>
            </div>
          ) : (
            <>
              <header className={styles.head}>
                <strong>Thông báo {unread > 0 && <span className={styles.count}>{unread} mới</span>}</strong>
                <span className={styles.headActions}>
                  <button type="button" className={styles.iconButton} onClick={() => load(1)} aria-label="Làm mới" disabled={loading}><RefreshCw size={16} className={loading ? styles.spin : undefined} /></button>
                  <button type="button" className={styles.textButton} onClick={markAll} disabled={!unread}><CheckCheck size={15} /> Đọc hết</button>
                </span>
              </header>
              <div className={styles.list}>
                {error && <div className={styles.state}><p className={styles.errorText}>{error}</p><button type="button" className={styles.textButton} onClick={() => load(1)}>Thử lại</button></div>}
                {!error && !items.length && !loading && <div className={styles.empty}><Bell size={26} /><strong>Chưa có thông báo nào</strong><span>Tin mới từ ChessArena sẽ xuất hiện ở đây.</span></div>}
                {!items.length && loading && <div className={styles.state}><LoaderCircle className={styles.spin} size={18} /> Đang tải…</div>}
                {items.map((item) => {
                  const meta = typeMeta(item.type)
                  const Icon = meta.icon
                  const read = isRead(item)
                  return (
                    <button type="button" key={item.id} className={styles.item} data-read={read} data-tone={meta.tone} data-pinned={item.priority > 0} onClick={() => openItem(item)}>
                      <span className={styles.itemIcon}><Icon size={16} /></span>
                      <span className={styles.itemText}>
                        <strong>{item.title}</strong>
                        {item.description && <span>{item.description}</span>}
                        <small>{meta.label} · {relativeTime(item.createdAt)}</small>
                      </span>
                      {!read && <i className={styles.dot} aria-label="Chưa đọc" />}
                    </button>
                  )
                })}
                {page.page < page.totalPages && <button type="button" className={styles.more} disabled={loading} onClick={() => load(page.page + 1)}>{loading ? 'Đang tải…' : 'Xem thêm'}</button>}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
