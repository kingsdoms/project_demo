import { useState } from 'react'
import { ArrowRight, Bot, Clock3, Crown, RefreshCw, Search, ShieldCheck, Sparkles, Swords, Users } from 'lucide-react'
import { PieceArt } from '../ChessBoard'
import { SeasonGuide } from './SeasonPanels'
import styles from './OnlineChess.module.css'

export default function OnlineLobby({ account, signedIn, state, catalog, lobby, onStart, onAuth, onRefresh }) {
  const [bot, setBot] = useState('')
  const [side, setSide] = useState('RANDOM')
  const [seasonId, setSeasonId] = useState('')
  const [guide, setGuide] = useState(false)
  const current = catalog.seasons.find((s) => s.id === seasonId) || catalog.seasons.find((s) => s.current) || catalog.seasons[0]
  const selectedBot = catalog.bots.find((b) => b.id === bot) || catalog.bots[0]
  const busy = signedIn && (state.status !== 'ready' || Boolean(state.pending))
  const start = (intent) => signedIn ? onStart(intent) : onAuth()
  return <div className={styles.lobby}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}><span className={styles.eyebrow}><span className={styles.liveDot} /> MỖI NƯỚC ĐI, MỘT KHỞI ĐẦU</span><h1>Bàn cờ đã sẵn sàng.<br /><span>Đến lượt bạn.</span></h1><p>{account?.name ? `Chào ${account.name}. ` : ''}Một ván đấu tập trung, một cuộc so tài thú vị. Chọn cách chơi và bắt đầu hành trình của bạn.</p><div className={styles.heroTags}><span><ShieldCheck size={15} /> Cờ vua trực tuyến</span><span><Clock3 size={15} /> 10 phút + 5 giây</span></div></div>
      <div className={styles.heroArt} aria-hidden="true"><div className={styles.artGrid} /><PieceArt type="KNIGHT" side="WHITE" /><span className={styles.artBadge}><Crown size={18} /> ChessArena</span></div>
    </section>
    <section className={styles.lobbyStats} aria-label="Sảnh trực tuyến">{[[Users, 'Đang online', 'online'], [Search, 'Đang tìm trận', 'queued'], [Swords, 'Ván đang chơi', 'rooms']].map(([Icon, name, key]) => <div key={key}><Icon size={19} /><strong>{lobby.value?.[key] ?? '—'}</strong><span>{name}</span></div>)}<button type="button" className={styles.iconButton} onClick={onRefresh} aria-label="Làm mới sảnh"><RefreshCw size={17} /></button></section>
    {lobby.error && <p role="status" className={styles.notice}>Chưa cập nhật được sảnh. {lobby.error}</p>}
    <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>CHỌN MỘT THỬ THÁCH</span><h2>Chơi theo cách của bạn</h2></div><span>Ba chế độ. Cùng một niềm vui.</span></div>
    <div className={styles.modeGrid}>
      <section className={styles.modeCard} data-featured="true"><span className={styles.modeIcon}><Swords size={25} /></span><span className={styles.cardTag}>CỜ VUA TIÊU CHUẨN</span><h2>Đối thủ mới.<br />Thử thách mới.</h2><p>Ghép cặp với một người chơi đang online. Tập trung vào từng nước đi.</p><span className={styles.modeMeta}><Clock3 size={15} /> 10 phút · Cộng 5 giây mỗi nước</span><button type="button" className={styles.primaryButton} disabled={busy} onClick={() => start({ type: 'QUEUE', mode: 'STANDARD' })}><Search size={18} /> Tìm trận <ArrowRight size={17} /></button></section>
      <section className={styles.modeCard}><span className={styles.modeIcon} data-tone="purple"><Sparkles size={25} /></span><span className={styles.cardTag}>MỘT CÁCH CHƠI MỚI</span><h2>Chế độ<br />mở rộng.</h2><p>Nhân vật, thẻ bài và thời tiết. Mỗi vòng đấu mở ra một chiến thuật.</p><label className={styles.selectLabel}>Season<select value={current?.id || ''} onChange={(e) => setSeasonId(e.target.value)} disabled={!catalog.seasons.length}>{!catalog.seasons.length && <option value="">{catalog.loading ? 'Đang tải…' : 'Chưa có season'}</option>}{catalog.seasons.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}{s.current ? ' · Hiện tại' : ''}</option>)}</select></label><button type="button" className={styles.secondaryButton} disabled={busy || !current} onClick={() => start({ type: 'QUEUE', mode: 'EXTENDED', season: current.id })}><Sparkles size={17} /> Chế độ mở rộng <ArrowRight size={16} /></button><button type="button" className={styles.textButton} disabled={!current} onClick={() => setGuide(true)}>Season này có gì?</button></section>
      <section className={styles.modeCard}><span className={styles.modeIcon} data-tone="blue"><Bot size={25} /></span><span className={styles.cardTag}>LUYỆN TẬP THEO NHỊP CỦA BẠN</span><h2>Thêm một ván.<br />Thêm tiến bộ.</h2><p>Thử khai cuộc và rèn tư duy cùng máy. Không đồng hồ, thoải mái suy nghĩ.</p><label className={styles.selectLabel}>Đối thủ máy<select value={selectedBot?.id || ''} onChange={(e) => setBot(e.target.value)} disabled={!catalog.bots.length}>{!catalog.bots.length && <option value="">{catalog.loading ? 'Đang tải…' : 'Chưa có bot'}</option>}{catalog.bots.map((b) => <option key={b.id} value={b.id}>{b.name || (b.id === 'simple' ? 'Bot cơ bản' : b.id)}</option>)}</select></label>{selectedBot && <small className={styles.botDescription}>{selectedBot.id === 'simple' ? 'Ưu tiên bắt quân giá trị cao, hoặc chọn nước ngẫu nhiên.' : selectedBot.description}</small>}<fieldset className={styles.sideChoice}><legend>Màu quân của bạn</legend>{[['WHITE', 'Trắng'], ['RANDOM', 'Ngẫu nhiên'], ['BLACK', 'Đen']].map(([value, label]) => <button type="button" key={value} aria-pressed={side === value} onClick={() => setSide(value)}>{label}</button>)}</fieldset><button type="button" className={styles.secondaryButton} disabled={busy || !selectedBot} onClick={() => start({ type: 'PRACTICE', bot: selectedBot.id, ...(side !== 'RANDOM' ? { side } : {}) })}><Bot size={17} /> Đánh với máy <ArrowRight size={16} /></button></section>
    </div>
    {Object.keys(catalog.errors).length > 0 && <div className={styles.notice} role="alert">Không tải được một số lựa chọn. {Object.values(catalog.errors).join(' ')} <button type="button" className={styles.textButton} onClick={onRefresh}>Thử lại</button></div>}
    {!signedIn && <p className={styles.lobbyFoot}><ShieldCheck size={16} /> Đăng nhập để vào bàn cờ và tiếp tục ván khi kết nối trở lại.</p>}
    {guide && <SeasonGuide seasons={current ? [current] : []} onClose={() => setGuide(false)} />}
  </div>
}
