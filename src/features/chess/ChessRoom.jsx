import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp, ArrowRight, Bot, CircleHelp, Clock3, Settings2, Flag, Handshake, History, LoaderCircle, MessageSquare, Plus, Send, Swords, Trophy, Users, Volume2, VolumeX, X,
} from 'lucide-react'
import chess, { GameMode } from '@/games/chess'
import AccountMenu from '@/features/auth/AccountMenu'
import AuthDialog from '@/features/auth/AuthDialog'
import ChessBoard, { PieceArt } from './ChessBoard'
import { createClock, formatClock, settleClock } from './clock'
import { buildReplay } from './replay'
import BotLevelPicker from './BotLevelPicker'
import { getBotLevel } from '@/games/chess/bot/stockfish/levels'
import styles from './ChessRoom.module.css'

const { Side, PieceType } = chess.enums
const MODES = [
  { value: GameMode.VS_BOT, label: 'Đấu máy', icon: Bot },
  { value: GameMode.LOCAL, label: 'Hai người', icon: Users },
]
const SIDES = [
  { value: Side.WHITE, label: 'Trắng' },
  { value: Side.BLACK, label: 'Đen' },
]
const PIECE_NAMES = {
  QUEEN: 'Hậu', ROOK: 'Xe', BISHOP: 'Tượng', KNIGHT: 'Mã', KING: 'Vua', PAWN: 'Tốt',
}
const PROMOTION_LETTER = { QUEEN: 'Q', ROOK: 'R', BISHOP: 'B', KNIGHT: 'N' }
const OUTCOMES = {
  CHECKMATE: 'Chiếu hết',
  RESIGN: 'Người chơi đầu hàng',
  AGREED_DRAW: 'Hòa theo thỏa thuận mô phỏng',
  TIMEOUT: 'Hết thời gian trên đồng hồ cục bộ',
  STALEMATE: 'Hết nước đi hợp lệ',
  INSUFFICIENT_MATERIAL: 'Không đủ quân để chiếu hết',
}
const sideName = (side) => side === Side.WHITE ? 'Trắng' : 'Đen'
const squareName = ({ col, row }) => `${'abcdefgh'[col]}${8 - row}`

function useChessSession(options, timeControl) {
  const controller = useRef(null)
  const [snapshot, setSnapshot] = useState(null)
  useEffect(() => {
    let session = null
    let clock = createClock(timeControl, performance.now())
    let ended = null
    let active = true
    let engineStatus = { state: options.mode === GameMode.LOCAL ? 'ready' : 'loading', message: 'Đang nạp Stockfish…', level: options.botLevel }
    function update() {
      if (!active || !session) return
      const current = session.getView()
      const engineAvailable = options.mode === GameMode.LOCAL || ['ready', 'thinking'].includes(engineStatus.state)
      if (engineAvailable) clock = settleClock(clock, { now: performance.now(), turn: current.turn, ply: current.history.length - (current.promotion ? 1 : 0), running: !ended && !current.result })
      else clock = { ...clock, anchor: performance.now() }
      if (clock.timedOut && !ended) ended = { type: 'TIMEOUT', winner: clock.timedOut === Side.WHITE ? Side.BLACK : Side.WHITE }
      const result = ended || current.result
      const nextView = result ? { ...current, result, canAct: false, promotion: null } : current
      const remaining = clock.remaining
      const status = engineStatus
      setSnapshot((previous) => previous?.options === options && previous.view === nextView && previous.engineStatus === status && Math.ceil(previous.clocks.WHITE / 1000) === Math.ceil(remaining.WHITE / 1000) && Math.ceil(previous.clocks.BLACK / 1000) === Math.ceil(remaining.BLACK / 1000) ? previous : { options, clocks: remaining, view: nextView, engineStatus: status })
      if (result) session.destroy()
    }
    session = chess.create({ mode: options.mode, humanSide: options.side, botEngine: 'stockfish', botLevel: options.botLevel, onBotStatus: (status) => { if (!["ready", "thinking"].includes(engineStatus.state)) clock = { ...clock, anchor: performance.now() }; engineStatus = status; queueMicrotask(update) } })
    controller.current = {
      session,
      update,
      finish: (result) => {
        update()
        if (!ended && !session.getView().result) { ended = result; update() }
      },
    }
    const unsubscribe = session.subscribe(update)
    const timer = window.setInterval(() => { if (!ended && clock.running) update() }, 200)
    queueMicrotask(update)
    return () => {
      active = false
      controller.current = null
      window.clearInterval(timer)
      unsubscribe()
      session.destroy()
    }
  }, [options, timeControl])
  return {
    view: snapshot?.options === options ? snapshot.view : null,
    clocks: snapshot?.options === options ? snapshot.clocks : null,
    engineStatus: snapshot?.options === options ? snapshot.engineStatus : null,
    retryBot: () => controller.current?.session.retryBot(),
    clickSquare: (row, col) => { controller.current?.update(); controller.current?.session.actions.clickSquare(row, col) },
    promote: (kind) => controller.current?.session.actions.promote(kind),
    finish: (result) => controller.current?.finish(result),
  }
}

