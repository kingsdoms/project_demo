import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, CircleHelp, Crown, Home, Menu, Moon, Settings, ShieldCheck, Sun, Swords, UserRound, WifiOff, X } from 'lucide-react'
import AccountMenu from '@/features/auth/AccountMenu'
import AuthDialog from '@/features/auth/AuthDialog'
import AccountSettings from '@/features/auth/AccountSettings'
import AdminConsole from '@/features/admin/AdminConsole'
import { ADMIN_PAGES } from '@/features/admin/adminPages'
import { useAdminAccess } from '@/features/admin/useAdminAccess'
import NotificationCenter from '@/features/notifications/NotificationCenter'
import OnlineLobby from '@/features/chess/online/OnlineLobby'
import OnlineRoom, { OnlineQueue } from '@/features/chess/online/OnlineRoom'
import { useOnlineChess } from '@/features/chess/online/useOnlineChess'
import Toaster from '@/components/ui/Toaster'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'
import styles from './ChessArenaApp.module.css'
import online from '@/features/chess/online/OnlineChess.module.css'

const NAV = [{ key: 'home', label: 'Sảnh cờ', icon: Home }, { key: 'play', label: 'Chơi cờ', icon: Swords }, { key: 'settings', label: 'Cài đặt', icon: Settings }, { key: 'help', label: 'Hướng dẫn', icon: CircleHelp }]
const pageName = (route) => NAV.find((item) => item.key === route)?.label || { game: 'Ván đấu', queue: 'Tìm đối thủ', profile: 'Tài khoản', privacy: 'Quyền riêng tư', terms: 'Điều khoản' }[route] || 'ChessArena'
function savedTheme() { try { return localStorage.getItem('chessarena.theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' } }

export function AdminScreen({ page = 'overview', navigate = () => {}, onSignIn = () => {} }) {
  return <AdminConsole page={page} navigate={navigate} onSignIn={onSignIn} />
}

export default function ChessArenaApp() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || 'home')
  const [theme, setTheme] = useState(savedTheme)
  const [sound, setSound] = useState(true)
  const [boardTheme, setBoardTheme] = useState('forest')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authMode, setAuthMode] = useState(() => /^\/forgot\//.test(window.location.pathname) ? 'reset' : null)
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const account = useAuthStore((s) => s.account)
  const signedIn = useAuthStore((s) => Boolean(s.session))
  const { client, state, catalog, lobby, refresh } = useOnlineChess()
  const adminAccess = useAdminAccess()
  const screen = state.snapshot || state.room ? 'game' : state.queue ? 'queue' : route
  const adminView = screen.startsWith('admin-')
  const title = adminView ? ADMIN_PAGES.find((p) => `admin-${p.key}` === screen)?.label || 'Quản trị' : pageName(screen)
  const nav = adminView ? ADMIN_PAGES.map((p) => ({ ...p, key: `admin-${p.key}` })) : NAV
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem('chessarena.theme', theme) } catch { /* optional browser storage */ }
  }, [theme])
  useEffect(() => {
    const hash = () => { setRoute(window.location.hash.slice(1) || 'home'); setMobileOpen(false) }
    const network = () => setOffline(!navigator.onLine)
    window.addEventListener('hashchange', hash); window.addEventListener('online', network); window.addEventListener('offline', network)
    return () => { window.removeEventListener('hashchange', hash); window.removeEventListener('online', network); window.removeEventListener('offline', network) }
  }, [])
  useEffect(() => {
    document.title = `${title} | ChessArena`
    document.getElementById('main-content')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [screen, title])
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.activeElement
    const controls = [...document.querySelectorAll('#arena-navigation button:not(:disabled)')]
    const keyboard = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
      if (e.key === 'Tab' && controls.length) {
        if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1).focus() }
        else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus() }
      }
    }
    controls[0]?.focus(); document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus() }
  }, [mobileOpen])
  function navigate(next) { setRoute(next); setMobileOpen(false); window.location.hash = next }
  function leaveFinished(next = 'home') { client.leaveFinished(); navigate(next) }
  function start(intent) { if (!client.send(intent)) toast.info('Kết nối chưa sẵn sàng. Hãy thử lại khi đã kết nối.') }
  function findNextGame() {
    const view = state.snapshot?.view
    if (!view?.result || state.status !== 'ready') return
    let intent = { type: 'QUEUE', mode: view.mode, ...(view.ext?.season ? { season: view.ext.season } : {}) }
    if (view.mode === 'PRACTICE') {
      const botSeat = view.seats?.find((seat) => seat.bot)
      const bot = catalog.bots.find((entry) => entry.id.toUpperCase() === botSeat?.bot?.toUpperCase())
      if (!bot) { leaveFinished('play'); return }
      intent = { type: 'PRACTICE', bot: bot.id, side: view.you }
    }
    client.leaveFinished()
    navigate('play')
    start(intent)
  }
  const lobbyPage = <OnlineLobby {...{ account, signedIn, state, catalog, lobby }} onStart={start} onAuth={() => setAuthMode('login')} onRefresh={refresh} />
  let content
  if (screen === 'game' && (state.room || state.snapshot)) content = <OnlineRoom key={state.room} {...{ state, client, catalog, account, sound }} onSound={() => setSound((s) => !s)} onExit={() => leaveFinished()} onNewGame={findNextGame} />
  else if (state.queue) content = <OnlineQueue state={state} onCancel={() => client.send({ type: 'CANCEL' })} />
  else if (['home', 'play', 'game', 'queue'].includes(screen)) content = lobbyPage
  else if (adminView) content = <div className={styles.pageContent}><AdminScreen page={screen.slice(6)} navigate={navigate} onSignIn={() => setAuthMode('login')} /></div>
  else if (['settings', 'profile'].includes(screen)) content = <div className={styles.pageContent}><h1>{screen === 'profile' ? 'Tài khoản của bạn' : 'Cài đặt'}</h1><Preferences {...{ theme, setTheme, sound, setSound, boardTheme, setBoardTheme, account, signedIn }} onAuth={() => setAuthMode('login')} /></div>
  else if (screen === 'help') content = <div className={styles.pageContent}><Help onBack={() => navigate('home')} /></div>
  else if (['privacy', 'terms'].includes(screen)) content = <div className={styles.pageContent}><h1>{title}</h1><section className={styles.settingsPanel}><h2>{screen === 'privacy' ? 'Dữ liệu tài khoản và phiên chơi' : 'Trải nghiệm ChessArena'}</h2><p>Đăng nhập, hồ sơ và ván cờ được xử lý bởi máy chủ. Token được giữ theo tab trong sessionStorage hoặc trong bộ nhớ theo lựa chọn đăng nhập. Mật khẩu chỉ được gửi khi bạn gửi biểu mẫu.</p><p>Giao diện lưu lựa chọn sáng/tối trên thiết bị. Nước đi, đồng hồ và kết quả do máy chủ xác nhận. Kết nối lại trong vòng 60 giây để tiếp tục khi mạng gián đoạn.</p></section></div>
  else content = <section className={styles.accessPanel}><span className={online.eyebrow}>404</span><h1>Trang này chưa tồn tại.</h1><p>Trở về sảnh để bắt đầu một ván cờ.</p><button type="button" className={styles.primaryButton} onClick={() => navigate('home')}>Về sảnh</button></section>
  return <div className={styles.arena} data-theme={theme} data-board={boardTheme} data-screen={screen}>
    <a className={styles.skipLink} href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Nhảy tới nội dung</a>
    {offline && <div className={styles.offlineBanner} role="status"><WifiOff size={16} /> Thiết bị đang ngoại tuyến. Hãy khôi phục mạng để tiếp tục ván.</div>}
    <header className={styles.topbar}><button type="button" className={styles.menuToggle} aria-label={mobileOpen ? 'Đóng điều hướng' : 'Mở điều hướng'} aria-expanded={mobileOpen} aria-controls="arena-navigation" onClick={() => setMobileOpen((s) => !s)}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button><button type="button" className={styles.brand} onClick={() => navigate('home')} aria-label="ChessArena, về sảnh"><span className={styles.brandIcon}><Crown size={20} /></span><span>Chess<span>Arena</span></span></button><span className={styles.topDivider} /><span className={styles.breadcrumb}>Không gian cờ vua <ChevronRight size={13} /><strong>{title}</strong></span><div className={styles.topbarActions}><span className={styles.serverStatus}><ShieldCheck size={14} /><span>{state.status === 'ready' ? 'Đã kết nối' : signedIn ? 'Đang kết nối' : 'Cờ vua online'}</span></span><button type="button" className={styles.themeButton} aria-label={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'} onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><NotificationCenter /><AccountMenu onSignIn={() => setAuthMode('login')} /></div></header>
    <div className={styles.appBody}>{mobileOpen && <button type="button" className={styles.menuScrim} aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}<aside className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''}`} id="arena-navigation"><div className={styles.sidebarGroup}><p className={styles.sidebarLabel}>{adminView ? 'QUẢN TRỊ' : 'KHÔNG GIAN CỦA BẠN'}</p>{nav.map(({ key, label, icon: Icon }) => <button key={key} type="button" className={styles.navItem} data-active={screen === key || key === 'play' && ['game', 'queue'].includes(screen)} aria-current={screen === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={17} /><span>{label}</span></button>)}</div><div className={styles.sidebarBottom}>{(adminAccess === 'allowed' || adminView) && <button type="button" className={styles.adminSwitch} onClick={() => navigate(adminView ? 'home' : 'admin-overview')}><ShieldCheck size={16} />{adminView ? 'Về sảnh cờ' : 'Quản trị'}</button>}<div className={styles.sidebarUser}><span className={styles.sidebarAvatar}>{account?.name?.[0]?.toUpperCase() || <UserRound size={16} />}</span><span><strong>{account?.name || 'Khách'}</strong><small>{signedIn ? 'Đã đăng nhập' : 'Chưa đăng nhập'}</small></span></div></div></aside>
    <main className={styles.mainArea} id="main-content" tabIndex={-1}>
      {signedIn && state.status === 'replaced' && <div className={online.notice} role="alert">Bạn đã mở game ở nơi khác. <button type="button" className={online.secondaryButton} onClick={() => client.reclaim()}>Dùng ở đây</button></div>}
      {signedIn && ['connecting', 'reconnecting'].includes(state.status) && <div className={online.notice} role="status">{state.status === 'reconnecting' ? 'Mất kết nối. Đang tự kết nối lại… Máy chủ chờ tối đa 60 giây trong ván.' : 'Đang kết nối bàn cờ…'}</div>}
      {content}{screen !== 'game' && <footer className={online.footer}><span>ChessArena · Mỗi nước đi đều đáng giá.</span><button type="button" onClick={() => navigate('privacy')}>Quyền riêng tư</button><button type="button" onClick={() => navigate('terms')}>Điều khoản</button></footer>}
      {!['game', 'queue'].includes(screen) && <nav className={styles.mobileNav} aria-label="Điều hướng nhanh">{NAV.map(({ key, label, icon: Icon }) => <button key={key} type="button" data-active={screen === key} onClick={() => navigate(key)}><Icon size={18} /><span>{label}</span></button>)}</nav>}
    </main></div>{authMode && <AuthDialog initialMode={authMode} onClose={() => setAuthMode(null)} />}<Toaster />
  </div>
}

function Preferences({ theme, setTheme, sound, setSound, boardTheme, setBoardTheme, account, signedIn, onAuth }) {
  return <div className={styles.settingsContent}><section className={styles.settingsPanel}><h2>Giao diện</h2><div className={styles.themeChoices}>{[['dark', 'Tối', Moon], ['light', 'Sáng', Sun]].map(([value, label, Icon]) => <button type="button" key={value} aria-pressed={theme === value} data-selected={theme === value} onClick={() => setTheme(value)}><Icon size={18} />{label}</button>)}</div></section><section className={styles.settingsPanel}><h2>Màu bàn cờ</h2><div className={styles.boardThemeChoices}>{[['forest', 'Rừng'], ['slate', 'Đá phiến'], ['paper', 'Giấy']].map(([value, label]) => <button type="button" key={value} data-selected={boardTheme === value} aria-pressed={boardTheme === value} onClick={() => setBoardTheme(value)}><span className={styles.themeSwatch} data-theme={value} />{label}</button>)}</div></section><section className={styles.settingsPanel}><h2>Âm thanh</h2><button type="button" className={styles.toggle} role="switch" aria-checked={sound} aria-label="Âm thanh" data-enabled={sound} onClick={() => setSound((s) => !s)}><span /></button></section><section className={styles.settingsPanel}><h2>Tài khoản</h2>{account ? <AccountSettings account={account} /> : signedIn ? <p>Đang tải hồ sơ tài khoản…</p> : <button type="button" className={styles.primaryButton} onClick={onAuth}>Đăng nhập tài khoản</button>}</section></div>
}

function Help({ onBack }) {
  return <><span className={online.eyebrow}>LÀM QUEN VỚI BÀN CỜ</span><h1>Sẵn sàng cho nước đi đầu tiên?</h1><section className={styles.settingsPanel}><h2>Chọn cách chơi</h2><p>Tìm trận để chơi cờ tiêu chuẩn với người đang online, 10 phút mỗi bên và cộng 5 giây sau mỗi nước. Đánh với máy không có đồng hồ; bạn có thể chọn Trắng, Đen hoặc ngẫu nhiên.</p><h2>Di chuyển quân</h2><p>Bấm một quân rồi chọn ô được đánh dấu, hoặc kéo thả quân vào ô đó. Có thể dùng phím mũi tên và Enter. Khi tốt tới hàng cuối, chọn Hậu, Xe, Tượng hoặc Mã để phong cấp.</p><h2>Thêm một chút bất ngờ</h2><p>Ở chế độ mở rộng, chọn nhân vật đầu ván, thu thập thẻ và thích nghi với thời tiết. Xem “Season này có gì?” tại sảnh để tìm hiểu các kỹ năng và hiệu ứng.</p><h2>Khi kết nối gián đoạn</h2><p>Giữ tab mở và khôi phục mạng. Ván sẽ được đồng bộ tự động khi kết nối lại; bạn có 60 giây trước khi bị xử thua. Nếu mở game ở tab khác, bấm “Dùng ở đây” để quay lại tab này.</p></section><button type="button" className={styles.primaryButton} onClick={onBack}><ArrowLeft size={17} /> Về sảnh cờ</button></>
}
