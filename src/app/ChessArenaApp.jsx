import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck,
  Bot, Check, ChevronRight,
  CircleHelp, Clock3, Crown, Flag, Gamepad2, Gauge, Handshake, History,
  Home, Info, Medal, Menu, Moon, MoreHorizontal, Play, Plus, Search,
  Settings, Shield, ShieldCheck, Swords, Sun, Timer, Trophy,
  UserRound, Users, Volume2, X, Zap,
} from 'lucide-react'
import AccountMenu from '@/features/auth/AccountMenu'
import AuthDialog from '@/features/auth/AuthDialog'
import AccountSettings from '@/features/auth/AccountSettings'
import AdminConsole from '@/features/admin/AdminConsole'
import { ADMIN_PAGES } from '@/features/admin/adminPages'
import { useAdminAccess } from '@/features/admin/useAdminAccess'
import NotificationCenter from '@/features/notifications/NotificationCenter'
import Toaster from '@/components/ui/Toaster'
import { GameMode } from '@/games/chess'
import ChessBoard, { PieceArt } from '@/features/chess/ChessBoard'
import { buildReplay, moveLabel, SAMPLE_HISTORY } from '@/features/chess/replay'
import ChessRoom from '@/features/chess/ChessRoom'
import BotLevelPicker from '@/features/chess/BotLevelPicker'
import { getBotLevel } from '@/games/chess/bot/stockfish/levels'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAuthStore } from '@/stores/useAuthStore'
import styles from './ChessArenaApp.module.css'

const PLAYER_NAV = [
  { key: 'home', label: 'Tổng quan', icon: Home },
  { key: 'play', label: 'Chơi cờ', icon: Swords },
  { key: 'leaderboard', label: 'Xếp hạng', icon: Trophy },
  { key: 'friends', label: 'Bạn bè', icon: Users, members: true },
  { key: 'history', label: 'Lịch sử đấu', icon: History },
]
const ADMIN_NAV = ADMIN_PAGES
const MODES = [
  { key: 'ranked', title: 'Đấu xếp hạng', detail: 'Tìm đối thủ ngang trình', icon: Trophy, tone: 'lead' },
  { key: 'friend', title: 'Chơi cùng bạn', detail: 'Tạo phòng mời riêng', icon: Handshake },
  { key: 'practice', title: 'Luyện với máy', detail: 'Đi từng nước theo nhịp của bạn', icon: Bot },
]
const SPEEDS = [
  { key: 'bullet', name: 'Bullet', time: '1 + 0', detail: '1 phút mỗi bên, không cộng thêm giây' },
  { key: 'blitz', name: 'Blitz', time: '5 + 0', detail: '5 phút mỗi bên, không cộng thêm giây' },
  { key: 'rapid', name: 'Rapid', time: '10 + 5', detail: '10 phút mỗi bên, cộng 5 giây sau mỗi nước' },
]
const PREVIEW_FRAMES = buildReplay()
const DEMO_PLAYERS = [
  { name: 'Minh Anh', rating: 1842, country: 'VN', win: 72 },
  { name: 'quietrook', rating: 1796, country: 'SG', win: 65 },
  { name: 'Khai Nguyen', rating: 1753, country: 'VN', win: 61 },
  { name: 'lanternbishop', rating: 1718, country: 'TH', win: 58 },
  { name: 'Mira_64', rating: 1689, country: 'JP', win: 54 },
  { name: 'Bạn (mẫu)', rating: 1684, country: 'VN', win: 67, self: true },
]

function getSavedTheme() {
  try {
    const saved = localStorage.getItem('chessarena.theme')
    return saved === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function ChessMark({ small = false }) {
  return (
    <span className={small ? styles.brandIconSmall : styles.brandIcon} aria-hidden="true">
      <Crown size={small ? 17 : 20} strokeWidth={2.2} />
    </span>
  )
}

function DemoBadge({ children = 'Bản mô phỏng' }) {
  return <span className={styles.demoBadge}><Info size={13} />{children}</span>
}

function PageTitle({ eyebrow, title, description, actions }) {
  return (
    <div className={styles.pageTitle}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className={styles.pageDescription}>{description}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </div>
  )
}

function MiniBoard({ ply = 1 }) {
  const pieces = PREVIEW_FRAMES[Math.min(ply, PREVIEW_FRAMES.length - 1)].pieces
  return (
    <div className={styles.miniBoard} role="img" aria-label="Bàn cờ minh họa thế khai cuộc">
      {Array.from({ length: 64 }, (_, index) => {
        const rowIndex = Math.floor(index / 8)
        const colIndex = index % 8
        const piece = pieces.find((item) => item.row === rowIndex && item.col === colIndex)
        const dark = (rowIndex + colIndex) % 2 === 1
        return (
          <span key={`${rowIndex}-${colIndex}`} className={dark ? styles.miniDark : styles.miniLight}>
            {piece && <span className={styles.miniPiece}><PieceArt side={piece.side} type={piece.type} /></span>}
          </span>
        )
      })}
    </div>
  )
}

function Metric({ label, value, change, icon: Icon }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}><Icon size={17} /></span>
      <span className={styles.metricText}><span>{label}</span><strong>{value}</strong></span>
      {change && <span className={styles.metricChange}>{change}</span>}
    </div>
  )
}

function WelcomeScreen({ account, onNavigate, onAuth }) {
  const firstName = account?.name?.trim()?.split(/\s+/)[0]
  return (
    <>
      <PageTitle
        eyebrow="KHU VỰC NGƯỜI CHƠI"
        title={firstName ? `Chào ${firstName}.` : 'Một ván cờ nhé?'}
        description="Chọn nhịp chơi phù hợp, xem lại các ván đấu và theo dõi phong độ của bạn."
        actions={<DemoBadge />}
      />
      <section className={styles.heroPanel}>
        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}><Swords size={15} /> PHÒNG CỜ CHESSARENA</span>
          <h2>Mỗi nước đi,<br />một lựa chọn.</h2>
          <p>Thi đấu cùng máy ngay bây giờ. Ghép trận xếp hạng đang ở chế độ mô phỏng.</p>
          <button className={styles.primaryButton} type="button" onClick={() => onNavigate('play')}>
            <Play size={17} fill="currentColor" /> Chơi cờ <ArrowRight size={16} />
          </button>
          {!account && (
            <button className={styles.inlineLink} type="button" onClick={() => onAuth('register')}>
              Tạo tài khoản để lưu hồ sơ <ArrowUpRight size={14} />
            </button>
          )}
        </div>
        <div className={styles.heroBoard}><MiniBoard /></div>
        <div className={styles.heroCaption}><span><i /> Phòng luyện tập</span><span><Clock3 size={14} /> 10 phút</span></div>
      </section>

      <div className={styles.sectionHeading}>
        <div><h2>Chọn cách chơi</h2><p>Mỗi chế độ có một nhịp riêng.</p></div>
        <button className={styles.textButton} type="button" onClick={() => onNavigate('play')}>Xem mọi chế độ <ArrowRight size={15} /></button>
      </div>
      <section className={styles.modeStrip} aria-label="Chế độ chơi">
        {MODES.map(({ key, title, detail, icon: Icon, tone }) => (
          <button key={key} className={tone === 'lead' ? styles.modeLead : styles.modeItem} type="button" onClick={() => onNavigate('play', key)}>
            <span className={styles.modeIcon}><Icon size={19} /></span>
            <span><strong>{title}</strong><small>{detail}</small></span>
            <ChevronRight className={styles.modeChevron} size={17} />
          </button>
        ))}
      </section>

      <section className={styles.overviewGrid}>
        <div className={styles.formCard}>
          <div className={styles.cardHeader}><div><h2>Phong độ gần đây</h2><p>Tháng này, mọi chế độ</p></div><DemoBadge /></div>
          <div className={styles.performance}>
            <div className={styles.donut} aria-label="Mô phỏng 12 ván thắng trên 18 ván"><span><strong>67%</strong><small>Tỉ lệ thắng</small></span></div>
            <div className={styles.recordList}>
              <span><i className={styles.winDot} /> Thắng <strong>12</strong></span>
              <span><i className={styles.drawDot} /> Hòa <strong>3</strong></span>
              <span><i className={styles.lossDot} /> Thua <strong>3</strong></span>
            </div>
          </div>
          <p className={styles.finePrint}>Số liệu minh họa, sẽ thay thế khi có API thống kê.</p>
        </div>
        <div className={styles.recentPanel}>
          <div className={styles.cardHeader}><div><h2>Ván đấu mẫu</h2><p>Lịch sử cá nhân chưa đồng bộ</p></div><History size={18} /></div>
          <div className={styles.recentGame}>
            <span className={styles.resultMark}><Check size={16} /></span>
            <span className={styles.recentGameText}><strong>Thắng trước rook_88</strong><small>Blitz · 5 phút · 8 nước</small></span>
            <span className={styles.resultRating}>+12</span>
          </div>
          <div className={styles.recentGame}>
            <span className={styles.resultMark} data-draw="true"><span>=</span></span>
            <span className={styles.recentGameText}><strong>Hòa với mai.an</strong><small>Rapid · 10 phút · 24 nước</small></span>
            <span className={styles.resultRating} data-neutral="true">0</span>
          </div>
          <button className={styles.fullWidthLink} type="button" onClick={() => onNavigate('history')}>Mở lịch sử mô phỏng <ArrowRight size={15} /></button>
        </div>
      </section>
    </>
  )
}