function Modal({ title, children, onClose, className }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={[styles.modal, className].filter(Boolean).join(' ')}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose?.()
      }}
    >
      <div className={styles.modalHeader}>
        <h2>{title}</h2>
        {onClose && (
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Đóng">
            <X size={19} />
          </button>
        )}
      </div>
      {children}
    </dialog>
  )
}

function PlayerRow({ side, active, mode, humanSide, clock, captures = [], botLabel = 'Stockfish' }) {
  const isBot = mode === GameMode.VS_BOT && humanSide !== side
  const name = mode === GameMode.LOCAL ? `Quân ${sideName(side).toLowerCase()}` : isBot ? botLabel : 'Bạn'
  return (
    <div className={styles.player} data-active={active}>
      <div className={styles.playerAvatar}>
        <PieceArt type={PieceType.KING} side={side} />
      </div>
      <div className={styles.playerName}>
        <strong>{name}</strong>
        <span>Quân {sideName(side).toLowerCase()}</span>
        {captures.length > 0 && <span className={styles.captured} aria-label={`Đã bắt ${captures.length} quân`}>{captures.map((piece, index) => <PieceArt key={index} type={piece.type} side={piece.side} />)}</span>}
      </div>
      {active && <span className={styles.playerTurn}><i /> Đang đi</span>}<span className={styles.clock} data-active={active} data-low={clock < 30000} aria-label={"Đồng hồ quân " + sideName(side)}>{clock == null ? '--:--' : formatClock(clock)}</span>
    </div>
  )
}

function Move({ entry }) {
  if (!entry) return <span className={styles.emptyMove}>Chưa đi</span>
  const notation = entry.kind === 'CASTLE'
    ? entry.to.col > entry.from.col ? '0-0' : '0-0-0'
    : `${squareName(entry.from)}${entry.capture ? '×' : ' → '}${squareName(entry.to)}${entry.promotion ? `=${PROMOTION_LETTER[entry.promotion]}` : ''}`
  return (
    <span className={styles.move}>
      <PieceArt type={entry.pieceType} side={entry.side} />
      <span>{notation}</span>
    </span>
  )
}

