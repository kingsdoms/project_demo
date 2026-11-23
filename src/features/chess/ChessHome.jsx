import { useState } from 'react'
import { ArrowRight, ArrowUpRight, BookOpen, Bot, Check, ChevronRight, Clock3, History, Play, ShieldCheck, Swords, UserRound } from 'lucide-react'
import { PieceArt } from './ChessBoard'
import { buildReplay } from './replay'
import { BOT_LEVELS } from '@/games/chess/bot/stockfish/levels'
import styles from './ChessHome.module.css'

const preview = buildReplay()[4]
const rhythms = [
  { key: 'bullet', title: 'Bullet', time: '1 + 0', label: '1 phút, không cộng giờ' },
  { key: 'blitz', title: 'Blitz', time: '5 + 0', label: '5 phút, không cộng giờ' },
  { key: 'rapid', title: 'Rapid', time: '10 + 5', label: '10 phút, cộng 5 giây mỗi nước' },
]

function PreviewBoard() {
  return <div className={styles.previewBoard} role="img" aria-label="Bàn cờ minh họa khai cuộc, quân trắng ở phía dưới">
    {Array.from({ length: 64 }, (_, index) => {
      const row = Math.floor(index / 8), col = index % 8
      const piece = preview.pieces.find((item) => item.row === row && item.col === col)
      return <span key={index} className={styles.square} data-dark={(row + col) % 2 === 1}>
        {col === 0 && <small className={styles.rank}>{8 - row}</small>}
        {row === 7 && <small className={styles.file}>{'abcdefgh'[col]}</small>}
        {piece && <span className={styles.miniPiece}><PieceArt type={piece.type} side={piece.side} /></span>}
      </span>
    })}
  </div>
}

export default function ChessHome({ account, lastGame, onNavigate, onStart, onReview, onAuth }) {
  const [speed, setSpeed] = useState('blitz')
  const [level, setLevel] = useState('medium')
  const previewTime = `${String(Number(rhythms.find((rhythm) => rhythm.key === speed).time.split(' + ')[0])).padStart(2, '0')}:00`
  const firstName = account?.name?.trim().split(/\s+/).at(-1)
  return <div className={styles.home}>
    <div className={styles.greeting}>
      <div><h1>{firstName ? `Chào ${firstName}, cùng chơi cờ nhé!` : 'Hôm nay, cùng chơi một ván.'}</h1><p>Một bàn cờ. Vô vàn nước đi. Bắt đầu theo cách của bạn.</p></div>
      <span className={styles.practiceBadge}><span /> Phòng luyện tập</span>
    </div>

    <section className={styles.stage} aria-label="Bắt đầu chơi cờ">
      <div className={styles.boardColumn}>
        <div className={styles.previewPlayer}><span className={styles.botAvatar}><Bot size={24} /></span><span><strong>Stockfish</strong><small>Đối thủ luyện tập của bạn</small></span><span className={styles.previewClock}>{previewTime}</span></div>
        <PreviewBoard />
        <div className={styles.previewPlayer}><span className={styles.humanAvatar}>{account?.name?.[0]?.toUpperCase() || <UserRound size={23} />}</span><span><strong>{account?.name || 'Bạn'}</strong><small>Quân trắng</small></span><span className={styles.previewClock} data-human="true">{previewTime}</span></div>
        <p className={styles.boardCaption}><ShieldCheck size={14} /> Bàn cờ minh họa · Bắt đầu ván mới để chơi</p>
      </div>

      <div className={styles.startPanel}>
        <div className={styles.startHeading}><span className={styles.chessEmblem}><PieceArt type="KNIGHT" side="WHITE" /></span><h2>Nước đi tiếp theo<span> là của bạn.</span></h2><p>Luyện tập cùng máy, từ ván cờ đầu tiên đến những thử thách mới.</p></div>
        <fieldset className={styles.rhythms}><legend><Clock3 size={16} /> Chọn nhịp chơi</legend><div>{rhythms.map((rhythm) => <button key={rhythm.key} type="button" aria-label={`${rhythm.title}, ${rhythm.label}`} aria-pressed={speed === rhythm.key} onClick={() => setSpeed(rhythm.key)}><span>{rhythm.title}</span><strong>{rhythm.time}</strong></button>)}</div></fieldset>
        <label className={styles.levelLabel} htmlFor="home-bot-level">Độ khó của máy</label>
        <div className={styles.levelSelect}><Bot size={18} /><select id="home-bot-level" value={level} onChange={(event) => setLevel(event.target.value)}>{BOT_LEVELS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
        <button className={styles.playButton} type="button" onClick={() => onStart('practice', speed, level)}><Play size={21} fill="currentColor" /> Chơi với máy <ChevronRight size={20} /></button>
        <span className={styles.playNote}><Check size={14} /> Không cần tài khoản · Không tính điểm</span>
        <button className={styles.otherModes} type="button" onClick={() => onNavigate('play')}><Swords size={19} /><span><strong>Khám phá chế độ chơi</strong><small>Xếp hạng và phòng mời đang là bản demo</small></span><ChevronRight size={18} /></button>
      </div>
    </section>

    <section className={styles.explore} aria-label="Học và xem lại">
      <article className={styles.learn}><span className={styles.exploreIcon}><BookOpen size={26} /></span><div><h2>Mỗi ván, tiến bộ một chút.</h2><p>Luật chơi, cách đi quân và những thao tác đầu tiên.</p><button type="button" onClick={() => onNavigate('help')}>Xem hướng dẫn <ArrowRight size={16} /></button></div></article>
      <article className={styles.review}><span className={styles.exploreIcon}><History size={26} /></span><div><h2>{lastGame ? 'Ván vừa chơi của bạn' : 'Hiểu hơn từng nước đi.'}</h2><p>{lastGame ? `${lastGame.history.length} nước đi · Sẵn sàng xem lại trong phiên này.` : 'Khám phá khai cuộc Tây Ban Nha qua một ván mẫu.'}</p><button type="button" onClick={() => onReview(lastGame?.history, lastGame?.result)}>Xem lại ván cờ <ArrowRight size={16} /></button></div></article>
    </section>
    {!account && <div className={styles.join}><span>Thêm một bước để có hồ sơ của riêng bạn.</span><button type="button" onClick={() => onAuth('register')}>Tạo tài khoản miễn phí <ArrowUpRight size={16} /></button></div>}
  </div>
}