function PlayScreen({ defaultMode, defaultBotLevel, onStart, onInvite }) {
  const [mode, setMode] = useState(defaultMode || 'ranked')
  const [botLevel, setBotLevel] = useState(() => getBotLevel(defaultBotLevel).key)
  const [speed, setSpeed] = useState('blitz')
  const selectedSpeed = SPEEDS.find((item) => item.key === speed) ?? SPEEDS[1]
  const selectedMode = MODES.find((item) => item.key === mode) ?? MODES[0]
  return (
    <>
      <PageTitle eyebrow="CHỌN ĐỐI THỦ" title="Sẵn sàng nhập cuộc?" description="Chọn chế độ và nhịp thời gian. Ván đấu trong prototype đang chạy cục bộ." />
      <div className={styles.playLayout}>
        <section className={styles.playSetup}>
          <fieldset className={styles.choiceField}>
            <legend><span>01</span> Chế độ thi đấu</legend>
            <div className={styles.modeChoices}>
              {MODES.map(({ key, title, detail, icon: Icon }) => (
                <button key={key} type="button" className={styles.modeChoice} data-selected={mode === key} aria-pressed={mode === key} onClick={() => setMode(key)}>
                  <Icon size={19} /><span><strong>{title}</strong><small>{detail}</small></span>{mode === key && <Check size={16} />}
                </button>
              ))}
            </div>
            {mode === 'ranked' && <p className={styles.simulationHint}><Info size={15} /> Ghép đối thủ và điểm xếp hạng chỉ là mô phỏng. API chưa hỗ trợ thi đấu realtime.</p>}
          </fieldset>

          <fieldset className={styles.choiceField}>
            <legend><span>02</span> Thời gian mỗi ván</legend>
            <div className={styles.speedChoices}>
              {SPEEDS.map((item) => (
                <button key={item.key} type="button" className={styles.speedChoice} data-selected={speed === item.key} aria-pressed={speed === item.key} onClick={() => setSpeed(item.key)}>
                  <small>{item.name}</small><strong>{item.time}</strong>
                </button>
              ))}
            </div>
            <p className={styles.speedDetail}><Clock3 size={15} /> {selectedSpeed.detail}. Đồng hồ chạy cục bộ và không tính xếp hạng.</p>
          </fieldset>

          <BotLevelPicker value={botLevel} onChange={setBotLevel} />
          <div className={styles.playCtas}>
            <button type="button" className={styles.primaryButton} onClick={() => mode === "friend" ? onInvite(speed, botLevel) : onStart(mode, speed, botLevel)}>
              {mode === 'practice' ? <Bot size={17} /> : mode === 'friend' ? <Handshake size={17} /> : <Search size={17} />}
              {mode === 'practice' ? 'Luyện với máy' : mode === 'friend' ? 'Tạo phòng mời' : 'Tìm đối thủ'}
              <ArrowRight size={16} />
            </button>
            {mode === 'friend' && <button type="button" className={styles.secondaryButton} onClick={() => onStart("practice", speed, botLevel)}><Bot size={16} /> Chơi thử với bot</button>}
          </div>
        </section>

        <aside className={styles.opponentPanel}>
          <div className={styles.opponentTop}><div className={styles.opponentMark}><selectedMode.icon size={21} /></div><DemoBadge>{mode === "practice" ? "Engine cục bộ" : "Ghép trận demo"}</DemoBadge></div>
          <h2>{selectedMode.title}</h2>
          <p>{mode === 'ranked' ? 'Đối thủ được chọn ngẫu nhiên để minh họa luồng ghép trận.' : mode === 'friend' ? 'Mời bạn bằng mã phòng trong phiên trải nghiệm.' : 'Luyện với Stockfish 19 Lite ngay trên trình duyệt. Chọn cấp để thay đổi mức tính toán của máy.'}</p>
          <div className={styles.opponentStats}><span>Đối thủ dự kiến</span><strong>{mode === 'practice' ? 'Stockfish · ' + getBotLevel(botLevel).label : 'Stockfish (ván demo)'}</strong></div>
          <div className={styles.opponentStats}><span>Điểm xếp hạng</span><strong>{mode === 'ranked' ? 'Khoảng 1.600' : 'Không tính'}</strong></div>
          <p className={styles.finePrint}>{mode === "practice" ? "Stockfish mã nguồn mở. Ván luyện tập không cập nhật điểm xếp hạng." : "Đối thủ online chưa được nối. Ván thử nghiệm chạy bằng Stockfish."}</p>
        </aside>
      </div>
    </>
  )
}

function QueueScreen({ mode, speed, onCancel, onEnter }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [])
  const time = SPEEDS.find((item) => item.key === speed)?.time ?? '5 + 0'
  const name = mode === 'practice' ? 'Đang chuẩn bị bàn tập' : 'Đang tìm đối thủ mô phỏng'
  return (
    <section className={styles.queueScreen}>
      <div className={styles.queueMark}><Search size={24} /></div>
      <DemoBadge>Ghép trận mô phỏng</DemoBadge>
      <h1>{name}</h1>
      <p>Luồng ghép trận chưa nối máy chủ. Sau bước này, ván sẽ được chuyển sang bot cục bộ.</p>
      <div className={styles.queueMeta}><span><Timer size={16} /> Đã chờ {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span><span><Clock3 size={16} /> {time}</span></div>
      <div className={styles.queueSearch} aria-hidden="true"><span /><i /><b /></div>
      <div className={styles.queueOpponent}><span className={styles.opponentAvatar}><Bot size={19} /></span><span><strong>Đối thủ thử nghiệm</strong><small>Stockfish · Không tính điểm</small></span><span className={styles.onlineBadge}><i /> Sẵn sàng</span></div>
      <div className={styles.queueActions}><button className={styles.primaryButton} type="button" onClick={onEnter}><Play size={16} /> Vào ván thử nghiệm <ArrowRight size={15} /></button><button className={styles.textButton} type="button" onClick={onCancel}>Hủy tìm</button></div>
    </section>
  )
}