function MoveHistory({ history }) {
  const list = useRef(null)
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [history])

  return (
    <section className={styles.history} aria-labelledby="history-title">
      <div className={styles.sectionHeader}>
        <h2 id="history-title"><History size={17} /> Lịch sử nước đi</h2>
        <span className={styles.moveCount}>{history?.length ?? 0}</span>
      </div>
      {history?.length ? (
        <div ref={list} className={styles.movesList} tabIndex={0} role="region" aria-label="Danh sách nước đi">
          <table>
            <thead><tr><th scope="col">#</th><th scope="col">Trắng</th><th scope="col">Đen</th></tr></thead>
            <tbody>
              {Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => (
                <tr key={index}>
                  <th scope="row">{index + 1}.</th>
                  <td><Move entry={history[index * 2]} /></td>
                  <td><Move entry={history[index * 2 + 1]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyHistory}><History size={25} /><span>Chưa có nước đi</span></div>
      )}
    </section>
  )
}

function LocalChat() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [muted, setMuted] = useState(false)
  const [notice, setNotice] = useState('')
  return <section className={styles.chat} aria-label="Ghi chú cục bộ"><div className={styles.chatHeading}><span>Chat online chưa kết nối</span><button type="button" className={styles.iconButton} aria-label={muted ? 'Bỏ tắt tiếng chat' : 'Tắt tiếng chat'} aria-pressed={muted} onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><button type="button" className={styles.iconButton} aria-label="Mô phỏng báo cáo chat" onClick={() => setNotice('Đã ghi nhận báo cáo trong bản demo. Chưa gửi lên máy chủ.')}><Flag size={16} /></button></div><div className={styles.messages} role="log" aria-label="Ghi chú của bạn">{messages.length ? messages.map((message, index) => <p key={index}><strong>Bạn · ghi chú</strong>{message}</p>) : <p className={styles.chatEmpty}>Chưa có tin nhắn. Bạn có thể ghi chú nước đi cho riêng mình.</p>}</div>{notice && <p className={styles.localNotice} role="status">{notice}</p>}<form className={styles.chatForm} onSubmit={(event) => { event.preventDefault(); if (text.trim() && !muted) { setMessages((items) => [...items, text.trim()]); setText('') } }}><input aria-label="Nội dung ghi chú" placeholder={muted ? 'Chat đã tắt tiếng' : 'Viết ghi chú cục bộ…'} value={text} maxLength={500} disabled={muted} onChange={(event) => setText(event.target.value)} /><button type="submit" className={styles.iconButton} disabled={!text.trim() || muted} aria-label="Lưu ghi chú"><Send size={16} /></button></form></section>
}

export default function ChessRoom({ embedded = false, onExit, mode = GameMode.VS_BOT, timeControl = '5 + 0', boardTheme = 'forest', onReview, onFindGame, sound = true, botLevel = 'medium', onBotLevelChange }) {
  const [options, setOptions] = useState(() => ({ mode, side: Side.WHITE, botLevel: getBotLevel(botLevel).key }))
  const [flipped, setFlipped] = useState(false)
  const [pendingGame, setPendingGame] = useState(null)
  const [showRules, setShowRules] = useState(false)
  const [authMode, setAuthMode] = useState(null)
  const [action, setAction] = useState(null)
  const [resultDismissed, setResultDismissed] = useState(false)
  const [activeTab, setActiveTab] = useState('moves')
  const [roomSound, setRoomSound] = useState(sound)
  const { view, clocks, engineStatus, retryBot, clickSquare, promote, finish } = useChessSession(options, timeControl)
  const lastSoundMove = useRef(0)
  const audioRef = useRef(null)
  useEffect(() => () => { audioRef.current?.close().catch(() => {}) }, [])
  const captured = useMemo(() => {
    const captures = { WHITE: [], BLACK: [] }
    const history = view?.history ?? []
    const frames = buildReplay(history)
    for (let index = 1; index < frames.length; index++) {
      const mover = history[index - 1].side
      const nextIds = new Set(frames[index].pieces.map((piece) => piece.id))
      captures[mover].push(...frames[index - 1].pieces.filter((piece) => piece.side !== mover && !nextIds.has(piece.id)))
    }
    return captures
  }, [view?.history])

  useEffect(() => {
    const count = view?.history?.length ?? 0
    if (count > lastSoundMove.current && roomSound) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        const audio = audioRef.current || new AudioContext()
        audioRef.current = audio
        if (audio.state === "suspended") audio.resume().catch(() => {})
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.frequency.value = 420
        gain.gain.setValueAtTime(0.035, audio.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08)
        oscillator.connect(gain).connect(audio.destination)
        oscillator.start()
        oscillator.stop(audio.currentTime + 0.09)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      }
    }
    lastSoundMove.current = count
  }, [roomSound, view?.history?.length])

  const selectedBotLevel = getBotLevel(options.botLevel)
  const engineAvailable = options.mode === GameMode.LOCAL || ['ready', 'thinking'].includes(engineStatus?.state)
  const topSide = flipped ? Side.WHITE : Side.BLACK
  const bottomSide = flipped ? Side.BLACK : Side.WHITE
  const isOngoing = view && !view.result
  const result = view?.result
  const status = result
    ? result.winner ? `Quân ${sideName(result.winner).toLowerCase()} thắng` : 'Hòa cờ'
    : view?.turn ? `Lượt quân ${sideName(view.turn).toLowerCase()}` : 'Đang tải bàn cờ'
  const detail = result
    ? OUTCOMES[result.type]
    : view?.promotion ? 'Đang chọn quân phong cấp'
      : view?.checkedKing ? 'Vua đang bị chiếu'
        : view && !view.canAct ? 'Máy đang suy nghĩ…' : null

  function startGame(next) {
    setPendingGame(null)
    setResultDismissed(false)
    setAction(null)
    setFlipped(next.mode === GameMode.VS_BOT && next.side === Side.BLACK)
    setOptions({ ...next })
    onBotLevelChange?.(next.botLevel)
  }

  function requestGame(next) {
    if (isOngoing && view.history.length > 0) setPendingGame(next)
    else startGame(next)
  }

  return (
    <div className={styles.page} data-embedded={embedded} data-board={boardTheme}>
      {!embedded && <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <span className={styles.brandMark}><PieceArt type={PieceType.KNIGHT} side={Side.WHITE} /></span>
            <span>ChessArena<span className={styles.brandPeriod}>.</span></span>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.helpButton} onClick={() => setShowRules(true)}>
              <CircleHelp size={17} />
              <span>Luật chơi</span>
            </button>
            <AccountMenu onSignIn={() => setAuthMode('login')} />
          </div>
        </div>
      </header>}

      <section className={styles.main} aria-label="Phòng thi đấu">
        <div className={styles.intro}>
          {embedded && <button type="button" className={styles.backToArena} onClick={() => isOngoing && view.history.length ? setAction('exit') : onExit()}><ArrowRight size={16} /> Về ChessArena</button>}
          {!embedded && <div className={styles.introMark}><Swords size={22} /></div>}
          <div className={styles.matchTitle}><h1>{embedded ? 'Chơi với máy' : 'Phòng cờ vua'}</h1>{embedded && <span className={styles.matchMode}><Clock3 size={13} /> {timeControl} · {selectedBotLevel.label}</span>}</div>
          <span className={styles.liveLabel}><span /> {result ? 'Đã kết thúc' : 'Đang chơi'}</span>
        </div>

        <div className={styles.layout}>
          <section className={styles.playArea} aria-label="Ván cờ">
            <PlayerRow side={topSide} active={isOngoing && view.turn === topSide} mode={options.mode} humanSide={options.side} botLabel={"Stockfish · " + selectedBotLevel.label} clock={clocks?.[topSide]} captures={captured[topSide]} />
            <div className={styles.boardFrame}>
              <ChessBoard view={view} flipped={flipped} onSquare={clickSquare} blocked={!view?.canAct || !engineAvailable || Boolean(view?.promotion)} />
            </div>
            <PlayerRow side={bottomSide} active={isOngoing && view.turn === bottomSide} mode={options.mode} humanSide={options.side} botLabel={"Stockfish · " + selectedBotLevel.label} clock={clocks?.[bottomSide]} captures={captured[bottomSide]} />
            <p className={styles.localNotice}><CircleHelp size={14} /> Chọn quân, rồi chọn ô đến. Có thể dùng phím mũi tên và Enter.</p>{options.mode !== GameMode.LOCAL && <details className={styles.engineAbout}><summary>Ván luyện tập không tính điểm · Thông tin Stockfish</summary><p>Stockfish.js 19 Lite, bản một luồng WebAssembly. Độ mạnh phụ thuộc cấp và tài nguyên thiết bị.</p><a href="/stockfish/COPYING.txt" target="_blank" rel="noreferrer">Giấy phép GPL-3.0</a><a href="/stockfish/source-v19.0.1.zip" download>Mã nguồn phiên bản đang dùng</a></details>}
          </section>

          <aside className={styles.sidebar} aria-label="Điều khiển ván cờ">
            <div className={styles.status} data-result={Boolean(result)} role="status">
              <span className={styles.statusIcon}>
                {result ? <Trophy size={21} /> : <PieceArt type={PieceType.PAWN} side={view?.turn} />}
              </span>
              <div>
                <span className={styles.statusLabel}>{result ? 'Kết quả' : 'Trạng thái ván'}</span>
                <strong>{status}</strong>
                {detail && <span className={styles.statusDetail}>{detail}</span>}
              </div>
            </div>

            {options.mode !== GameMode.LOCAL && <><div className={styles.engineState} data-state={engineStatus?.state || "loading"} role={engineStatus?.state === "error" ? "alert" : "status"}>{engineStatus?.state === "loading" || engineStatus?.state === "thinking" ? <LoaderCircle size={17} className={styles.engineSpinner} /> : <Bot size={17} />}<span><strong>{engineStatus?.state === "error" ? "Không nạp được Stockfish" : "Stockfish · " + selectedBotLevel.label}</strong><small>{engineStatus?.state === "ready" ? "Máy đã sẵn sàng" : engineStatus?.state === "thinking" ? "Đang chọn nước đi…" : engineStatus?.message || "Đang chuẩn bị đối thủ…"}{!engineAvailable && " Đồng hồ đang tạm dừng."}</small></span>{engineStatus?.state === "error" && <button type="button" className={styles.secondaryButton} onClick={retryBot}>Thử lại</button>}</div><details className={styles.botSettings}><summary><Settings2 size={16} /> Đổi độ khó <span>{selectedBotLevel.label}</span></summary><BotLevelPicker compact value={options.botLevel} onChange={(level) => requestGame({ ...options, botLevel: level })} disabled={!view} /></details></>}

            {!embedded && <section className={styles.settings} aria-label="Thiết lập ván cờ">
              <fieldset className={styles.fieldset}>
                <legend>Chế độ chơi</legend>
                <div className={styles.segments}>
                  {MODES.map(({ value, label, icon: Icon }) => (
                    <button type="button" key={value} aria-pressed={options.mode === value} onClick={() => {
                      if (options.mode !== value) requestGame({ ...options, mode: value })
                    }}>
                      <Icon size={17} /> {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {options.mode === GameMode.VS_BOT && (
                <fieldset className={styles.fieldset}>
                  <legend>Màu quân của bạn</legend>
                  <div className={styles.segments}>
                    {SIDES.map(({ value, label }) => (
                      <button type="button" key={value} aria-pressed={options.side === value} onClick={() => {
                        if (options.side !== value) requestGame({ ...options, side: value })
                      }}>
                        <span className={styles.swatch} data-side={value} /> {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </section>}

            <div className={styles.tools}>
              <button type="button" className={styles.primaryButton} onClick={() => requestGame(options)}><Plus size={19} /> Ván mới</button>
              <button type="button" className={styles.flipButton} aria-label="Lật bàn cờ" title="Lật bàn cờ" aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}><ArrowDownUp size={20} /></button>
              <button type="button" className={styles.flipButton} aria-label={roomSound ? 'Tắt âm thanh' : 'Bật âm thanh'} aria-pressed={roomSound} onClick={() => setRoomSound((value) => !value)}>{roomSound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
            </div>
            <div className={styles.tabs} role="tablist" aria-label="Thông tin ván đấu">
              <button id="moves-tab" type="button" role="tab" aria-selected={activeTab === 'moves'} aria-controls="moves-panel" tabIndex={activeTab === 'moves' ? 0 : -1} onClick={() => setActiveTab('moves')} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { setActiveTab('chat'); document.getElementById('chat-tab')?.focus() } }}><History size={15} /> Nước đi</button>
              <button id="chat-tab" type="button" role="tab" aria-selected={activeTab === 'chat'} aria-controls="chat-panel" tabIndex={activeTab === 'chat' ? 0 : -1} onClick={() => setActiveTab('chat')} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { setActiveTab('moves'); document.getElementById('moves-tab')?.focus() } }}><MessageSquare size={15} /> Ghi chú</button>
            </div>
            <div id="moves-panel" role="tabpanel" aria-labelledby="moves-tab" hidden={activeTab !== 'moves'}><MoveHistory history={view?.history} /></div>
            <div id="chat-panel" role="tabpanel" aria-labelledby="chat-tab" hidden={activeTab !== 'chat'}><LocalChat /></div>
            {isOngoing && <div className={styles.gameActions}><button type="button" className={styles.secondaryButton} onClick={() => setAction('draw')}><Handshake size={16} /> Đề nghị hòa</button><button type="button" className={styles.dangerButton} onClick={() => setAction('resign')}><Flag size={16} /> Đầu hàng</button></div>}

            {result && onReview && <button type="button" className={styles.secondaryButton} onClick={() => onReview(view.history, result)}><History size={16} /> Xem lại ván này</button>}
          </aside>
        </div>
      </section>

      {result && !resultDismissed && <Modal title={status} onClose={() => setResultDismissed(true)}><div className={styles.resultHero}><Trophy size={35} /><strong>{OUTCOMES[result.type] || 'Ván đã kết thúc'}</strong><p>Điểm thay đổi: 0 · Ván luyện tập cục bộ</p><span>{view.history.length} nước đã đi · {timeControl}</span></div><div className={styles.dialogActions}>{onReview && <button type="button" className={styles.secondaryButton} onClick={() => onReview(view.history, result)}><History size={16} /> Xem lại</button>}<button type="button" className={styles.primaryButton} onClick={() => startGame(options)}><Plus size={17} /> Tái đấu</button>{onFindGame && <button type="button" className={styles.secondaryButton} onClick={onFindGame}><Swords size={16} /> Chọn trận mới</button>}</div></Modal>}
      {action && isOngoing && <Modal title={action === 'resign' ? 'Bạn muốn đầu hàng?' : action === 'draw' ? 'Đề nghị hòa với bot' : 'Rời ván đang chơi?'} onClose={() => setAction(null)}><p>{action === 'resign' ? 'Ván luyện tập sẽ kết thúc và bot được ghi nhận thắng trong phiên này.' : action === 'draw' ? 'Đây là bot cục bộ. Bạn có thể mô phỏng đối thủ đồng ý hòa để trải nghiệm màn hình kết quả.' : 'Nước đi chưa được lưu lên máy chủ. Bạn có thể xem lại trước khi rời.'}</p><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setAction(null)}>{action === 'draw' ? 'Từ chối / Chơi tiếp' : 'Tiếp tục ván'}</button>{action === 'exit' ? <button type="button" className={styles.primaryButton} onClick={() => onReview ? onReview(view.history, result) : onExit()}>Lưu xem lại và rời</button> : <button type="button" className={action === 'resign' ? styles.dangerButton : styles.primaryButton} onClick={() => { finish({ type: action === 'resign' ? 'RESIGN' : 'AGREED_DRAW', winner: action === 'resign' ? (options.side === Side.WHITE ? Side.BLACK : Side.WHITE) : null }); setAction(null) }}>{action === 'resign' ? 'Xác nhận đầu hàng' : 'Mô phỏng đồng ý hòa'}</button>}</div></Modal>}

      {view?.promotion && view.canAct && (
        <Modal title="Phong cấp tốt">
          <div className={styles.promotionChoices}>
            {view.promotion.options.map((kind) => (
              <button type="button" key={kind} onClick={() => promote(kind)}>
                <PieceArt type={kind} side={view.promotion.side} />
                {PIECE_NAMES[kind]}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {pendingGame && isOngoing && (
        <Modal title="Bắt đầu ván mới?" onClose={() => setPendingGame(null)}>
          <p>Ván hiện tại vẫn đang diễn ra. Bắt đầu ván mới sẽ xóa lịch sử nước đi của ván này.</p>
          <div className={styles.dialogActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setPendingGame(null)}>Tiếp tục ván</button>
            <button type="button" className={styles.primaryButton} onClick={() => startGame(pendingGame)}>Bắt đầu <ArrowRight size={17} /></button>
          </div>
        </Modal>
      )}

      {showRules && (
        <Modal title="Luật chơi cờ vua" onClose={() => setShowRules(false)}>
          <dl className={styles.rules}>
            <dt>Chiếu hết</dt><dd>Vua bị chiếu và không còn nước đi nào để thoát chiếu.</dd>
            <dt>Nhập thành</dt><dd>Vua đi hai ô về phía xe. Hai quân chưa từng di chuyển, không có quân chắn giữa, và vua không được đi qua ô bị tấn công.</dd>
            <dt>Bắt tốt qua đường</dt><dd>Khi tốt đối thủ vừa tiến hai ô và đứng cạnh tốt của bạn, bạn có thể bắt tốt đó ngay ở lượt kế tiếp.</dd>
            <dt>Phong cấp</dt><dd>Tốt tới hàng cuối được đổi thành hậu, xe, tượng hoặc mã.</dd>
          </dl>
        </Modal>
      )}
      {authMode && <AuthDialog initialMode={authMode} onClose={() => setAuthMode(null)} />}
    </div>
  )
}