function TrendChart({ compact = false, kind = 'rating' }) {
  const matches = kind === 'matches'
  const values = matches ? [962, 1048, 1001, 1120, 1194, 1142, 1284] : [1510, 1548, 1561, 1602, 1630, 1684]
  const width = compact ? 182 : 460
  const height = compact ? 80 : 136
  const left = compact ? 4 : 38
  const bottom = compact ? 76 : 114
  const min = matches ? 900 : 1500
  const max = matches ? 1300 : 1700
  const points = values.map((value, index) => [left + index * (width - left - 14) / (values.length - 1), bottom - (value - min) / (max - min) * (bottom - 12)])
  const path = points.map(([x, y], index) => (index ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ')
  const gradient = matches ? 'chart-matches' : compact ? 'chart-rating-small' : 'chart-rating'
  return <svg className={compact ? styles.chartCompact : styles.chart} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={matches ? 'Số trận mô phỏng trong 7 ngày, từ 962 đến 1.284 trận mỗi ngày' : 'Điểm Blitz mẫu từ 1.510 đến 1.684, tháng 6 đến tháng 11 năm 2026'}>
    <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--color-text-link)" stopOpacity=".2" /><stop offset="1" stopColor="var(--color-text-link)" stopOpacity="0" /></linearGradient></defs>
    {!compact && [min, (min + max) / 2, max].map((value) => { const y = bottom - (value - min) / (max - min) * (bottom - 12); return <g key={value}><path d={'M' + left + ' ' + y + 'H446'} stroke="var(--color-border-default)" strokeDasharray="3 5" /><text x="0" y={y + 3}>{value.toLocaleString('vi-VN')}</text></g> })}
    <path d={path + ' L' + points.at(-1)[0] + ' ' + bottom + ' L' + left + ' ' + bottom + ' Z'} fill={'url(#' + gradient + ')'} />
    <path d={path} fill="none" stroke="var(--color-text-link)" strokeWidth={compact ? '2.4' : '3'} strokeLinejoin="round" strokeLinecap="round" />
    {!compact && <><text x="38" y="134">Thg 6</text><text x="170" y="134">Thg 8</text><text x="302" y="134">Thg 10</text><text x="406" y="134">Thg 11</text></>}
  </svg>
}

function LeaderboardScreen() {
  const [period, setPeriod] = useState('Blitz')
  const [range, setRange] = useState('Tháng này')
  const [query, setQuery] = useState('')
  const ranked = DEMO_PLAYERS.map((player, index) => ({ ...player, rating: player.rating + (period === 'Rapid' ? 31 * (index % 2 ? 2 : -1) : period === 'Bullet' ? -44 * (index + 1) : 0) + (range === 'Tuần này' ? -19 * index : range === 'Mọi thời điểm' ? 42 : 0) })).sort((a, b) => b.rating - a.rating).map((player, index) => ({ ...player, rank: index + 1 }))
  const rows = ranked.filter((player) => player.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <>
      <PageTitle eyebrow="THÀNH TÍCH CỘNG ĐỒNG" title="Bảng xếp hạng" description="Theo dõi những người chơi nổi bật theo từng nhịp đấu." actions={<DemoBadge />} />
      <div className={styles.pageControls}>
        <div className={styles.segmented} role="group" aria-label="Chọn chế độ xếp hạng">
          {['Bullet', 'Blitz', 'Rapid'].map((item) => <button key={item} type="button" aria-pressed={period === item} data-selected={period === item} onClick={() => setPeriod(item)}>{item}</button>)}
        </div>
        <SelectMenu label="Kỳ xếp hạng" value={range} onChange={setRange} options={["Tuần này", "Tháng này", "Mọi thời điểm"]} /><label className={styles.searchField}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm người chơi" aria-label="Tìm người chơi" /></label>
      </div>
      <section className={styles.leaderboardFeature}>
        <div><span className={styles.leadIcon}><Trophy size={21} /></span><p className={styles.eyebrow}>DẪN ĐẦU {period.toUpperCase()}</p><h2>{ranked[0].name}</h2><p>Phong độ bền bỉ qua những ván cờ gần đây.</p></div>
        <div className={styles.leaderScore}><strong>{ranked[0].rating.toLocaleString("vi-VN")}</strong><span>điểm demo</span><span className={styles.positive}><ArrowUpRight size={14} /> +36 tháng này</span></div>
        <div className={styles.leaderChart}><TrendChart compact /></div>
      </section>
      <div className={styles.tableCard}>
        <div className={styles.cardHeader}><div><h2>Người chơi nổi bật</h2><p>{range} · Bảng điểm mẫu</p></div><span className={styles.simulatedLabel}><Info size={13} /> Dữ liệu mẫu</span></div>
        <div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Hạng</th><th>Người chơi</th><th>Điểm {period}</th><th>Tỉ lệ thắng</th><th>Quốc gia</th></tr></thead><tbody>
          {rows.map((player) => <tr key={player.name} data-self={player.self}><td><span className={player.rank === 1 ? styles.topRank : styles.rankNumber}>{player.rank}</span></td><td><span className={styles.tablePlayer}><span className={styles.tableAvatar}>{player.name[0].toUpperCase()}</span><strong>{player.name}</strong>{player.country === 'VN' && <BadgeCheck size={15} />}</span></td><td className={styles.numeric}>{player.rating}</td><td><span className={styles.winValue}>{player.win}%</span></td><td>{player.country}</td></tr>)}
          {!rows.length && <tr><td colSpan="5"><div className={styles.emptyInline}><Search size={18} /> Không tìm thấy người chơi phù hợp.</div></td></tr>}
        </tbody></table></div>
      </div>
    </>
  )
}

function FriendsScreen() {
  const [filter, setFilter] = useState('Tất cả')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState(null)
  const [identifier, setIdentifier] = useState('')
  const [requests, setRequests] = useState(['lanternbishop', 'chess.linh'])
  const [accepted, setAccepted] = useState([])
  const friends = [
    { name: 'Minh Anh', status: 'Đang trong ván', online: true, rating: '1.842' },
    { name: 'rook_88', status: 'Đang rảnh', online: true, rating: '1.706' },
    { name: 'mai.an', status: 'Vừa hoạt động', online: false, rating: '1.581' },
    { name: 'quietbishop', status: 'Đang rảnh', online: true, rating: '1.493' },
    ...accepted.map((name) => ({ name, status: 'Mới kết bạn', online: false, rating: '1.500' })),
  ].filter((person) => person.name.toLowerCase().includes(query.toLowerCase()))
    .filter((person) => filter === 'Tất cả' || (filter === 'Đang hoạt động' ? person.online : !person.online))
  function acknowledge(text) { setNotice(text); setDialog(null) }
  return <>
    <PageTitle eyebrow="CỘNG ĐỒNG" title="Bạn bè" description="Theo dõi người chơi và thử gửi lời mời. Mọi thao tác ở đây đều là mô phỏng." actions={<DemoBadge />} />
    <section className={styles.friendSummary}><span className={styles.friendSummaryIcon}><Users size={21} /></span><div><strong>{4 + accepted.length} người bạn</strong><small>3 người đang hoạt động (mẫu)</small></div><button className={styles.secondaryButton} type="button" onClick={() => setDialog({ kind: 'add' })}><Plus size={16} /> Thêm bạn</button></section>
    {notice && <div className={styles.inlineNotice} role="status"><Check size={16} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Đóng"><X size={16} /></button></div>}
    {requests.length > 0 && <section className={styles.requestsPanel}><h2>Lời mời kết bạn <span>({requests.length})</span></h2>{requests.map((name) => <div className={styles.requestRow} key={name}><span className={styles.tableAvatar}>{name[0].toUpperCase()}</span><strong>{name}</strong><button type="button" className={styles.secondaryButton} onClick={() => { setAccepted((items) => [...items, name]); setRequests((items) => items.filter((item) => item !== name)); setNotice('Đã chấp nhận ' + name + ' trong phiên demo.') }}><Check size={15} /> Chấp nhận</button><button type="button" className={styles.iconAction} aria-label={'Từ chối lời mời của ' + name} onClick={() => setRequests((items) => items.filter((item) => item !== name))}><X size={17} /></button></div>)}</section>}
    <div className={styles.pageControls}><div className={styles.segmented} role="group" aria-label="Lọc danh sách bạn bè">{['Tất cả', 'Đang hoạt động', 'Ngoại tuyến'].map((value) => <button type="button" key={value} data-selected={filter === value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div><label className={styles.searchField}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bạn bè" aria-label="Tìm bạn bè" /></label></div>
    <section className={styles.friendsList}>{friends.map((friend, index) => <div className={styles.friendRow} key={friend.name}><span className={styles.friendAvatar} data-variant={index % 3}>{friend.name[0].toUpperCase()}<i data-online={friend.online} /></span><span className={styles.friendIdentity}><strong>{friend.name}</strong><small>{friend.status} · {friend.rating} điểm</small></span>{friend.online && <span className={styles.statusText}><i /> Đang hoạt động</span>}<button className={styles.iconAction} type="button" aria-label={'Thách đấu ' + friend.name} onClick={() => acknowledge('Đã ghi nhận thách đấu ' + friend.name + ' trong demo. Chưa gửi qua máy chủ.')}><Swords size={17} /></button><button className={styles.iconAction} type="button" aria-label={'Xem hồ sơ mẫu của ' + friend.name} onClick={() => setDialog({ kind: 'profile', friend })}><UserRound size={17} /></button></div>)}
      {!friends.length && <div className={styles.emptyState}><Users size={26} /><strong>Chưa thấy bạn bè nào</strong><span>Thử đổi bộ lọc hoặc tìm bằng tên khác.</span></div>}
    </section>
    {dialog?.kind === 'add' && <SimpleModal title="Thêm bạn trong demo" description="Lời mời chỉ được ghi nhận trong phiên. Không gửi tới tài khoản thật." labelledBy="add-friend-title" onClose={() => setDialog(null)}><form onSubmit={(event) => { event.preventDefault(); if (identifier.trim()) { acknowledge('Đã ghi nhận lời mời tới ' + identifier.trim() + ' (demo).'); setIdentifier('') } }}><label className={styles.formLabel}>Tên người chơi hoặc email<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required maxLength={100} placeholder="Ví dụ: rook_88" /></label><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setDialog(null)}>Hủy</button><button type="submit" className={styles.primaryButton} disabled={!identifier.trim()}><Plus size={16} /> Ghi nhận lời mời demo</button></div></form></SimpleModal>}
    {dialog?.kind === 'profile' && <SimpleModal title={dialog.friend.name} description="Hồ sơ người chơi mẫu" labelledBy="friend-profile-title" onClose={() => setDialog(null)}><div className={styles.friendProfile}><span className={styles.profileAvatar}>{dialog.friend.name[0].toUpperCase()}</span><div><strong>{dialog.friend.rating} Blitz</strong><p>{dialog.friend.status}</p><DemoBadge /></div></div><div className={styles.dialogActions}><button type="button" className={styles.dangerAction} onClick={() => acknowledge('Đã ghi nhận báo cáo mẫu về ' + dialog.friend.name + '. Chưa gửi tới máy chủ.')}><Flag size={16} /> Báo cáo demo</button><button type="button" className={styles.primaryButton} onClick={() => acknowledge('Đã ghi nhận thách đấu ' + dialog.friend.name + ' trong demo.')}><Swords size={16} /> Thách đấu demo</button></div></SimpleModal>}
  </>
}

function HistoryScreen({ onReview, lastGame }) {
  const [result, setResult] = useState('Tất cả')
  const [period, setPeriod] = useState('30 ngày')
  const [mode, setMode] = useState('Mọi chế độ')
  const games = [
    { name: 'rook_88', outcome: 'Thắng', mode: 'Blitz', time: '5 + 0', date: '20/11/2026, 10:42', days: 1, color: 'Trắng', change: '+12', moves: 28 },
    { name: 'mai.an', outcome: 'Hòa', mode: 'Rapid', time: '10 + 5', date: '12/11/2026, 21:18', days: 9, color: 'Đen', change: '0', moves: 42 },
    { name: 'quietrook', outcome: 'Thua', mode: 'Bullet', time: '1 + 0', date: '02/10/2026, 19:36', days: 50, color: 'Trắng', change: '-8', moves: 19 },
  ].filter((game) => result === 'Tất cả' || game.outcome === result)
    .filter((game) => mode === 'Mọi chế độ' || game.mode === mode)
    .filter((game) => period === 'Tất cả' || game.days <= (period === '7 ngày' ? 7 : period === '30 ngày' ? 30 : 90))
  return (
    <>
      <PageTitle eyebrow="PHÂN TÍCH TIẾN TRÌNH" title="Lịch sử đấu" description="Mở lại ván trong phiên hoặc xem lịch sử mẫu theo bộ lọc." actions={<DemoBadge />} />{lastGame && <section className={styles.sessionGame}><History size={21} /><div><strong>Ván vừa chơi trên thiết bị</strong><p>{lastGame.history.length} nước · Chỉ lưu trong phiên này</p></div><button type="button" className={styles.secondaryButton} onClick={() => onReview("local")}>Xem lại <ChevronRight size={15} /></button></section>}
      <div className={styles.ratingSummary}><div><span className={styles.eyebrow}>BLITZ HIỆN TẠI</span><strong>1.684</strong><span className={styles.positive}><ArrowUpRight size={14} /> +36 điểm trong tháng</span></div><div className={styles.summaryChart}><TrendChart compact /></div><div className={styles.summaryDivider} /><div><span className={styles.eyebrow}>CHUỖI THẮNG</span><strong>3 ván</strong><span className={styles.dimText}>Kỷ lục: 5 ván</span></div></div>
      <div className={styles.pageControls}><div className={styles.segmented} role="group" aria-label="Lọc kết quả">{['Tất cả', 'Thắng', 'Hòa', 'Thua'].map((value) => <button type="button" key={value} data-selected={result === value} aria-pressed={result === value} onClick={() => setResult(value)}>{value}</button>)}</div><SelectMenu label="Chế độ" value={mode} onChange={setMode} options={["Mọi chế độ", "Bullet", "Blitz", "Rapid"]} /><SelectMenu label="Khoảng thời gian" value={period} onChange={setPeriod} options={["30 ngày", "7 ngày", "3 tháng", "Tất cả"]} /></div>
      <section className={styles.tableCard}><div className={styles.cardHeader}><div><h2>Ván gần đây</h2><p>Kết quả và nước đi được làm mẫu</p></div><DemoBadge /></div><div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th>Kết quả</th><th>Đối thủ</th><th>Chế độ</th><th>Màu quân</th><th>Thời điểm</th><th>Điểm</th><th><span className={styles.srOnly}>Hành động</span></th></tr></thead><tbody>{games.map((game) => <tr key={game.name}><td><span className={styles.outcome} data-outcome={game.outcome}>{game.outcome}</span></td><td><strong>{game.name}</strong></td><td>{game.mode} <small>· {game.time}</small></td><td>{game.color}</td><td>{game.date}</td><td className={game.change.startsWith('+') ? styles.positive : styles.numeric}>{game.change}</td><td><button className={styles.tableAction} type="button" onClick={() => onReview(game)} aria-label={`Xem lại ván với ${game.name}`}>Xem lại <ChevronRight size={14} /></button></td></tr>)}{!games.length && <tr><td colSpan="7"><div className={styles.emptyInline}><History size={18} /> Không có ván khớp bộ lọc. Hãy chọn khoảng thời gian rộng hơn.</div></td></tr>}</tbody></table></div><p className={styles.finePrint}>Các ván mẫu không được lưu ở máy chủ.</p></section>
    </>
  )
}

function ProfileScreen({ account, onEdit }) {
  const name = account?.name || 'Người chơi mới'
  return (
    <>
      <PageTitle eyebrow="HỒ SƠ NGƯỜI CHƠI" title="Hồ sơ của bạn" description="Xem thông tin tài khoản và hành trình trên bàn cờ." actions={<DemoBadge />} />
      <section className={styles.profileHero}><span className={styles.profileAvatar}>{name[0]?.toUpperCase()}</span><div className={styles.profileInfo}><span className={styles.onlineBadge}><i /> HỒ SƠ CỦA TÔI</span><h2>{name}</h2><p>{account?.email || 'Đăng nhập để đồng bộ hồ sơ tài khoản.'}</p><span className={styles.memberDate}>{account ? "Tên và email từ API" : "Hồ sơ khách"} · Thành tích bên dưới là mẫu</span></div><button className={styles.secondaryButton} type="button" onClick={onEdit}><Settings size={15} /> Cài đặt</button></section>
      <div className={styles.profileRatings}><Metric label="Blitz" value="1.684" change="+36" icon={Zap} /><Metric label="Rapid" value="1.521" change="+18" icon={Clock3} /><Metric label="Bullet" value="1.390" change="-8" icon={Gauge} /><Metric label="Ván đã chơi" value="126" change="+18 tháng này" icon={Swords} /></div>
      <div className={styles.overviewGrid}><section className={styles.formCard}><div className={styles.cardHeader}><div><h2>Tiến trình xếp hạng</h2><p>Điểm Blitz trong 6 tháng</p></div><DemoBadge /></div><TrendChart /><div className={styles.chartLegend}><span><i /> Blitz</span><span>1.684 điểm</span></div></section><section className={styles.recentPanel}><div className={styles.cardHeader}><div><h2>Thành tích</h2><p>Thống kê mẫu</p></div><Medal size={19} /></div><div className={styles.achievement}><span><Trophy size={18} /></span><div><strong>Thắng liên tiếp</strong><small>3 ván liên tiếp</small></div><BadgeCheck size={17} /></div><div className={styles.achievement}><span><Activity size={18} /></span><div><strong>Kiên trì luyện tập</strong><small>18 ván trong tháng</small></div><BadgeCheck size={17} /></div></section></div>
    </>
  )
}

function SettingsScreen({ theme, onTheme, sound, setSound, boardTheme, setBoardTheme, account, onAuth }) {
  const [preferences, setPreferences] = useState({ challenges: true, messages: true, notifications: true })
  return (
    <>
      <PageTitle eyebrow="TÙY CHỈNH TRẢI NGHIỆM" title="Cài đặt" description="Điều chỉnh giao diện và âm thanh theo cách bạn chơi." />
      <section className={styles.settingsLayout}>
        <div className={styles.settingsContent}>
          <section className={styles.settingsPanel}><div className={styles.settingsHeading}><span className={styles.settingsIcon}><Sun size={18} /></span><div><h2>Giao diện</h2><p>Chọn sáng hoặc tối. Lựa chọn được nhớ trên thiết bị này.</p></div></div><div className={styles.themeChoices}><button type="button" aria-pressed={theme === 'dark'} data-selected={theme === 'dark'} onClick={() => onTheme('dark')}><Moon size={18} /><span><strong>Tối</strong><small>Dễ tập trung khi chơi đêm</small></span>{theme === 'dark' && <Check size={16} />}</button><button type="button" aria-pressed={theme === 'light'} data-selected={theme === 'light'} onClick={() => onTheme('light')}><Sun size={18} /><span><strong>Sáng</strong><small>Không gian dịu vào ban ngày</small></span>{theme === 'light' && <Check size={16} />}</button></div></section>
          <section className={styles.settingsPanel}><div className={styles.settingsHeading}><span className={styles.settingsIcon}><Gamepad2 size={18} /></span><div><h2>Bàn cờ và bộ quân</h2><p>Thử nhanh màu bàn. Thay đổi chỉ áp dụng cho phiên hiện tại.</p></div></div><div className={styles.boardThemeChoices}>{[['Rừng', 'forest'], ['Đá phiến', 'slate'], ['Giấy', 'paper']].map(([label, value]) => <button key={value} type="button" data-selected={boardTheme === value} aria-pressed={boardTheme === value} onClick={() => setBoardTheme(value)}><span className={styles.themeSwatch} data-theme={value} /><strong>{label}</strong>{boardTheme === value && <Check size={14} />}</button>)}</div></section>
          <section className={styles.settingsPanel}><div className={styles.settingsHeading}><span className={styles.settingsIcon}><Volume2 size={18} /></span><div><h2>Âm thanh</h2><p>Bật phản hồi nước đi và thông báo.</p></div><button className={styles.toggle} type="button" role="switch" aria-checked={sound} aria-label="Âm thanh" data-enabled={sound} onClick={() => setSound((value) => !value)}><span /></button></div></section>
          <section className={styles.settingsPanel}><div className={styles.settingsHeading}><span className={styles.settingsIcon}><Shield size={18} /></span><div><h2>Quyền riêng tư và thông báo</h2><p>Tùy chọn demo, chỉ áp dụng trong phiên này. Chưa cập nhật lên máy chủ.</p></div></div>{[["challenges", "Nhận lời mời thách đấu"], ["messages", "Cho phép tin nhắn từ bạn bè"], ["notifications", "Hiển thị thông báo cộng đồng"]].map(([key, label]) => <div className={styles.preferenceRow} key={key}><span>{label}</span><button type="button" className={styles.toggle} role="switch" aria-label={label} aria-checked={preferences[key]} data-enabled={preferences[key]} onClick={() => setPreferences((items) => ({ ...items, [key]: !items[key] }))}><span /></button></div>)}</section><section className={styles.settingsPanel}><div className={styles.settingsHeading}><span className={styles.settingsIcon}><Shield size={18} /></span><div><h2>Tài khoản</h2><p>{account?.email || 'Đăng nhập để xem hồ sơ và quản lý phiên.'}</p></div></div>{account ? <AccountSettings account={account} /> : <button className={styles.secondaryButton} type="button" onClick={onAuth}><UserRound size={15} /> Đăng nhập tài khoản</button>}</section>
        </div>
        <aside className={styles.settingsAside}><ShieldCheck size={20} /><strong>Quyền kiểm soát của bạn</strong><p>Cài đặt giao diện chỉ lưu trong trình duyệt. Mật khẩu không lưu tại đây.</p><span><Check size={14} /> Giao diện nhớ trên thiết bị</span><span><Check size={14} /> Phiên đăng nhập tách theo tab</span></aside>
      </section>
    </>
  )
}

export function AdminScreen({ page = 'overview', navigate = () => {}, onSignIn = () => {} }) {
  return <AdminConsole page={page} navigate={navigate} onSignIn={onSignIn} />
}

function SimpleModal({ title, description, children, onClose, labelledBy }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return <dialog ref={ref} className={styles.modalPanel} aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); onClose() }}><div className={styles.modalHead}><div><h2 id={labelledBy}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className={styles.iconAction} onClick={onClose} aria-label="Đóng"><X size={17} /></button></div>{children}</dialog>
}

export default function ChessArenaApp() {
  const [screen, setScreen] = useState(() => window.location.hash.slice(1) || 'home')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(getSavedTheme)
  const [sound, setSound] = useState(true)
  const [boardTheme, setBoardTheme] = useState('forest')
  const [authMode, setAuthMode] = useState(() => /^\/forgot\//.test(window.location.pathname) ? 'reset' : null)
  const [playMode, setPlayMode] = useState('ranked')
  const [playSpeed, setPlaySpeed] = useState('blitz')
  const [playBotLevel, setPlayBotLevel] = useState('medium')
  const [queueMode, setQueueMode] = useState('ranked')
  const [queueSpeed, setQueueSpeed] = useState('blitz')
  const [replay, setReplay] = useState(null)
  const [lastGame, setLastGame] = useState(null)
  const account = useAuthStore((state) => state.account)
  const signedIn = useAuthStore((state) => Boolean(state.session))
  const adminAccess = useAdminAccess()
  const playerNav = signedIn ? PLAYER_NAV : PLAYER_NAV.filter((item) => !item.members)
  const adminView = screen.startsWith('admin-')
  const adminPage = adminView ? screen.slice(6) : ''

  useEffect(() => {
    if (screen === 'admin-login') window.location.replace('#admin-overview')
    else if (screen.startsWith('admin-') && (adminAccess === 'guest' || adminAccess === 'denied')) window.location.replace('#home')
  }, [screen, adminAccess])
  const pageTitle = useMemo(() => ({
    home: 'Tổng quan',
    play: 'Chơi cờ',
    queue: 'Ghép trận mô phỏng',
    game: 'Ván đấu',
    leaderboard: 'Bảng xếp hạng',
    friends: 'Bạn bè',
    history: 'Lịch sử đấu',
    profile: 'Hồ sơ người chơi',
    settings: 'Cài đặt',
    help: 'Hướng dẫn',
    invite: 'Phòng mời',
    replay: 'Xem lại ván',
    'queue-ready': 'Sẵn sàng vào ván',
    privacy: 'Quyền riêng tư',
    terms: 'Điều khoản trải nghiệm',
  })[screen] ?? (screen.startsWith('admin-') ? ADMIN_NAV.find((item) => item.key === screen.slice(6))?.label : null) ?? 'ChessArena', [screen])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { localStorage.setItem('chessarena.theme', theme) } catch { /* storage is optional */ }
  }, [theme])

  useEffect(() => {
    const syncRoute = () => { setScreen(window.location.hash.slice(1) || 'home'); setMobileOpen(false) }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return undefined
    const previous = document.activeElement
    const menu = document.getElementById("arena-navigation")
    const controls = [...(menu?.querySelectorAll("button:not(:disabled), a[href]") || [])]
    const wide = window.matchMedia("(min-width: 48rem)")
    const resize = () => { if (wide.matches) setMobileOpen(false) }
    const keyboard = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setMobileOpen(false) }
      if (event.key === "Tab" && controls.length) {
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    controls[0]?.focus()
    document.addEventListener("keydown", keyboard)
    wide.addEventListener("change", resize)
    return () => { document.removeEventListener("keydown", keyboard); wide.removeEventListener("change", resize); previous?.focus() }
  }, [mobileOpen])

  useEffect(() => {
    document.title = `${pageTitle} | ChessArena`
    document.getElementById('main-content')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [screen, pageTitle])

  useEffect(() => {
    if (screen !== 'queue') return undefined
    const timeout = window.setTimeout(() => { window.location.hash = 'queue-ready' }, 2200)
    return () => window.clearTimeout(timeout)
  }, [screen])

  function navigate(next, detail) {
    if (next === 'play' && detail) setPlayMode(detail)
    setMobileOpen(false)
    setScreen(next)
    if (window.location.hash !== `#${next}`) window.location.hash = next
  }

  function startSelectedGame(mode, speed, level = playBotLevel) {
    setPlayBotLevel(getBotLevel(level).key)
    setPlayMode(mode)
    setPlaySpeed(speed)
    if (mode === 'practice') {
      navigate('game')
      return
    }
    setQueueMode(mode)
    setQueueSpeed(speed)
    navigate('queue')
  }

  function openReplay(history, result) {
    if (history) setLastGame({ history, result })
    setReplay(history ? { history, result } : null)
    navigate('replay')
  }

  const playerPages = {
    home: <WelcomeScreen account={account} onNavigate={navigate} onAuth={setAuthMode} />,
    play: <PlayScreen defaultMode={playMode} defaultBotLevel={playBotLevel} onStart={startSelectedGame} onInvite={(speed, level) => { setPlaySpeed(speed); setPlayBotLevel(getBotLevel(level).key); navigate('invite') }} />,
    leaderboard: <LeaderboardScreen />,
    friends: signedIn ? <FriendsScreen /> : <MembersOnly title="Đăng nhập để xem bạn bè" onSignIn={() => setAuthMode('login')} onBack={() => navigate('home')} />,
    history: <HistoryScreen lastGame={lastGame} onReview={(kind) => kind === 'local' ? openReplay(lastGame.history, lastGame.result) : openReplay()} />,
    profile: <ProfileScreen account={account} onEdit={() => navigate('settings')} />,
    settings: <SettingsScreen theme={theme} onTheme={setTheme} sound={sound} setSound={setSound} boardTheme={boardTheme} setBoardTheme={setBoardTheme} account={account} onAuth={() => setAuthMode('login')} />,
    help: <HelpScreen onNavigate={navigate} />,
    invite: <InviteScreen onBack={() => navigate('play', 'friend')} onStart={() => startSelectedGame('practice', playSpeed)} />,
    replay: <ReplayScreen replay={replay} onBack={() => navigate('history')} />,
    privacy: <LegalScreen privacy />,
    terms: <LegalScreen />,
  }

  return (
    <div className={styles.arena} data-theme={theme} data-board={boardTheme} data-screen={screen}>
      <a className={styles.skipLink} href="#main-content">Nhảy tới nội dung</a>
      <ConnectionNotice /><header className={styles.topbar}>
        <button type="button" className={styles.menuToggle} aria-label={mobileOpen ? 'Đóng điều hướng' : 'Mở điều hướng'} aria-expanded={mobileOpen} aria-controls="arena-navigation" onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
        <button type="button" className={styles.brand} onClick={() => navigate('home')} aria-label="ChessArena, về tổng quan"><ChessMark /><span>Chess<span>Arena</span></span></button>
        <span className={styles.topDivider} />
        <span className={styles.breadcrumb}>{adminView ? 'Quản trị' : 'Khu vực người chơi'} <ChevronRight size={13} /> <strong>{adminView ? ADMIN_NAV.find((item) => item.key === adminPage)?.label || 'Truy cập' : pageTitle}</strong></span>
        <div className={styles.topbarActions}>
          <span className={styles.serverStatus}><ShieldCheck size={14} /><span>API tài khoản</span></span>
          <button type="button" className={styles.themeButton} aria-label={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'} title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'} onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <NotificationCenter />
          <AccountMenu onSignIn={() => setAuthMode('login')} />
        </div>
      </header>

      <div className={styles.appBody}>
        {mobileOpen && <button type="button" className={styles.menuScrim} aria-label="Đóng menu điều hướng" onClick={() => setMobileOpen(false)} />}
        <aside className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''}`} id="arena-navigation" onKeyDown={(event) => { if (event.key === 'Escape') setMobileOpen(false) }}>
          <div className={styles.sidebarGroup}>
            <p className={styles.sidebarLabel}>{adminView ? 'QUẢN TRỊ' : 'MENU CHÍNH'}</p>
            {(adminView ? ADMIN_NAV : playerNav).map(({ key, label, icon: Icon, badge }) => {
              const route = adminView ? `admin-${key}` : key
              const selected = screen === route
              return <button type="button" key={key} className={styles.navItem} data-active={selected} aria-current={selected ? 'page' : undefined} onClick={() => navigate(route)}><Icon size={17} /><span>{label}</span>{badge && <small>{badge}</small>}</button>
            })}
          </div>
          {!adminView && <div className={styles.sidebarGroup}><p className={styles.sidebarLabel}>CÁ NHÂN</p><button type="button" className={styles.navItem} data-active={screen === 'profile'} onClick={() => navigate('profile')}><UserRound size={17} /><span>Hồ sơ của tôi</span></button><button type="button" className={styles.navItem} data-active={screen === 'settings'} onClick={() => navigate('settings')}><Settings size={17} /><span>Cài đặt</span></button><button type="button" className={styles.navItem} data-active={screen === 'help'} onClick={() => navigate('help')}><CircleHelp size={17} /><span>Hướng dẫn</span></button></div>}
          <div className={styles.sidebarBottom}>
            {signedIn && <button className={styles.sidebarInvite} type="button" onClick={() => navigate('play', 'friend')}><span><Users size={16} /></span><strong>Mời bạn chơi</strong><small>Phòng mời hiện là demo</small><ArrowUpRight size={15} /></button>}
            {(adminView || adminAccess === 'allowed') && <button className={styles.adminSwitch} type="button" onClick={() => navigate(adminView ? 'home' : 'admin-overview')}><ShieldCheck size={16} /> {adminView ? 'Về khu người chơi' : 'Quản trị'}</button>}
            <div className={styles.sidebarUser}><span className={styles.sidebarAvatar}>{account?.name?.[0]?.toUpperCase() || <UserRound size={16} />}</span><span><strong>{account?.name || 'Khách trải nghiệm'}</strong><small>{account ? 'Đã kết nối tài khoản' : 'Đăng nhập để xem hồ sơ'}</small></span><button type="button" aria-label="Mở cài đặt" onClick={() => navigate('settings')}><MoreHorizontal size={17} /></button></div>
          </div>
        </aside>

        <main className={styles.mainArea} id="main-content" tabIndex={-1} key={screen}>
          {adminView ? <AdminScreen page={adminPage} navigate={navigate} onSignIn={() => setAuthMode('login')} /> :
            screen === 'queue' ? <QueueScreen mode={queueMode} speed={queueSpeed} onCancel={() => navigate('play', queueMode)} onEnter={() => navigate('queue-ready')} /> :
              screen === 'queue-ready' ? <QueueReadyScreen mode={queueMode} speed={queueSpeed} onEnter={() => navigate('game')} onCancel={() => navigate('play', queueMode)} /> :
                screen === 'game' ? <ChessRoom embedded botLevel={playBotLevel} onBotLevelChange={setPlayBotLevel} onExit={() => navigate('home')} onFindGame={() => navigate('play')} onReview={openReplay} sound={sound} boardTheme={boardTheme} mode={GameMode.VS_BOT} timeControl={SPEEDS.find((item) => item.key === playSpeed)?.time} /> :
                  <div className={styles.pageContent}>{playerPages[screen] ?? <NotFound onBack={() => navigate('home')} />}<AppFooter navigate={navigate} /></div>}
          {screen !== 'game' && <nav className={styles.mobileNav} aria-label="Điều hướng nhanh">{(adminView ? ADMIN_NAV : playerNav).slice(0, 4).map(({ key, label, icon: Icon }) => { const route = adminView ? `admin-${key}` : key; return <button type="button" key={key} data-active={screen === route} aria-current={screen === route ? 'page' : undefined} onClick={() => navigate(route)}><Icon size={18} /><span>{label}</span></button> })}</nav>}
        </main>
      </div>

      {authMode && <AuthDialog initialMode={authMode} onClose={() => setAuthMode(null)} />}
      <Toaster />
    </div>
  )
}

function QueueReadyScreen({ mode, speed, onEnter, onCancel }) {
  const clock = SPEEDS.find((item) => item.key === speed)?.time ?? '5 + 0'
  return <section className={styles.queueScreen}><span className={styles.readyMark}><Check size={24} /></span><DemoBadge>Đối thủ thử nghiệm</DemoBadge><h1>Đã sẵn sàng vào ván.</h1><p>Đây là trận mô phỏng chạy với bot cục bộ. Chưa có người chơi thật được ghép.</p><div className={styles.readyVersus}><span><span className={styles.opponentAvatar}><UserRound size={19} /></span><strong>Bạn</strong><small>{mode === 'ranked' ? '1.684 demo' : 'Người chơi'}</small></span><span className={styles.versusMark}>VS</span><span><span className={styles.opponentAvatar}><Bot size={19} /></span><strong>Stockfish</strong><small>Engine cục bộ</small></span></div><div className={styles.queueMeta}><span><Clock3 size={16} /> {clock}</span><span><Info size={15} /> Điểm không cập nhật lên API</span></div><div className={styles.queueActions}><button type="button" className={styles.primaryButton} onClick={onEnter}><Play size={16} fill="currentColor" /> Bắt đầu ván <ArrowRight size={15} /></button><button type="button" className={styles.textButton} onClick={onCancel}>Đổi chế độ</button></div></section>
}

function InviteScreen({ onBack, onStart }) {
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [code, setCode] = useState('')
  const [joined, setJoined] = useState(false)
  async function copyCode() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText('ARENA-42K')
      setCopied(true)
      setNotice('Đã sao chép mã mẫu. Mã này không kết nối người chơi thật.')
    } catch { setCopied(false); setNotice('Trình duyệt chưa cho phép sao chép. Bạn có thể chọn mã ARENA-42K bằng tay.') }
  }
  return <><PageTitle eyebrow="CHƠI CÙNG BẠN" title="Phòng mời" description="Tạo và tham gia phòng mẫu. Chưa có phòng thật trên máy chủ." /><section className={styles.inviteLayout}>
    <div className={styles.invitePanel}><span className={styles.inviteIcon}><Handshake size={23} /></span><h2>Mời một người bạn</h2><p>Dùng mã bên dưới để thử thao tác sao chép và tham gia phòng demo.</p><div className={styles.inviteCode}><span>ARENA-42K</span><button type="button" className={styles.secondaryButton} onClick={copyCode}><Check size={15} /> {copied ? 'Đã sao chép' : 'Sao chép mã'}</button></div>
      <details className={styles.joinRoom}><summary>Tham gia bằng mã phòng mẫu</summary><form onSubmit={(event) => { event.preventDefault(); const valid = code.trim().toUpperCase() === 'ARENA-42K'; setJoined(valid); setNotice(valid ? 'Bạn đã vào phòng demo. Đang chờ đối thủ mô phỏng; có thể bắt đầu với bot bên dưới.' : 'Không tìm thấy phòng mẫu. Hãy dùng mã ARENA-42K.') }}><label className={styles.formLabel}>Mã phòng<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="ARENA-42K" maxLength={24} required autoComplete="off" /></label><button type="submit" className={styles.secondaryButton}>Tham gia demo <ArrowRight size={15} /></button></form></details>
      {notice && <p className={styles.inlineNotice} role="status"><Info size={16} />{notice}</p>}
      {joined && <p className={styles.waitingRoom}><Clock3 size={16} /> Đang chờ trong phòng mô phỏng</p>}
      <div className={styles.inviteActions}><button className={styles.primaryButton} type="button" onClick={onStart}><Bot size={16} /> Bắt đầu với bot <ArrowRight size={15} /></button><button className={styles.textButton} type="button" onClick={onBack}>Quay lại chế độ chơi</button></div>
    </div>
    <aside className={styles.inviteAside}><Info size={19} /><strong>Phòng thật chưa được nối</strong><p>Cần dịch vụ phòng chơi và realtime để mời, đồng bộ nước đi và xác nhận kết nối với người chơi khác.</p><DemoBadge /></aside>
  </section></>
}

function ReplayScreen({ replay, onBack }) {
  const history = replay?.history ?? SAMPLE_HISTORY
  const frames = useMemo(() => buildReplay(history), [history])
  const [move, setMove] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const current = Math.min(move, frames.length - 1)
  return <><PageTitle eyebrow="XEM LẠI VÁN" title={replay ? 'Ván vừa chơi của bạn' : 'Khai cuộc Tây Ban Nha'} description="Chọn một nước hoặc dùng các nút tiến, lùi để xem thế cờ thực tế." actions={<DemoBadge>{replay ? 'Lưu trong phiên này' : 'Ván mẫu hợp lệ'}</DemoBadge>} />
    <div className={styles.replayLayout}>
      <div className={styles.replayBoard}><ChessBoard view={frames[current]} flipped={flipped} blocked /><p className={styles.finePrint} role="status">{current === 0 ? 'Vị trí xuất phát' : 'Sau nước ' + Math.ceil(current / 2) + ': ' + moveLabel(history[current - 1])}</p></div>
      <section className={styles.replayPanel}>
        <div className={styles.replayPlayers}><span>Bạn <small>Trắng</small></span><span>{replay ? 'Stockfish' : 'Đối thủ mẫu'} <small>Đen</small></span></div>
        <div className={styles.replayMoves} aria-label="Danh sách nước đi">{history.slice(0, frames.length - 1).map((entry, index) => <button key={index} type="button" data-current={current === index + 1} aria-pressed={current === index + 1} onClick={() => setMove(index + 1)}><small>{Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'}</small>{moveLabel(entry)}</button>)}</div>
        <div className={styles.replayControls}>
          <button type="button" className={styles.secondaryButton} disabled={current === 0} aria-label="Về đầu" onClick={() => setMove(0)}><ArrowLeft size={16} /></button>
          <button type="button" className={styles.secondaryButton} disabled={current === 0} aria-label="Nước trước" onClick={() => setMove((value) => Math.max(0, value - 1))}><ChevronRight className={styles.previousMove} size={16} /></button>
          <span>{current} / {frames.length - 1}</span>
          <button type="button" className={styles.secondaryButton} disabled={current === frames.length - 1} aria-label="Nước tiếp theo" onClick={() => setMove((value) => Math.min(frames.length - 1, value + 1))}><ChevronRight size={16} /></button>
          <button type="button" className={styles.secondaryButton} disabled={current === frames.length - 1} aria-label="Đến cuối" onClick={() => setMove(frames.length - 1)}><ArrowRight size={16} /></button>
        </div>
        <button type="button" className={styles.textButton} aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}>Đổi góc nhìn bàn cờ</button>
        {!history.length && <p className={styles.finePrint}>Ván chưa có nước đi. Bàn cờ đang ở vị trí xuất phát.</p>}
      </section>
    </div>
    <div className={styles.simulationFootnote}><Info size={15} /> Nước đi được dựng lại bằng engine cờ của ứng dụng. Ván trong phiên chưa đồng bộ lên API.</div>
    <button className={styles.textButton} type="button" onClick={onBack}><ArrowLeft size={15} /> Về lịch sử đấu</button>
  </>
}

function HelpScreen({ onNavigate }) {
  return <><PageTitle eyebrow="BẮT ĐẦU NHANH" title="Hướng dẫn chơi" description="Các thao tác cơ bản để bắt đầu một ván cờ." /><section className={styles.helpGrid}><article className={styles.helpLead}><span className={styles.helpNumber}>01</span><h2>Chạm quân, rồi chạm ô đến.</h2><p>Các ô hợp lệ sẽ hiện trên bàn. Bạn cũng có thể dùng phím mũi tên để di chuyển focus, rồi nhấn Enter hoặc Space.</p><button className={styles.primaryButton} type="button" onClick={() => onNavigate('play')}>Chọn chế độ chơi <ArrowRight size={15} /></button></article><article className={styles.helpItem}><span className={styles.helpNumber}>02</span><h2>Đọc trạng thái bàn cờ</h2><p>Ô vàng cho biết nước vừa đi. Ô được đánh dấu đỏ báo vua đang bị chiếu.</p></article><article className={styles.helpItem}><span className={styles.helpNumber}>03</span><h2>Phong cấp tốt</h2><p>Khi tốt tới hàng cuối, chọn hậu, xe, tượng hoặc mã để hoàn tất lượt đi.</p></article><article className={styles.helpItem}><span className={styles.helpNumber}>04</span><h2>Chọn nhịp thi đấu</h2><p>Bullet, Blitz và Rapid có thời gian khác nhau. Đồng hồ chạy trên trình duyệt và tính theo từng lượt. Thi đấu thật cần đồng hồ do máy chủ xác thực.</p></article></section></>
}

function AppFooter({ navigate }) {
  return <footer className={styles.footer}><span><ChessMark small /> ChessArena <small>Giao diện trải nghiệm</small></span><div><button type="button" onClick={() => navigate('terms')}>Điều khoản demo</button><button type="button" onClick={() => navigate('privacy')}>Quyền riêng tư</button><button type="button" onClick={() => navigate('help')}>Hỗ trợ</button></div><span className={styles.footerVersion}>v0.1 · dữ liệu thử</span></footer>
}

function LegalScreen({ privacy = false }) {
  return <><PageTitle eyebrow="THÔNG TIN TRẢI NGHIỆM" title={privacy ? 'Quyền riêng tư' : 'Điều khoản bản thử nghiệm'} description="Thông tin về phiên prototype ChessArena." /><section className={styles.settingsPanel}>{privacy ? <><h2>Dữ liệu trong trình duyệt</h2><p>Giao diện sáng hoặc tối được nhớ bằng localStorage. Token đăng nhập lưu trong sessionStorage theo tab. Mật khẩu chỉ được gửi tới API khi bạn chủ động gửi biểu mẫu.</p><h2>Dữ liệu mô phỏng</h2><p>Bạn bè, xếp hạng và các bản ghi quản trị là dữ liệu mẫu. Thay đổi demo nằm trong bộ nhớ của trang và mất khi tải lại.</p></> : <><h2>Phạm vi sử dụng</h2><p>Bạn có thể chơi cờ với bot cục bộ và khám phá các màn hình mẫu. Ván đấu chưa tính điểm hoặc lưu trên máy chủ. Chưa có ghép người chơi trực tuyến.</p><h2>Tài khoản thật</h2><p>Đăng ký, đăng nhập, xác minh và khôi phục mật khẩu sử dụng API tài khoản do chủ dự án cung cấp. Đây là bản thông tin prototype; chính sách vận hành chính thức cần được bổ sung trước khi phát hành.</p></>}</section></>
}

function MembersOnly({ title, onSignIn, onBack }) {
  return <section className={styles.accessPanel}><span className={styles.eyebrow}>DÀNH CHO THÀNH VIÊN</span><h1>{title}</h1><p>Tính năng này gắn với tài khoản của bạn. Đăng nhập hoặc tạo tài khoản miễn phí để tiếp tục.</p><div className={styles.queueActions}><button type="button" className={styles.primaryButton} onClick={onSignIn}><UserRound size={17} /> Đăng nhập</button><button type="button" className={styles.textButton} onClick={onBack}>Về tổng quan</button></div></section>
}

function NotFound({ onBack }) {
  return <section className={styles.accessPanel}><span className={styles.eyebrow}>LỖI 404</span><h1>Nước đi này chưa tồn tại.</h1><p>Trang bạn đang tìm không có trong ChessArena. Trở về tổng quan để bắt đầu lại.</p><button type="button" className={styles.primaryButton} onClick={onBack}><Home size={17} /> Về tổng quan</button></section>
}

function ConnectionNotice() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update) }
  }, [])
  return offline ? <div className={styles.offlineBanner} role="status"><Info size={16} /> Thiết bị đang ngoại tuyến. Bạn vẫn có thể luyện với máy; thao tác tài khoản cần kết nối mạng.</div> : null
}
